"""Crash-safe reservation. One VM attempt per queued job; never retry a build."""
import json
import os
import pathlib
import uuid

from provision_contract import identity, positive, runner_name, require


def save(path, value):
    temporary = path.with_name(path.name + "." + uuid.uuid4().hex)
    with os.fdopen(os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as output:
        json.dump(value, output, indent=2)
        output.flush()
        os.fsync(output.fileno())
    os.replace(temporary, path)
    descriptor = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


class State:
    def __init__(self, directory):
        self.directory = pathlib.Path(directory)
        self.directory.mkdir(mode=0o700, exist_ok=True)
        self.active = self.directory / "active.json"

    def path(self, job_id):
        positive(job_id)
        return self.directory / f"job-{job_id}.json"

    def reserve(self, selected):
        identity(selected)
        require(not self.active.exists(), "Recover the previous VM first")
        path = self.path(selected["jobId"])
        require(not path.exists(), "This job already has a durable attempt; no automatic retry")
        expected = {**selected, "nonce": uuid.uuid4().hex}
        ledger = {"schemaVersion": 1, "identity": expected, "runnerName": runner_name(expected), "state": "reserved"}
        # A crash between these writes leaves a reservation that is never
        # reissued. No remote mutation has occurred yet.
        save(path, ledger)
        save(self.active, ledger)
        return ledger

    def update(self, ledger, status, **fields):
        require(set(fields) <= {"runnerId", "jobConclusion", "vmExit", "errorType"})
        ledger.update({"state": status, **fields})
        save(self.path(ledger["identity"]["jobId"]), ledger)
        save(self.active, ledger)

    def close(self, ledger, status, **fields):
        self.update(ledger, status, **fields)
        self.active.unlink()
        descriptor = os.open(self.directory, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
