#!/usr/bin/env python3
"""Credential-free checks executed as runner inside a disposable audit VM."""
import glob
import json
import os
import pathlib
import pwd
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

inputs = json.loads(pathlib.Path(sys.argv[1]).read_text())
print("GYMNASIA_AUDIT_PROGRESS identidad", flush=True)
nonce = inputs["nonce"]
assert re.fullmatch(r"[a-f0-9]{32}", nonce)
assert os.getuid() != 0 and pwd.getpwuid(os.getuid()).pw_name == "runner"
assert subprocess.check_output(["id", "-nG"], text=True).strip() == "runner"
assert not pathlib.Path("/home/runner/actions/.runner").exists()
marker = pathlib.Path("/home/runner/.gymnasia-audit-marker")
assert not marker.exists(), "El overlay anterior no se ha descartado"
marker.write_text(nonce)
if inputs["mode"] == "hold":
    print(f"GYMNASIA_AUDIT_HOLD {nonce}", flush=True)
    while True:
        time.sleep(60)

print("GYMNASIA_AUDIT_PROGRESS permisos", flush=True)
status = pathlib.Path("/proc/self/status").read_text()
assert re.search(r"^CapEff:\s+0+$", status, re.M)
assert re.search(r"^NoNewPrivs:\s+1$", status, re.M)
assert not shutil.which("sudo") and not shutil.which("docker")
for target in ["/dev/kvm", "/dev/dri", "/var/run/docker.sock", "/run/tailscale"]:
    assert not pathlib.Path(target).exists(), target
assert not glob.glob("/dev/nvidia*")
assert not os.access("/root", os.R_OK | os.X_OK)
assert not os.access("/etc/shadow", os.R_OK)
assert {p.pw_name for p in pwd.getpwall() if 1000 <= p.pw_uid < 65534} == {"runner"}
for mount in pathlib.Path("/proc/self/mountinfo").read_text().splitlines():
    filesystem = mount.split(" - ", 1)[1].split()[0]
    assert filesystem not in {"9p", "virtiofs", "nfs", "nfs4", "cifs", "fuse.sshfs"}
print("GYMNASIA_AUDIT_PROGRESS toolchain-inmutable", flush=True)
for root in ["/opt/android", "/opt/gymnasia", "/usr/local/lib/gymnasia"]:
    for directory, children, files in os.walk(root):
        for path in [directory, *(str(pathlib.Path(directory) / n) for n in children + files)]:
            assert not os.access(path, os.W_OK), f"Toolchain modificable: {path}"
assert not os.access("/etc/systemd/system/gymnasia-runner.service", os.W_OK)
assert os.cpu_count() == 4
memory_kib = int(re.search(r"MemTotal:\s+(\d+)", pathlib.Path("/proc/meminfo").read_text())[1])
assert 14 * 1024**2 < memory_kib <= 16 * 1024**2


def output(*command):
    return subprocess.check_output(command, text=True, stderr=subprocess.STDOUT, timeout=30).strip()


lock = inputs["toolchain"]
print("GYMNASIA_AUDIT_PROGRESS versiones", flush=True)
assert output("node", "--version") == "v" + lock["node"]
assert output("npm", "--version") == lock["npm"]
assert f'version "{lock["java"]}"' in output("java", "-version")
assert f'eas-cli/{lock["easCli"]} ' in output("eas", "--version")
assert output("/home/runner/actions/bin/Runner.Listener", "--version") == inputs["runnerVersion"]
sdk = pathlib.Path("/opt/android")
platform = (sdk / f'platforms/android-{lock["androidPlatform"]}/source.properties').read_text()
assert re.search(r"^AndroidVersion.ApiLevel\s*=\s*" + lock["androidPlatform"] + r"\s*$", platform, re.M)
for prefix, name in [("build-tools", "androidBuildTools"), ("ndk", "androidNdk"),
                     ("cmdline-tools", "androidCommandLineTools"), ("cmake", "cmake")]:
    properties = (sdk / prefix / lock[name] / "source.properties").read_text()
    assert re.search(r"^Pkg.Revision\s*=\s*(.+)$", properties, re.M)[1].strip() == lock[name]
print("GYMNASIA_AUDIT_PROGRESS red", flush=True)
with urllib.request.urlopen("https://github.com", timeout=25) as response:
    assert response.status == 200
for target in inputs["targets"]:
    try:
        connection = socket.create_connection(tuple(target), timeout=2)
    except OSError:
        continue
    connection.close()
    raise RuntimeError("Un servicio privado del host es accesible desde la VM")
print(f"GYMNASIA_AUDIT_PASS {nonce}", flush=True)
