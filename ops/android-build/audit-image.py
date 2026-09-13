#!/usr/bin/env python3
"""Manual root audit; starts disposable credential-free VMs, never a runner."""
import base64
import fcntl
import ipaddress
import json
import os
import pathlib
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import uuid

SOURCE = pathlib.Path(__file__).resolve().parent
STATE = pathlib.Path("/var/lib/gymnasia-android")
UNIT = "gymnasia-android-vm.service"
TIMEOUT_UNIT = "gymnasia-android-audit-timeout.service"


def run(*args, check=True):
    return subprocess.run(args, check=check, text=True, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT).stdout.strip()


def property_value(unit, name):
    return run("systemctl", "show", "-p", name, "--value", unit)


def snapshot():
    assert pathlib.Path("/proc/sys/net/ipv4/ip_forward").read_text().strip() == "0"
    assert pathlib.Path("/proc/sys/net/ipv6/conf/all/forwarding").read_text().strip() == "0"
    return {"listeners": sorted(run("ss", "-H", "-lntu").splitlines()),
            "failed": run("systemctl", "--failed", "--no-legend", "--plain")}


def clean_overlay():
    assert not (STATE / "current/disk.qcow2").exists()
    assert not (STATE / "current/seed.img").exists()


def reachable_targets():
    # Positive host controls use only already-listening local services. Never
    # open a probe port or scan another machine on the LAN/tailnet.
    addresses = []
    for interface in json.loads(run("ip", "-j", "-4", "address", "show")):
        if interface["ifname"].startswith(("lo", "docker")):
            continue
        for address in interface["addr_info"]:
            if address["scope"] == "global":
                addresses.append(address["local"])
    candidates = set()
    for line in run("ss", "-H", "-ltn4").splitlines():
        host, port = line.split()[3].rsplit(":", 1)
        host = host.split("%", 1)[0]
        if host == "0.0.0.0":
            candidates.update((address, int(port)) for address in addresses)
            candidates.add(("127.0.0.1", int(port)))
        else:
            candidates.add((host, int(port)))
    targets = set()
    for address, port in sorted(candidates):
        ip = ipaddress.ip_address(address)
        if ip.is_loopback and address != "127.0.0.1":
            continue
        if not (ip.is_private or ip in ipaddress.ip_network("100.64.0.0/10")):
            continue
        try:
            with socket.create_connection((address, port), timeout=2):
                pass
        except OSError:
            continue
        # SLIRP exposes the host loopback as 10.0.2.2, not guest loopback.
        targets.add(("10.0.2.2" if ip.is_loopback else address, port))
    assert any(ipaddress.ip_address(a) in ipaddress.ip_network("192.168.0.0/16") for a, _ in targets)
    assert any(ipaddress.ip_address(a) in ipaddress.ip_network("100.64.0.0/10") for a, _ in targets)
    assert any(a == "10.0.2.2" for a, _ in targets)
    return sorted(targets)


BOOTSTRAP = """#!/bin/bash
set -euo pipefail
exec > /dev/ttyS0 2>&1
trap 'status=$?; if (( status != 0 )); then echo GYMNASIA_AUDIT_FAILED; /usr/bin/systemctl --no-block poweroff; fi' EXIT
test "$(/usr/bin/passwd -S root | awk '{print $2}')" = L
test "$(/usr/bin/passwd -S runner | awk '{print $2}')" = L
set -a
source /etc/gymnasia-toolchain.env
set +a
/usr/sbin/runuser -u runner -- /usr/bin/setpriv --no-new-privs /usr/bin/python3 /opt/gymnasia/audit-guest.py /opt/gymnasia/audit-inputs.json
/usr/bin/systemctl --no-block poweroff
"""


assert os.getuid() == 0, "Ejecutar con sudo"
signal.signal(signal.SIGTERM, lambda *_: sys.exit(143))
os.umask(0o077)
assert not pathlib.Path("/run/wallabot-maintenance.block").exists()
assert property_value(UNIT, "ActiveState") == "inactive"
assert property_value("gymnasia-android-image.service", "ActiveState") == "inactive"
assert not pathlib.Path("/run/systemd/system/" + TIMEOUT_UNIT).exists()
lock_file = open("/run/lock/gymnasia-android-image.lock", "a")
fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
clean_overlay()
print(run("sha256sum", "-c", str(STATE / "base.sha256")), flush=True)
image_info = json.loads(run("qemu-img", "info", "--output=json", str(STATE / "base.qcow2")))
assert image_info["virtual-size"] == 120 * 1024**3 and "backing-filename" not in image_info
assert (STATE / "base.qcow2").stat().st_mode & 0o777 == 0o440
assert (STATE / "base.qcow2").stat().st_uid == 0
baseline = snapshot()
assert not baseline["failed"], "Resolver las unidades fallidas antes de auditar"
evidence = pathlib.Path(tempfile.mkdtemp(prefix="gymnasia-audit.", dir="/var/tmp"))
(evidence / "before.json").write_text(json.dumps(baseline, indent=2))
targets = reachable_targets()
toolchain = json.loads((SOURCE / "toolchain.json").read_text())
runner_url = json.loads((SOURCE / "downloads.json").read_text())["runner"]["url"]
runner_version = re.search(r"/download/v([^/]+)/", runner_url)[1]
timeout_path = pathlib.Path("/run/systemd/system/" + TIMEOUT_UNIT)
work = pathlib.Path(tempfile.mkdtemp(prefix="gymnasia-audit-seed.", dir="/var/tmp"))
active_invocations = {}


def save_console(unit, mode):
    invocation = active_invocations.get(unit)
    if invocation:
        console = run("journalctl", "--no-pager", f"_SYSTEMD_INVOCATION_ID={invocation}", "-o", "cat")
        (evidence / f"{mode}-console.txt").write_text(console)
        return console
    return ""


