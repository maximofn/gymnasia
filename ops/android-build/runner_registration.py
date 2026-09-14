"""Offline registration probe. Never starts the listener or executes a job."""
import datetime
import json
import os
import pathlib
import re
import shutil
import subprocess

REPOSITORY = "maximofn/gymnasia"
RUNNER_VERSION = "2.337.0"


def validate_request(request, now=None):
    assert set(request) == {"schemaVersion", "mode", "nonce", "registrationToken", "expiresAt"}
    assert request["schemaVersion"] == 1 and request["mode"] == "register-probe"
    assert re.fullmatch(r"[a-f0-9]{32}", request["nonce"])
    assert isinstance(request["registrationToken"], str)
    assert re.fullmatch(r"[A-Za-z0-9_.-]{20,4096}", request["registrationToken"])
    expires = datetime.datetime.fromisoformat(request["expiresAt"].replace("Z", "+00:00"))
    assert expires.tzinfo is not None
    remaining = (expires - (now or datetime.datetime.now(datetime.timezone.utc))).total_seconds()
    assert 120 <= remaining <= 3900, "El token no tiene una vigencia aceptable"
    return "gymnasia-probe-" + request["nonce"]


def probe(request, log_path, actions=pathlib.Path("/home/runner/actions"), execute=subprocess.run):
    name = validate_request(request)
    assert not actions.is_symlink() and actions.is_dir()
    assert not any((actions / item).exists() for item in [".runner", ".credentials", ".credentials_rsaparams"])
    env = {key: os.environ[key] for key in ["PATH", "HOME"]}
    env["LANG"] = "C.UTF-8"
    try:
        with log_path.open("ab") as log:
            version = execute([str(actions / "bin/Runner.Listener"), "--version"], cwd=actions,
                              env=env, stdout=subprocess.PIPE, stderr=log, stdin=subprocess.DEVNULL,
                              timeout=30, text=True, check=True)
            assert version.stdout.strip() == RUNNER_VERSION
            # The pinned runner reads ACTIONS_RUNNER_INPUT_TOKEN and masks it
            # internally. Keep it out of argv, cloud-init and host diagnostics.
            env["ACTIONS_RUNNER_INPUT_TOKEN"] = request.pop("registrationToken")
            execute([str(actions / "config.sh"), "--unattended", "--url", "https://github.com/" + REPOSITORY,
                     "--name", name, "--ephemeral", "--disableupdate", "--labels", "wallabot,android-build",
                     "--work", "_work"], cwd=actions, env=env, stdout=log, stderr=log,
                    stdin=subprocess.DEVNULL, timeout=300, check=True)
        settings = json.loads((actions / ".runner").read_text())
        assert settings["agentName"] == name and settings["gitHubUrl"] == "https://github.com/" + REPOSITORY
        assert settings["ephemeral"] is True and settings["disableUpdate"] is True
        assert settings["workFolder"] == "_work"
        assert type(settings["agentId"]) is int and settings["agentId"] > 0
        result = {"id": settings["agentId"], "name": name, "ephemeral": True,
                  "disableUpdate": True, "version": RUNNER_VERSION, "listenerStarted": False}
    finally:
        env.clear()
        request.pop("registrationToken", None)
        # This directory lives exclusively in this disposable overlay. Remove
        # the entire runner, including its RSA identity and diagnostic files.
        shutil.rmtree(actions)
    assert not actions.exists()
    return {**result, "credentialsRemoved": True}
