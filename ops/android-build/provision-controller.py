#!/usr/bin/env python3
"""One bounded controller tick; installed code only, never a repository checkout."""
import argparse
import contextlib
import fcntl
import json
import os
import pathlib
import resource
import signal
import subprocess
import time

from github_app import APIError, GitHub, PREFIX, collection, find_runner
from provision_contract import candidate, request_identity, require, runner_name
from provision_state import State, save

ROOT = pathlib.Path("/var/lib/gymnasia-android")
CONTROL = ROOT / "control"
SOURCE = pathlib.Path(__file__).resolve().parent
UNIT = "gymnasia-android-smoke.service"
MAINTENANCE = pathlib.Path("/run/wallabot-maintenance.block")


def command(*args, check=True):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                            text=True, timeout=90, check=check)
    return result.stdout.strip()


def local_cleanup(state, image_lock=None):
    """Also called by systemd after SIGKILL. A durable lease owns this VM."""
    if not state.active.exists():
        return
    ledger = json.loads(state.active.read_text())
    require(ledger["runnerName"] == runner_name(ledger["identity"]))
    # Acquire ownership before stopping anything. When execute owns the lock,
    # run-smoke inherits the same open file description across exec.
    context = contextlib.nullcontext(image_lock) if image_lock is not None else open("/run/lock/gymnasia-android-image.lock", "a")
    with context as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        command("systemctl", "stop", UNIT, check=False)
        require(command("systemctl", "show", "--value", "-p", "ActiveState", UNIT) not in ["active", "activating", "deactivating"])
        for name in ["request.json", "empty.bin"]:
            (state.directory / name).unlink(missing_ok=True)
        for name in ["disk.qcow2", "seed.img", "request.json", "input.bin", "report.json", "output.bin", "transfer.json"]:
            (ROOT / "current" / name).unlink(missing_ok=True)
        pathlib.Path("/run/systemd/system/" + UNIT).unlink(missing_ok=True)
        command("systemctl", "daemon-reload")
        command("systemctl", "reset-failed", UNIT, check=False)
        command("sha256sum", "-c", str(ROOT / "base.sha256"))
        require(not list((ROOT / "current").iterdir()))


def remove_identity(api, ledger):
    found = find_runner(api, ledger["runnerName"])
    if found is None:
        return
    require(type(found["id"]) is int and found["id"] > 0)
    if ledger.get("runnerId"):
        require(found["id"] == ledger["runnerId"])
    current = api("GET", PREFIX + f"/actions/runners/{found['id']}")
    require(current["name"] == ledger["runnerName"] and current["id"] == found["id"])
    require(current["status"] == "offline" and current["busy"] is False,
            "Wait for GitHub to confirm that the stopped VM is offline")
    # If DELETE succeeds but its response is lost, next tick reconciles the
    # same reserved identity. It cannot mint another registration token.
    api("DELETE", PREFIX + f"/actions/runners/{found['id']}")
    require(find_runner(api, ledger["runnerName"]) is None, "Runner removal not confirmed")


def discover(api, repository_id):
    runs = api("GET", PREFIX + "/actions/workflows/build-apk.yml/runs?branch=main&per_page=20")["workflow_runs"]
    for run in reversed(runs):
        if run.get("status") == "completed":
            continue
        try:
            jobs = collection(api, PREFIX + f"/actions/runs/{int(run['id'])}/attempts/{int(run['run_attempt'])}/jobs", "jobs")
            pending = api("GET", PREFIX + f"/actions/runs/{int(run['id'])}/pending_deployments")
            yield candidate(run, jobs, repository_id, pending)
        except (ValueError, KeyError, TypeError):
            # Unapproved, foreign or incomplete jobs are ineligible. Never
            # interpret a remote field as a shell command or a local path.
            continue


def monitor(api, state, ledger, process, clock=time.monotonic, sleep=time.sleep):
    start = clock()
    assigned = False
    errors = 0
    completed_at = None
    while process.poll() is None:
        require(not MAINTENANCE.exists(), "Maintenance requested; stopping VM")
        require(clock() - start < 123 * 60, "VM lifetime exceeded")
        try:
            job = api("GET", PREFIX + f"/actions/jobs/{ledger['identity']['jobId']}")
            run = api("GET", PREFIX + f"/actions/runs/{ledger['identity']['runId']}")
            errors = 0
        except APIError:
            errors += 1
            require(errors <= 8, "GitHub state unavailable; stop rather than run unchecked")
            sleep(15)
            continue
        require(run["run_attempt"] == ledger["identity"]["runAttempt"])
        require(job["run_id"] == ledger["identity"]["runId"] and job["head_sha"] == ledger["identity"]["workflowSha"])
        if job.get("runner_id"):
            require(job["runner_name"] == ledger["runnerName"], "Job was assigned to another runner")
            if ledger.get("runnerId"):
                require(job["runner_id"] == ledger["runnerId"])
            elif not assigned:
                state.update(ledger, "running", runnerId=job["runner_id"])
            assigned = True
        if job["status"] == "completed":
            completed_at = completed_at or clock()
            if clock() - completed_at > 120:
                break
        else:
            require(run["status"] != "completed", "Run cancelled before assignment")
        require(assigned or clock() - start < 10 * 60, "Runner did not claim its reserved job")
        sleep(15)