try:
    for mode in ["success", "cancel", "crash", "timeout"]:
        clean_overlay()
        unit = TIMEOUT_UNIT if mode == "timeout" else UNIT
        if mode == "timeout":
            definition = pathlib.Path("/etc/systemd/system/" + UNIT).read_text()
            timeout_path.write_text(definition.replace("RuntimeMaxSec=2h", "RuntimeMaxSec=90s"))
            run("systemctl", "daemon-reload")
        nonce = uuid.uuid4().hex
        inputs = {"nonce": nonce, "mode": "inspect" if mode == "success" else "hold",
                  "toolchain": toolchain, "runnerVersion": runner_version, "targets": targets}
        files = []
        for name, data, permissions in [
            ("audit-guest.py", (SOURCE / "audit-guest.py").read_text(), "0644"),
            ("audit-bootstrap.sh", BOOTSTRAP, "0700"),
            ("audit-inputs.json", json.dumps(inputs), "0644"),
        ]:
            files.append({"path": "/opt/gymnasia/" + name, "permissions": permissions,
                          "encoding": "b64", "content": base64.b64encode(data.encode()).decode()})
        config = {"users": [], "ssh_pwauth": False, "disable_root": True, "write_files": files,
                  "runcmd": [["systemd-run", "--no-block", "--unit=gymnasia-audit",
                              "--property=After=cloud-final.service", "/bin/bash", "/opt/gymnasia/audit-bootstrap.sh"]]}
        (work / "user-data").write_text("#cloud-config\n" + json.dumps(config))
        (work / "meta-data").write_text(f"instance-id: gymnasia-audit-{nonce}\nlocal-hostname: android-builder\n")
        network = {"version": 2, "ethernets": {"build": {"match": {"name": "en*"}, "dhcp4": True,
                   "dhcp6": False, "dhcp4-overrides": {"use-dns": False},
                   "nameservers": {"addresses": ["1.1.1.1", "1.0.0.1"]}}}}
        (work / "network-config").write_text(json.dumps(network))
        run("qemu-img", "create", "-f", "qcow2", "-F", "qcow2", "-b", str(STATE / "base.qcow2"),
            str(STATE / "current/disk.qcow2"))
        run("cloud-localds", "--network-config=" + str(work / "network-config"),
            str(STATE / "current/seed.img"), str(work / "user-data"), str(work / "meta-data"))
        for name in ["disk.qcow2", "seed.img"]:
            shutil.chown(STATE / "current" / name, "gymnasia-vm", "gymnasia-vm")
        print(f"Auditoría: {mode}", flush=True)
        run("systemctl", "start", unit)
        active_invocations[unit] = property_value(unit, "InvocationID")
        assert active_invocations[unit]
        for key, expected in {"User": "gymnasia-vm", "NoNewPrivileges": "yes", "CPUQuotaPerSecUSec": "4s",
                              "MemoryMax": str(18 * 1024**3), "MemorySwapMax": "0"}.items():
            assert property_value(unit, key) == expected, key
        denied = property_value(unit, "IPAddressDeny")
        for network in ["127.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "172.16.0.0/12", "192.168.0.0/16", "::/0"]:
            assert network in denied, network
        process_status = pathlib.Path(f'/proc/{property_value(unit, "ExecMainPID")}/status').read_text()
        assert re.search(r"^CapEff:\s+0+$", process_status, re.M)
        deadline = time.monotonic() + 300
        marker = ("GYMNASIA_AUDIT_PASS " if mode == "success" else "GYMNASIA_AUDIT_HOLD ") + nonce
        while True:
            console = save_console(unit, mode)
            assert "GYMNASIA_AUDIT_FAILED" not in console, f"Falló el guest: {evidence}"
            if marker in console:
                break
            assert property_value(unit, "ActiveState") == "active", f"VM detenida antes de comprobar: {evidence}"
            assert time.monotonic() < deadline, f"Sin resultado del guest: {evidence}"
            time.sleep(2)
        if mode == "cancel":
            run("systemctl", "stop", unit)
        elif mode == "crash":
            run("systemctl", "kill", "--kill-whom=main", "--signal=SIGKILL", unit)
        while property_value(unit, "ActiveState") in {"active", "deactivating"}:
            assert time.monotonic() < deadline, "La VM no termina"
            time.sleep(2)
        result = property_value(unit, "Result")
        expected = {"success": "success", "cancel": "success", "crash": "signal", "timeout": "timeout"}[mode]
        assert result == expected, (mode, result)
        clean_overlay()
        save_console(unit, mode)
        (evidence / f"{mode}-result.json").write_text(json.dumps({"result": result, "overlayRemoved": True}))
        run("systemctl", "reset-failed", unit, check=False)
        print(f"Comprobado: {mode}; overlay y seed eliminados", flush=True)
    print(run("sha256sum", "-c", str(STATE / "base.sha256")), flush=True)
    after = snapshot()
    (evidence / "after.json").write_text(json.dumps(after, indent=2))
    assert after == baseline, "El estado del host cambió; revisar evidencia"
    print(f"GYMNASIA_ISOLATION_AUDIT_OK {evidence}", flush=True)
finally:
    for unit in [UNIT, TIMEOUT_UNIT]:
        run("systemctl", "stop", unit, check=False)
        assert property_value(unit, "ActiveState") not in {"active", "activating", "deactivating"}
        run("systemctl", "reset-failed", unit, check=False)
    run("/usr/local/lib/gymnasia-android/clean-current.sh")
    timeout_path.unlink(missing_ok=True)
    run("systemctl", "daemon-reload")
    clean_overlay()
    shutil.rmtree(work)
    print(f"Evidencia privada: {evidence}", flush=True)
