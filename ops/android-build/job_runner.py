"""One ephemeral Actions listener, exclusively inside the disposable guest."""
import json
import os
import pathlib
import shutil
import subprocess

from provision_contract import REPOSITORY, job_label, request_identity, runner_name, require
from runner_registration import RUNNER_VERSION


def run_job(request, log_path, actions=pathlib.Path("/home/runner/actions"), execute=subprocess.run,
            expected_path=pathlib.Path("/etc/gymnasia-job.json")):
    expected = request_identity(request)
    require(json.loads(expected_path.read_text()) == expected)
    require(os.getuid() != 0 and not actions.is_symlink() and actions.is_dir())
    require(not any((actions / item).exists() for item in [".runner", ".credentials", ".credentials_rsaparams"]))
    env = {key: os.environ[key] for key in ["PATH", "HOME"]}
    env["LANG"] = "C.UTF-8"
    for key in ["JAVA_HOME", "ANDROID_HOME", "ANDROID_SDK_ROOT"]:
        if key in os.environ:
            env[key] = os.environ[key]
    name = runner_name(expected)
    try:
        with log_path.open("ab") as log:
            version = execute([str(actions / "bin/Runner.Listener"), "--version"], cwd=actions,
                              env=env, stdout=subprocess.PIPE, stderr=log, stdin=subprocess.DEVNULL,
                              timeout=30, text=True, check=True)
            require(version.stdout.strip() == RUNNER_VERSION)
            env["ACTIONS_RUNNER_INPUT_TOKEN"] = request.pop("registrationToken")
            execute([str(actions / "config.sh"), "--unattended", "--url", "https://github.com/" + REPOSITORY,
                     "--name", name, "--ephemeral", "--disableupdate", "--labels",
                     "wallabot,android-build," + job_label(expected), "--work", "_work"],
                    cwd=actions, env=env, stdout=log, stderr=log, stdin=subprocess.DEVNULL,
                    timeout=300, check=True)
            env.pop("ACTIONS_RUNNER_INPUT_TOKEN")
            settings = json.loads((actions / ".runner").read_text(encoding="utf-8-sig"))
            require(settings["agentName"] == name and settings["gitHubUrl"] == "https://github.com/" + REPOSITORY)
            require(settings["ephemeral"] is True and settings["disableUpdate"] is True and settings["workFolder"] == "_work")
            require(type(settings["agentId"]) is int and settings["agentId"] > 0)
            runner_id = settings["agentId"]
            env["ACTIONS_RUNNER_HOOK_JOB_STARTED"] = "/usr/local/lib/gymnasia/admit-job.sh"
            # Output stays inside the overlay. Actions receives job logs through
            # its native protocol; the host never ingests raw guest diagnostics.
            execute([str(actions / "run.sh")], cwd=actions, env=env, stdout=log, stderr=log,
                    stdin=subprocess.DEVNULL, timeout=110 * 60, check=True)
    finally:
        env.clear()
        request.pop("registrationToken", None)
        shutil.rmtree(actions)
    require(not actions.exists())
    return {"id": runner_id, "name": name, "ephemeral": True, "disableUpdate": True,
            "version": RUNNER_VERSION, "listenerStarted": True, "credentialsRemoved": True}
