#!/usr/bin/env python3
"""One manual smoke VM. Inputs are private; only bounded outputs survive cleanup."""
import base64
import fcntl
import hashlib
import json
import os
import pathlib
import pwd
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import uuid

SOURCE = pathlib.Path(__file__).resolve().parent
STATE = pathlib.Path("/var/lib/gymnasia-android")
UNIT = "gymnasia-android-smoke.service"


def run(*args, check=True):
    return subprocess.run(args, check=check, text=True, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT).stdout.strip()


def prop(name):
    return run("systemctl", "show", "-p", name, "--value", UNIT)


def snapshot():
    assert pathlib.Path("/proc/sys/net/ipv4/ip_forward").read_text().strip() == "0"
    assert pathlib.Path("/proc/sys/net/ipv6/conf/all/forwarding").read_text().strip() == "0"
    return {"listeners": sorted(run("ss", "-H", "-lntu").splitlines()),
            "failed": run("systemctl", "--failed", "--no-legend", "--plain")}


BOOTSTRAP = """#!/bin/bash
set -euo pipefail
trap '/usr/bin/systemctl --no-block poweroff' EXIT
set -a
# shellcheck source=/dev/null
source /etc/gymnasia-toolchain.env
set +a
test "$(/usr/bin/passwd -S root | awk '{print $2}')" = L
test "$(/usr/bin/passwd -S runner | awk '{print $2}')" = L
for _ in {1..100}; do
  test ! -e /dev/virtio-ports/gymnasia.transfer || break
  sleep 0.1
done
test -c /dev/virtio-ports/gymnasia.transfer
chown runner:runner /dev/virtio-ports/gymnasia.transfer
chmod 0600 /dev/virtio-ports/gymnasia.transfer
/usr/sbin/runuser -u runner -- /usr/bin/setpriv --no-new-privs /usr/bin/python3 /opt/gymnasia/smoke-guest.py
"""


