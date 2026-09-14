#!/usr/bin/env python3
"""Run one approved registration probe in tmux; expose only sanitized evidence."""
import json
import os
import pathlib
import pwd
import resource
import shutil
import signal
import subprocess
import sys
import tempfile

from runner_registration import validate_request


def main():
    assert os.getuid() == 0 and len(sys.argv) == 2, "sudo python3 registration-host.py INPUTS"
    os.umask(0o077)
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(143))
    inputs = pathlib.Path(sys.argv[1]).resolve()
    marker = inputs / "registration-attempt.json"
    assert not marker.exists(), "Ya se utilizó este intento; reconciliarlo antes de preparar otro"
    request_path = inputs / "request.json"
    request = json.loads(request_path.read_text())
    name = validate_request(request)
    assert request_path.stat().st_mode & 0o077 == 0
    identity = {"nonce": request["nonce"], "runnerName": name}
    request.clear()
    marker.write_text(json.dumps({**identity, "state": "started"}))
    evidence = None
    process = None
    try:
        process = subprocess.Popen(["python3", str(pathlib.Path(__file__).with_name("run-smoke.py")),
                                    str(request_path), str(inputs / "empty.bin")],
                                   stdout=subprocess.PIPE, text=True, start_new_session=True)
        for line in process.stdout:
            print(line, end="", flush=True)
            if line.startswith("GYMNASIA_SMOKE_STARTED register-probe "):
                evidence = pathlib.Path(line.strip().split(" ", 2)[2])
        assert process.wait() == 0 and evidence is not None, "Falló la prueba; reconciliar el registro en GitHub"
        report = json.loads((evidence / "report.json").read_text())
        assert set(report) == {"mode", "result", "nonce", "registration"}
        assert report["mode"] == "register-probe" and report["result"] == "passed" and report["nonce"] == identity["nonce"]
        info = report["registration"]
        assert set(info) == {"id", "name", "ephemeral", "disableUpdate", "version", "listenerStarted", "credentialsRemoved"}
        assert info["name"] == name and info["credentialsRemoved"] is True and info["listenerStarted"] is False
        assert json.loads((evidence / "before.json").read_text()) == json.loads((evidence / "after.json").read_text())
        assert not list(pathlib.Path("/var/lib/gymnasia-android/current").iterdir())
        result = pathlib.Path(tempfile.mkdtemp(prefix="gymnasia-registration-result.", dir="/var/tmp"))
        (result / "report.json").write_text(json.dumps(report, indent=2))
        caller = pwd.getpwuid(int(os.environ["SUDO_UID"]))
        shutil.chown(result, "root", caller.pw_gid); result.chmod(0o750)
        shutil.chown(result / "report.json", "root", caller.pw_gid); (result / "report.json").chmod(0o640)
        marker.write_text(json.dumps({**identity, "state": "guest-verified", "evidence": str(evidence)}))
        print("GYMNASIA_REGISTRATION_GUEST_VERIFIED " + str(result), flush=True)
        print("Pendiente: confirmar y retirar esta identidad en GitHub desde el Mac.", flush=True)
    except BaseException:
        if process is not None and process.poll() is None:
            process.send_signal(signal.SIGINT)
            remaining, _ = process.communicate(timeout=60)
            print(remaining, end="", flush=True)
        marker.write_text(json.dumps({**identity, "state": "failed-needs-github-cleanup"}))
        raise
    finally:
        request_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
