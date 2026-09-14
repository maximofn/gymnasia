#!/usr/bin/env python3
"""Manual compile or independent verification, always as the unprivileged runner."""
import base64
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess

from importlib.machinery import SourceFileLoader

channel = SourceFileLoader("channel", "/opt/gymnasia/smoke-channel.py").load_module()
ROOT = pathlib.Path("/home/runner/smoke")
SOURCE = ROOT / "source"
phase = "inputs"


def progress(name):
    global phase
    phase = name
    print("GYMNASIA_SMOKE_PHASE " + name, flush=True)


def run(args, *, cwd=SOURCE, env=None, timeout=1200):
    with (ROOT / "private.log").open("ab") as log:
        result = subprocess.run(args, cwd=cwd, env=env, stdout=log, stderr=log,
                                stdin=subprocess.DEVNULL, timeout=timeout)
    if result.returncode:
        raise RuntimeError("command-failed")


def sha(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def main():
    assert os.getuid() != 0 and subprocess.check_output(["id", "-nG"], text=True).strip() == "runner"
    assert not any(pathlib.Path(p).exists() for p in ["/dev/kvm", "/dev/nvidia0", "/var/run/docker.sock"])
    assert not pathlib.Path("/home/runner/actions/.runner").exists()
    os.umask(0o077)
    ROOT.mkdir(mode=0o700)
    stream = open("/dev/virtio-ports/gymnasia.transfer", "r+b", buffering=0)
    channel.receive(stream, ROOT / "request.json", 1024 * 1024)
    channel.receive(stream, ROOT / "input.bin", channel.LIMIT)
    request = json.loads((ROOT / "request.json").read_text())
    (ROOT / "request.json").unlink()
    mode = request["mode"]
    assert mode in ["probe", "build", "verify"]
    report = {"mode": mode, "result": "failed", "nonce": request["nonce"]}
    output = ROOT / "output.bin"
    output.touch()
    try:
        if mode == "probe":
            assert sha(ROOT / "input.bin") == request["inputSha256"]
            shutil.copyfile(ROOT / "input.bin", output)
        else:
            commit = request["sourceCommit"]
            assert re.fullmatch("[a-f0-9]{40}", commit)
            progress("checkout")
            run(["git", "init", str(SOURCE)], cwd=ROOT)
            run(["git", "remote", "add", "origin", "https://github.com/maximofn/gymnasia.git"])
            run(["git", "fetch", "--depth=1", "origin", commit])
            run(["git", "checkout", "--detach", "FETCH_HEAD"])
            assert subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=SOURCE, text=True).strip() == commit
            inputs = ROOT / "inputs"
            inputs.mkdir()
            for name in ["production-source-evidence.json", "production-policy-snapshot.json", "previous-artifact-evidence.json"]:
                data = base64.b64decode(request["files"][name], validate=True)
                assert hashlib.sha256(data).hexdigest() == request["digests"][name]
                (inputs / name).write_bytes(data)
            evidence = json.loads((inputs / "production-source-evidence.json").read_text())
            assert evidence["result"] == "passed" and evidence["commit"] == commit
            assert evidence["repository"] == "maximofn/gymnasia" and evidence["ref"] == "refs/heads/main"
            assert evidence["profile"] == "production-apk" and all(g["result"] == "passed" for g in evidence["gates"])
            if mode == "build":
                assert subprocess.check_output(["node", "--version"], text=True).strip() == "v22.23.1"
                assert subprocess.check_output(["npm", "--version"], text=True).strip() == "10.9.3"
                assert "eas-cli/24.3.0 " in subprocess.check_output(["eas", "--version"], text=True)
                java = subprocess.run(["java", "-version"], capture_output=True, text=True, check=True)
                assert 'version "17.0.20.1"' in java.stderr
                assert json.loads((SOURCE / "apps/mobile/eas.json").read_text())["cli"]["appVersionSource"] == "remote"
                progress("dependencias")
                run(["npm", "ci", "--no-audit", "--no-fund"])
                assert not subprocess.check_output(["git", "status", "--porcelain"], cwd=SOURCE)
                # Four explicit snapshot paths; never extract arbitrary archive
                # names from remote data into the checkout.
                for name, encoded in request["snapshotFiles"].items():
                    assert name in ["chatSystemPrompt.generated.ts", "healthSafetyPolicy.generated.ts",
                                    "policySnapshot.generated.json", "signedPolicySnapshot.generated.ts"]
                    data = base64.b64decode(encoded, validate=True)
                    assert hashlib.sha256(data).hexdigest() == request["snapshotDigests"][name]
                    (SOURCE / "apps/mobile/agent/generated" / name).write_bytes(data)
                assert len(request["snapshotFiles"]) == 4
                progress("compilacion-local")
                env = {key: os.environ[key] for key in ["PATH", "HOME", "JAVA_HOME", "ANDROID_HOME", "ANDROID_SDK_ROOT"]}
                env.update({"LANG": "C.UTF-8", "CI": "1", "APP_ENV": "production", "EXPO_NO_TELEMETRY": "1",
                            "EXPO_TOKEN": request.pop("expoToken"), "TMPDIR": str(ROOT),
                            "EAS_LOCAL_BUILD_WORKINGDIR": str(ROOT / "work"), "EAS_LOCAL_BUILD_SKIP_CLEANUP": "0",
                            "ANDROID_NDK_HOME": "/opt/android/ndk/27.1.12297006",
                            "GRADLE_USER_HOME": str(ROOT / "gradle"),
                            "GRADLE_OPTS": "-Dorg.gradle.daemon=false -Dorg.gradle.workers.max=4 -Dorg.gradle.jvmargs=-Xmx4g"})
                output.unlink()
                run(["eas", "build", "--platform", "android", "--profile", "production-apk", "--local",
                     "--non-interactive", "--freeze-credentials", "--output", str(output)],
                    cwd=SOURCE / "apps/mobile", env=env, timeout=100 * 60)
                env.clear()
                assert output.is_file() and 1_000_000 < output.stat().st_size <= channel.LIMIT
                report.update({"sourceCommit": commit, "profile": "production-apk", "artifactSha256": sha(output),
                               "artifactSize": output.stat().st_size})
            else:
                progress("verificacion-nativa")
                assert sha(ROOT / "input.bin") == request["inputSha256"]
                run(["node", "scripts/production-release/verify-artifact.mjs", "--artifact", str(ROOT / "input.bin"),
                     "--kind", "apk", "--published-filename", "gymnasia.apk", "--source-evidence",
                     str(inputs / "production-source-evidence.json"), "--snapshot",
                     str(inputs / "production-policy-snapshot.json"), "--output", str(ROOT / "evidence.json")])
                verified = json.loads((ROOT / "evidence.json").read_text())
                previous = json.loads((inputs / "previous-artifact-evidence.json").read_text())
                assert verified["result"] == previous["result"] == "passed"
                assert verified["artifact"]["packageName"] == previous["artifact"]["packageName"] == "com.maximofn.gymnasia"
                assert verified["artifact"]["certificateSha256"].lower() == previous["artifact"]["certificateSha256"].lower()
                if request.get("requireProgression", True):
                    assert int(verified["artifact"]["versionCode"]) > int(previous["artifact"]["versionCode"])
                report["verification"] = verified
            progress("completado")
        report["result"] = "passed"
    except Exception as error:
        # Do not forward command output, exception text, env, or the EAS log.
        report.update({"phase": phase, "errorType": type(error).__name__})
        output.write_bytes(b"")
    finally:
        request.clear()
        (ROOT / "private.log").unlink(missing_ok=True)
        (ROOT / "report.json").write_text(json.dumps(report))
        channel.send(stream, ROOT / "report.json")
        channel.send(stream, output)
        assert channel.exact(stream, 2) == b"OK"
        shutil.rmtree(ROOT)
        stream.close()


if __name__ == "__main__":
    main()
