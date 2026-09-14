#!/usr/bin/env python3
"""Human-authorized, one-shot token issuance and exact runner removal from the Mac."""
import argparse
import datetime
import json
import os
import pathlib
import resource
import subprocess
import uuid

from runner_registration import REPOSITORY, RUNNER_VERSION, validate_request

ENDPOINT = "repos/" + REPOSITORY + "/actions/runners"


def api(method, endpoint, *, paginate=False):
    args = ["gh", "api", "--hostname", "github.com", "--method", method,
            "-H", "Accept: application/vnd.github+json", "-H", "X-GitHub-Api-Version: 2026-03-10", endpoint]
    if paginate:
        args += ["--paginate", "--slurp"]
    result = subprocess.run(args, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=60)
    if result.returncode:
        raise RuntimeError("La operación de GitHub falló; no se reintenta automáticamente")
    return json.loads(result.stdout) if result.stdout.strip() else None


def private_json(path, value):
    temporary = path.with_name(path.name + "." + uuid.uuid4().hex)
    with os.fdopen(os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as output:
        json.dump(value, output, indent=2)
        output.flush()
        os.fsync(output.fileno())
    os.replace(temporary, path)


def matching_runner(name, call):
    pages = call("GET", ENDPOINT + "?per_page=100", paginate=True)
    matches = [runner for page in pages for runner in page["runners"] if runner["name"] == name]
    assert len(matches) <= 1, "Identidad de runner ambigua"
    return matches[0] if matches else None


def prepare(directory, call=api):
    directory.mkdir(mode=0o700)  # exclusive: a used attempt is never reissued
    nonce = uuid.uuid4().hex
    name = "gymnasia-probe-" + nonce
    ledger = {"schemaVersion": 1, "nonce": nonce, "runnerName": name,
              "repository": REPOSITORY, "state": "prepared", "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    private_json(directory / "attempt.json", ledger)
    assert matching_runner(name, call) is None
    ledger["state"] = "token-requested"
    private_json(directory / "attempt.json", ledger)
    # This is the only token-issuing call; never retry an uncertain response.
    response = call("POST", ENDPOINT + "/registration-token")
    request = {"schemaVersion": 1, "mode": "register-probe", "nonce": nonce,
               "registrationToken": response["token"], "expiresAt": response["expires_at"]}
    response.clear()
    validate_request(request)
    private_json(directory / "request.json", request)
    request.clear()
    (directory / "empty.bin").touch(mode=0o600, exist_ok=False)
    ledger["state"] = "token-issued"
    private_json(directory / "attempt.json", ledger)
    return {"state": ledger["state"], "runnerName": name}


def finish(directory, report_path=None, call=api):
    ledger_path = directory / "attempt.json"
    ledger = json.loads(ledger_path.read_text())
    assert ledger["schemaVersion"] == 1 and ledger["repository"] == REPOSITORY
    assert ledger["runnerName"] == "gymnasia-probe-" + uuid.UUID(hex=ledger["nonce"]).hex
    if ledger["state"] in ["verified-and-removed", "failed-and-removed"]:
        return {"state": ledger["state"], "runnerName": ledger["runnerName"]}
    assert ledger["state"] in ["token-requested", "token-issued", "removal-requested"]
    try:
        runner = matching_runner(ledger["runnerName"], call)
        # The guest cannot choose a deletion target. It is independently
        # resolved from the random name reserved before token issuance.
        if runner:
            assert type(runner["id"]) is int and runner["id"] > 0
            assert runner["busy"] is False and runner["status"] == "offline", "No retirar un runner ocupado o activo"
            if ledger["state"] != "removal-requested":
                try:
                    report = json.loads(report_path.read_text()) if report_path else {}
                    if not isinstance(report, dict):
                        report = {}
                except (OSError, ValueError):
                    report = {}
                info = report.get("registration", {})
                labels = {label["name"].lower() for label in runner.get("labels", [])}
                ledger["verified"] = (
                    report.get("mode") == "register-probe" and report.get("result") == "passed"
                    and report.get("nonce") == ledger["nonce"]
                    and info == {"id": runner["id"], "name": ledger["runnerName"], "ephemeral": True,
                                 "disableUpdate": True, "version": RUNNER_VERSION, "listenerStarted": False,
                                 "credentialsRemoved": True}
                    and runner.get("ephemeral") is True
                    and runner.get("version") == RUNNER_VERSION
                    and labels == {"self-hosted", "linux", "x64", "wallabot", "android-build"})
            else:
                assert ledger["runnerId"] == runner["id"]
            ledger.update({"state": "removal-requested", "runnerId": runner["id"]})
            private_json(ledger_path, ledger)
            call("DELETE", ENDPOINT + "/" + str(runner["id"]))
            assert matching_runner(ledger["runnerName"], call) is None, "La retirada no quedó confirmada"
        # If a DELETE succeeded but its response was lost, a subsequent finish
        # can confirm absence without registering another runner.
        ledger["state"] = "verified-and-removed" if ledger.get("verified") else "failed-and-removed"
        private_json(ledger_path, ledger)
        return {"state": ledger["state"], "runnerName": ledger["runnerName"]}
    finally:
        (directory / "request.json").unlink(missing_ok=True)


def main():
    os.umask(0o077)
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    start = commands.add_parser("prepare", help="Requires explicit maintainer authorization first")
    start.add_argument("--authorized-registration", action="store_true", required=True)
    start.add_argument("directory", type=pathlib.Path)
    end = commands.add_parser("finish", help="Verify and remove only the runner belonging to this attempt")
    end.add_argument("directory", type=pathlib.Path)
    end.add_argument("--report", type=pathlib.Path)
    args = parser.parse_args()
    try:
        result = prepare(args.directory) if args.command == "prepare" else finish(args.directory, args.report)
        print(json.dumps(result))
        return 1 if result["state"] == "failed-and-removed" else 0
    except Exception as error:
        # Never print token responses, subprocess output, request bodies or
        # arbitrary exception messages, even when registration fails.
        print("REGISTRATION_CONTROL_FAILED " + type(error).__name__)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
