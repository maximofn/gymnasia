#!/usr/bin/env python3
"""Credential-free native probe under the controller's real systemd limits."""
import hashlib
import json
import pathlib
import shutil
import subprocess
import tempfile
import uuid

from provision_contract import require

root = pathlib.Path("/var/lib/gymnasia-android/control")
require(not (root / "active.json").exists())
inputs = pathlib.Path(tempfile.mkdtemp(prefix="audit-", dir=root))
payload = b"gymnasia-controller-native-audit\n" * 100
try:
    (inputs / "request.json").write_text(json.dumps({"mode": "probe", "nonce": uuid.uuid4().hex,
        "inputSha256": hashlib.sha256(payload).hexdigest()}))
    (inputs / "input.bin").write_bytes(payload)
    process = subprocess.Popen(["/usr/bin/python3", "/usr/local/lib/gymnasia-android/run-smoke.py",
                                str(inputs / "request.json"), str(inputs / "input.bin")],
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    evidence = None
    with (root / "native-probe.log").open("w") as log:
        for line in process.stdout:
            log.write(line)
            log.flush()
            if line.startswith("GYMNASIA_SMOKE_STARTED probe "):
                evidence = pathlib.Path(line.strip().split(" ", 2)[2])
                print("CONTROLLER_AUDIT_VM_STARTED", flush=True)
            elif line.startswith(("GYMNASIA_SMOKE_RESULT", "GYMNASIA_SMOKE_PHASE")):
                print(line.strip(), flush=True)
    require(process.wait() == 0 and evidence is not None, "Native controller audit failed")
    require((evidence / "output.bin").read_bytes() == payload)
    require(json.loads((evidence / "before.json").read_text()) == json.loads((evidence / "after.json").read_text()))
    require(not list(pathlib.Path("/var/lib/gymnasia-android/current").iterdir()))
    print("CONTROLLER_NATIVE_AUDIT_PASSED", flush=True)
finally:
    shutil.rmtree(inputs)