def main():
    assert os.getuid() == 0, "Ejecutar con sudo"
    assert len(sys.argv) == 3, "run-smoke.py request.json input.bin"
    os.umask(0o077)
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(143))
    request_path = pathlib.Path(sys.argv[1]).resolve()
    input_path = pathlib.Path(sys.argv[2]).resolve()
    assert request_path.stat().st_size <= 1024 * 1024
    request_bytes = request_path.read_bytes()
    request = json.loads(request_bytes)
    assert request["mode"] in ["probe", "build", "verify", "diagnose"]
    assert len(request["nonce"]) == 32
    if request["mode"] == "build":
        assert request.get("expoToken") and request_path.stat().st_mode & 0o077 == 0
    else:
        assert "expoToken" not in request
    assert input_path.stat().st_size <= 256 * 1024 * 1024
    assert not pathlib.Path("/run/wallabot-maintenance.block").exists()
    lock = open("/run/lock/gymnasia-android-image.lock", "a")
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    for other in [UNIT, "gymnasia-android-vm.service", "gymnasia-android-image.service"]:
        assert run("systemctl", "show", "-p", "ActiveState", "--value", other) == "inactive"
    for name in ["disk.qcow2", "seed.img", "request.json", "input.bin", "report.json", "output.bin", "transfer.json"]:
        assert not (STATE / "current" / name).exists(), "Hay material de una prueba anterior"
    print(run("sha256sum", "-c", str(STATE / "base.sha256")), flush=True)
    image = STATE / "base.qcow2"
    assert image.stat().st_uid == 0 and image.stat().st_mode & 0o777 == 0o440
    image_info = json.loads(run("qemu-img", "info", "--output=json", str(image)))
    assert image_info["virtual-size"] == 120 * 1024**3 and "backing-filename" not in image_info
    baseline = snapshot()
    assert not baseline["failed"]
    evidence = pathlib.Path(tempfile.mkdtemp(prefix="gymnasia-smoke.", dir="/var/tmp"))
    (evidence / "before.json").write_text(json.dumps(baseline))
    # Record only a request digest and non-secret identity. The full request,
    # Expo token and build log are never copied into evidence or cloud-init.
    (evidence / "request-summary.json").write_text(json.dumps({
        "mode": request["mode"], "nonce": request["nonce"], "sourceCommit": request.get("sourceCommit"),
        "requestSha256": hashlib.sha256(request_bytes).hexdigest()}))
    work = pathlib.Path(tempfile.mkdtemp(prefix="gymnasia-smoke-seed.", dir="/var/tmp"))
    unit_path = pathlib.Path("/run/systemd/system/" + UNIT)
    assert not unit_path.exists()
    invocation = None
    try:
        installed = pathlib.Path("/usr/local/lib/gymnasia-android/smoke-channel.py")
        shutil.copyfile(SOURCE / "smoke-channel.py", installed)
        installed.chmod(0o755)
        definition = pathlib.Path("/etc/systemd/system/gymnasia-android-vm.service").read_text()
        definition = definition.replace("ExecStart=/usr/local/lib/gymnasia-android/start-vm.sh",
                                        "ExecStart=/usr/bin/python3 /usr/local/lib/gymnasia-android/smoke-channel.py")
        definition = definition.replace("ExecStopPost=+/usr/local/lib/gymnasia-android/clean-current.sh",
                                        "ExecStopPost=+/usr/local/lib/gymnasia-android/clean-current.sh\n"
                                        "ExecStopPost=+/usr/bin/rm -f /var/lib/gymnasia-android/current/request.json")
        assert "ExecStart=/usr/bin/python3" in definition
        unit_path.write_text(definition)
        files = []
        for name, data in [("smoke-channel.py", (SOURCE / "smoke-channel.py").read_text()),
                           ("smoke-guest.py", (SOURCE / "smoke-guest.py").read_text()),
                           ("smoke-bootstrap.sh", BOOTSTRAP)]:
            files.append({"path": "/opt/gymnasia/" + name, "permissions": "0644",
                          "encoding": "b64", "content": base64.b64encode(data.encode()).decode()})
        config = {"users": [], "ssh_pwauth": False, "disable_root": True, "write_files": files,
                  "runcmd": [["systemd-run", "--no-block", "--unit=gymnasia-smoke",
                              "--property=After=cloud-final.service", "--property=StandardOutput=journal+console",
                              "--property=StandardError=journal+console", "/bin/bash", "/opt/gymnasia/smoke-bootstrap.sh"]]}
        (work / "user-data").write_text("#cloud-config\n" + json.dumps(config))
        (work / "meta-data").write_text(f"instance-id: gymnasia-smoke-{uuid.uuid4().hex}\nlocal-hostname: android-builder\n")
        network = {"version": 2, "ethernets": {"build": {"match": {"name": "en*"}, "dhcp4": True,
                   "dhcp6": False, "dhcp4-overrides": {"use-dns": False},
                   "nameservers": {"addresses": ["1.1.1.1", "1.0.0.1"]}}}}
        (work / "network-config").write_text(json.dumps(network))
        run("qemu-img", "create", "-f", "qcow2", "-F", "qcow2", "-b", str(STATE / "base.qcow2"),
            str(STATE / "current/disk.qcow2"))
        run("cloud-localds", "--network-config=" + str(work / "network-config"),
            str(STATE / "current/seed.img"), str(work / "user-data"), str(work / "meta-data"))
        (STATE / "current/request.json").write_bytes(request_bytes)
        shutil.copyfile(input_path, STATE / "current/input.bin")
        for name in ["disk.qcow2", "seed.img", "request.json", "input.bin"]:
            path = STATE / "current" / name
            shutil.chown(path, "gymnasia-vm", "gymnasia-vm")
            path.chmod(0o600)
        if request["mode"] == "build":
            request_path.unlink()
        request_bytes = None
        request.pop("expoToken", None)
        run("systemctl", "daemon-reload")
        run("systemctl", "start", UNIT)
        invocation = prop("InvocationID")
        print(f"GYMNASIA_SMOKE_STARTED {request['mode']} {evidence}", flush=True)
        for key, value in {"User": "gymnasia-vm", "NoNewPrivileges": "yes", "CPUQuotaPerSecUSec": "4s",
                           "MemoryMax": str(18 * 1024**3), "MemorySwapMax": "0"}.items():
            assert prop(key) == value
        denied = prop("IPAddressDeny")
        for network in ["127.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "172.16.0.0/12", "192.168.0.0/16", "::/0"]:
            assert network in denied
        pid = prop("ExecMainPID")
        deadline = time.monotonic() + 15
        while True:
            children = pathlib.Path(f"/proc/{pid}/task/{pid}/children").read_text().split()
            hypervisors = [child for child in children
                           if os.readlink(f"/proc/{child}/exe").endswith("/qemu-system-x86_64")]
            if hypervisors:
                break
            assert time.monotonic() < deadline, "QEMU no completó el arranque"
            time.sleep(0.1)
        assert len(hypervisors) == 1
        status = pathlib.Path(f"/proc/{hypervisors[0]}/status").read_text()
        assert re.search(r"^CapEff:\s+0+$", status, re.M) and re.search(r"^NoNewPrivs:\s+1$", status, re.M)
        assert set(re.search(r"^Uid:\s+(.+)$", status, re.M)[1].split()) == {str(pwd.getpwnam("gymnasia-vm").pw_uid)}
        (evidence / "process.txt").write_text(status)
        started = time.monotonic()
        seen = set()
        while prop("ActiveState") in ["activating", "active", "deactivating"]:
            assert time.monotonic() - started < 121 * 60
            console = run("journalctl", "--no-pager", f"_SYSTEMD_INVOCATION_ID={invocation}", "-o", "cat")
            for line in console.splitlines():
                # Only fixed progress labels, never arbitrary guest output.
                if line in {"GYMNASIA_SMOKE_PHASE " + name for name in
                            ["checkout", "dependencias", "compilacion-local", "verificacion-nativa", "completado"]} and line not in seen:
                    print(line, flush=True)
                    seen.add(line)
            time.sleep(2)
        assert prop("Result") == "success", "Falló la VM o su canal; revisar el diagnóstico privado"
        report = json.loads((STATE / "current/report.json").read_text())
        assert report["nonce"] == request["nonce"] and report["mode"] == request["mode"]
        for name in ["report.json", "output.bin", "transfer.json"]:
            shutil.move(STATE / "current" / name, evidence / name)
        print("GYMNASIA_SMOKE_RESULT " + report["result"], flush=True)
        assert report["result"] == "passed", "La prueba falló; el informe conserva solo fase y tipo de error"
    finally:
        if request["mode"] == "build":
            request_path.unlink(missing_ok=True)
        run("systemctl", "stop", UNIT, check=False)
        assert prop("ActiveState") not in ["active", "activating", "deactivating"]
        run("systemctl", "reset-failed", UNIT, check=False)
        run("/usr/local/lib/gymnasia-android/clean-current.sh")
        for name in ["request.json", "input.bin", "report.json", "output.bin", "transfer.json"]:
            (STATE / "current" / name).unlink(missing_ok=True)
        unit_path.unlink(missing_ok=True)
        run("systemctl", "daemon-reload")
        shutil.rmtree(work)
        print(run("sha256sum", "-c", str(STATE / "base.sha256")), flush=True)
        after = snapshot()
        (evidence / "after.json").write_text(json.dumps(after))
        assert after == baseline, "El estado de red/unidades cambió durante la prueba"
        print(f"GYMNASIA_SMOKE_CLEANED {evidence}", flush=True)


if __name__ == "__main__":
    main()
