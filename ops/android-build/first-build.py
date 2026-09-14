#!/usr/bin/env python3
"""Manual signed smoke: transport probe, old APK, compile, fresh-VM verification."""
import hashlib
import json
import os
import pathlib
import pwd
import resource
import shutil
import subprocess
import sys
import tempfile
import uuid

SOURCE = pathlib.Path(__file__).resolve().parent


def main():
    assert os.getuid() == 0 and len(sys.argv) == 3, "sudo python3 first-build.py INPUTS CREDENTIAL_FILE"
    os.umask(0o077)
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    inputs = pathlib.Path(sys.argv[1]).resolve()
    credential_path = pathlib.Path(sys.argv[2]).resolve()
    marker = inputs / "signed-attempt.json"
    assert not marker.exists(), "Ya se intentó esta build: revisar el resultado y documentar un reintento manual"
    assert credential_path.stat().st_mode & 0o077 == 0
    credential = credential_path.read_text().strip()
    assert credential and len(credential) < 16384 and "\n" not in credential
    credential_path.unlink()
    private = pathlib.Path(tempfile.mkdtemp(prefix="gymnasia-first-build.", dir="/run"))
    verified_directory = pathlib.Path(tempfile.mkdtemp(prefix="gymnasia-first-build.", dir="/var/tmp"))
    results = []

    def stage(request, artifact):
        request_path = private / (uuid.uuid4().hex + ".json")
        request_path.write_text(json.dumps(request))
        process = subprocess.Popen(["python3", str(SOURCE / "run-smoke.py"), str(request_path), str(artifact)],
                                   stdout=subprocess.PIPE, text=True)
        evidence = None
        for line in process.stdout:
            print(line, end="", flush=True)
            if line.startswith("GYMNASIA_SMOKE_STARTED "):
                evidence = pathlib.Path(line.strip().split(" ", 2)[2])
        status = process.wait()
        assert status == 0 and evidence is not None, "Fallo de la prueba; no se reintenta ni se publica"
        report = json.loads((evidence / "report.json").read_text())
        assert report["result"] == "passed"
        transfer = json.loads((evidence / "transfer.json").read_text())
        with (evidence / "output.bin").open("rb") as artifact_file:
            digest = hashlib.file_digest(artifact_file, "sha256").hexdigest()
        assert digest == transfer["artifact"]["sha256"]
        results.append({"mode": request["mode"], "evidence": str(evidence)})
        request_path.unlink(missing_ok=True)
        return evidence, report

    try:
        probe = json.loads((inputs / "probe-request.json").read_text())
        evidence, _ = stage(probe, inputs / "probe.bin")
        with (evidence / "output.bin").open("rb") as stream:
            assert hashlib.file_digest(stream, "sha256").hexdigest() == probe["inputSha256"]
        baseline = json.loads((inputs / "baseline-request.json").read_text())
        assert baseline["mode"] == "verify" and baseline["requireProgression"] is False
        _, baseline_report = stage(baseline, inputs / "baseline.apk")
        build = json.loads((inputs / "build-template.json").read_text())
        assert build["mode"] == "build" and build["sourceCommit"] == baseline["sourceCommit"]
        build["expoToken"] = credential
        credential = None
        marker.write_text(json.dumps({"nonce": build["nonce"], "sourceCommit": build["sourceCommit"], "state": "started"}))
        evidence, build_report = stage(build, inputs / "empty.bin")
        build.pop("expoToken", None)
        verify = {**baseline, "nonce": uuid.uuid4().hex, "requireProgression": True,
                  "inputSha256": build_report["artifactSha256"]}
        _, report = stage(verify, evidence / "output.bin")
        artifact = report["verification"]["artifact"]
        previous = baseline_report["verification"]["artifact"]
        assert artifact["sha256"] == build_report["artifactSha256"]
        assert artifact["certificateSha256"] == previous["certificateSha256"]
        assert int(artifact["versionCode"]) > int(previous["versionCode"])
        shutil.copyfile(evidence / "output.bin", verified_directory / "gymnasia.apk")
        (verified_directory / "production-artifact-evidence.json").write_text(json.dumps(report["verification"], indent=2))
        marker.write_text(json.dumps({"nonce": build["nonce"], "state": "verified", "artifactSha256": artifact["sha256"]}))
        # Expose only the verified APK and non-secret verification to the human
        # who ran sudo. Private host evidence remains root-only in other dirs.
        caller = pwd.getpwuid(int(os.environ["SUDO_UID"]))
        shutil.chown(verified_directory, user="root", group=caller.pw_gid)
        verified_directory.chmod(0o750)
        for path in verified_directory.iterdir():
            shutil.chown(path, user="root", group=caller.pw_gid)
            path.chmod(0o640)
        print(f"GYMNASIA_FIRST_BUILD_VERIFIED {verified_directory}", flush=True)
        print(f"versionCode={artifact['versionCode']} sha256={artifact['sha256']}", flush=True)
    finally:
        credential = None
        credential_path.unlink(missing_ok=True)
        shutil.rmtree(private)
        # Paths/status only; never save any request containing a credential.
        (inputs / "smoke-stages.json").write_text(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