def execute_locked(api, state, selected, repository_id, image_lock=None):
    # Re-read all gates immediately before issuance, rather than trusting an
    # earlier queue snapshot while another execution was being cleaned up.
    run = api("GET", PREFIX + f"/actions/runs/{selected['runId']}")
    jobs = collection(api, PREFIX + f"/actions/runs/{selected['runId']}/attempts/{selected['runAttempt']}/jobs", "jobs")
    pending = api("GET", PREFIX + f"/actions/runs/{selected['runId']}/pending_deployments")
    require(candidate(run, jobs, repository_id, pending) == selected)
    require(not MAINTENANCE.exists())
    ledger = state.reserve(selected)
    process = None
    try:
        require(find_runner(api, ledger["runnerName"]) is None)
        state.update(ledger, "token-requested")
        response = api("POST", PREFIX + "/actions/runners/registration-token")
        request = {"schemaVersion": 1, "mode": "run-job", **ledger["identity"],
                   "registrationToken": response["token"], "expiresAt": response["expires_at"]}
        response.clear()
        request_identity(request)
        save(state.directory / "request.json", request)
        request.clear()
        (state.directory / "empty.bin").touch(mode=0o600, exist_ok=False)
        state.update(ledger, "starting")
        require(image_lock is not None, "The VM lock must be inherited")
        process = subprocess.Popen(["/usr/bin/python3", str(SOURCE / "run-smoke.py"),
                                    str(state.directory / "request.json"), str(state.directory / "empty.bin"),
                                    str(image_lock.fileno())], pass_fds=(image_lock.fileno(),),
                                   stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        monitor(api, state, ledger, process)
        require(process.wait(timeout=10) == 0, "VM or cleanup verification failed")
        job = api("GET", PREFIX + f"/actions/jobs/{selected['jobId']}")
        require(job["status"] == "completed" and job["runner_name"] == ledger["runnerName"])
        require(job.get("runner_id") and job.get("conclusion") in ["success", "failure", "cancelled", "timed_out"])
        state.update(ledger, "vm-cleaned", runnerId=job["runner_id"], jobConclusion=job["conclusion"], vmExit=0)
    except BaseException as error:
        state.update(ledger, "needs-cleanup", errorType=type(error).__name__)
        raise
    finally:
        if process is not None and process.poll() is None:
            process.send_signal(signal.SIGINT)
            try:
                process.wait(timeout=90)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=10)
        local_cleanup(state, image_lock)
    remove_identity(api, ledger)
    state.close(ledger, "completed")
    print("PROVISION_JOB_CLOSED", selected["jobId"], ledger["jobConclusion"], flush=True)


def execute(api, state, selected, repository_id):
    with open("/run/lock/gymnasia-android-image.lock", "a") as image_lock:
        fcntl.flock(image_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        require(not MAINTENANCE.exists())
        for unit in [UNIT, "gymnasia-android-vm.service", "gymnasia-android-image.service"]:
            require(command("systemctl", "show", "--value", "-p", "ActiveState", unit) == "inactive")
        require(not list((ROOT / "current").iterdir()))
        require(not command("systemctl", "--failed", "--no-legend", "--plain"))
        execute_locked(api, state, selected, repository_id, image_lock)


def tick(api, state, repository_id):
    if state.active.exists():
        ledger = json.loads(state.active.read_text())
        local_cleanup(state)
        remove_identity(api, ledger)
        state.close(ledger, "completed" if ledger["state"] == "vm-cleaned" else "interrupted-no-retry")
        print("PROVISION_RECOVERY_CLOSED", ledger["identity"]["jobId"], flush=True)
    if MAINTENANCE.exists():
        print("PROVISION_MAINTENANCE", flush=True)
        return
    for selected in discover(api, repository_id):
        if state.path(selected["jobId"]).exists():
            print("PROVISION_JOB_ALREADY_ATTEMPTED", selected["jobId"], flush=True)
            continue
        execute(api, state, selected, repository_id)
        break


def main():
    require(os.getuid() == 0, "Run the installed controller through systemd")
    os.umask(0o077)
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(InterruptedError()))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["tick", "inspect", "cleanup-local"])
    args = parser.parse_args()
    state = State(CONTROL)
    require(not state.directory.is_symlink() and state.directory.stat().st_uid == 0
            and state.directory.stat().st_mode & 0o077 == 0, "Controller state must be private to root")
    if args.command == "cleanup-local":
        local_cleanup(state)
        return
    with open("/run/lock/gymnasia-android-controller.lock", "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        config_path = pathlib.Path("/etc/gymnasia-android/app.json")
        require(not config_path.is_symlink() and config_path.stat().st_uid == 0 and config_path.stat().st_mode & 0o022 == 0)
        config = json.loads(config_path.read_text())
        credentials = pathlib.Path(os.environ["CREDENTIALS_DIRECTORY"])
        api = GitHub(config, credentials / "github-app-key")
        if args.command == "inspect":
            print(json.dumps({"eligibleJobs": list(discover(api, config["repositoryId"]))}))
        else:
            tick(api, state, config["repositoryId"])


if __name__ == "__main__":
    try:
        main()
    except BaseException as error:
        # API payloads and guest stdout never appear in host logs.
        print("PROVISION_FAILED", type(error).__name__, flush=True)
        raise SystemExit(1)
