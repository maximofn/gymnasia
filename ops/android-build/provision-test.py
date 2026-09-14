#!/usr/bin/env python3
"""Deterministic provisioning tests: no network, sudo, VM or real credential."""
import datetime
import fcntl
import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

import job_runner
from github_app import APIError, GitHub, PERMISSIONS, PREFIX, collection
from provision_contract import LABELS, REPOSITORY, WORKFLOW, admit, candidate, job_label, request_identity, runner_name
from provision_state import State, save

spec = importlib.util.spec_from_file_location("controller", pathlib.Path(__file__).with_name("provision-controller.py"))
controller = importlib.util.module_from_spec(spec)
spec.loader.exec_module(controller)

SHA = "b" * 40
TOKEN = "fake_registration_" + "x" * 40
IDENTITY = {"runId": 11, "runAttempt": 1, "jobId": 22, "workflowSha": SHA, "nonce": "0" * 32}


def fixture():
    repository = {"id": 33, "full_name": REPOSITORY}
    run = {"id": 11, "run_attempt": 1, "head_sha": SHA, "head_branch": "main", "event": "push",
           "path": WORKFLOW, "status": "in_progress", "repository": repository.copy(),
           "head_repository": repository.copy(), "pull_requests": []}
    jobs = [{"id": number, "name": name, "run_id": 11, "head_sha": SHA,
             "status": "completed", "conclusion": "success"} for number, name in
            enumerate(["select-transaction", "validate-production", "prepare-production"], 1)]
    jobs.append({"id": 22, "name": "compile-android", "run_id": 11, "head_sha": SHA,
                 "head_branch": "main", "status": "queued", "runner_id": 0, "runner_name": "",
                 "labels": list(LABELS | {job_label(IDENTITY)})})
    return run, jobs


def expires():
    return (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=50)).isoformat()


class FakeAPI:
    def __init__(self):
        self.run, self.jobs = fixture()
        self.runners, self.calls = [], []
        self.lose_post = False
        self.lose_delete = False

    def __call__(self, method, path, data=None):
        self.calls.append((method, path))
        if method == "POST":
            assert path == PREFIX + "/actions/runners/registration-token"
            if self.lose_post:
                raise APIError()
            return {"token": TOKEN, "expires_at": expires()}
        if method == "DELETE":
            assert path == PREFIX + "/actions/runners/44"
            self.runners = []
            if self.lose_delete:
                raise APIError()
            return None
        assert method == "GET"
        if "pending_deployments" in path:
            return []
        if "/attempts/1/jobs?" in path:
            return {"total_count": len(self.jobs), "jobs": self.jobs}
        if "/workflows/build-apk.yml/runs?" in path:
            return {"workflow_runs": [self.run]}
        if path == PREFIX + "/actions/runs/11":
            return self.run
        if path == PREFIX + "/actions/jobs/22":
            return self.jobs[-1]
        if path == PREFIX + "/actions/runners/44":
            return self.runners[0]
        if "/actions/runners?" in path:
            return {"total_count": len(self.runners), "runners": self.runners}
        raise AssertionError(path)


class ContractTests(unittest.TestCase):
    def test_only_current_approved_job_with_exclusive_labels_is_selected(self):
        run, jobs = fixture()
        self.assertEqual(candidate(run, jobs, 33, []), IDENTITY)
        for patch_data in [{"event": "pull_request"}, {"event": "pull_request_target"}, {"head_branch": "feature"},
                           {"path": ".github/workflows/other.yml"}, {"pull_requests": [{"id": 1}]},
                           {"head_repository": {"id": 99, "full_name": "fork/gymnasia"}},
                           {"repository": {"id": 99, "full_name": REPOSITORY}}, {"run_attempt": 2}]:
            with self.subTest(patch_data=patch_data), self.assertRaises(ValueError):
                candidate({**run, **patch_data}, jobs, 33, [])
        with self.assertRaises(ValueError):
            candidate(run, jobs, 33, [{"environment": {"name": "Production"}}])

    def test_prerequisite_failure_missing_duplicate_or_wrong_attempt_is_rejected(self):
        for modify in [lambda js: js.pop(0), lambda js: js.append(js[0].copy()),
                       lambda js: js[1].update(conclusion="failure"), lambda js: js[1].update(head_sha="c" * 40),
                       lambda js: js[-1].update(runner_id=99), lambda js: js[-1].update(labels=list(LABELS)),
                       lambda js: js[-1].update(status="in_progress")]:
            run, jobs = fixture()
            modify(jobs)
            with self.assertRaises((ValueError, KeyError)):
                candidate(run, jobs, 33, [])

    def test_guest_hook_binds_run_attempt_and_workflow_sha_before_checkout(self):
        env = {"GITHUB_REPOSITORY": REPOSITORY, "GITHUB_REF": "refs/heads/main",
               "GITHUB_WORKFLOW_REF": f"{REPOSITORY}/{WORKFLOW}@refs/heads/main", "GITHUB_JOB": "compile-android",
               "GITHUB_RUN_ID": "11", "GITHUB_RUN_ATTEMPT": "1", "GITHUB_SHA": SHA, "GITHUB_EVENT_NAME": "push"}
        admit(IDENTITY, env)
        for key in env:
            with self.subTest(key=key), self.assertRaises(ValueError):
                admit(IDENTITY, {**env, key: "wrong"})

    def test_token_schema_excludes_other_secrets_and_expired_requests(self):
        request = {"schemaVersion": 1, "mode": "run-job", **IDENTITY, "registrationToken": TOKEN, "expiresAt": expires()}
        self.assertEqual(request_identity(request), IDENTITY)
        for extra in [{"expoToken": TOKEN}, {"repository": "fork/app"}, {"nonce": "../x"},
                      {"expiresAt": "2000-01-01T00:00:00Z"}, {"registrationToken": TOKEN + "\n"}]:
            with self.subTest(extra=list(extra)), self.assertRaises(ValueError):
                request_identity({**request, **extra})


class StateTests(unittest.TestCase):
    def test_lock_passed_across_exec_keeps_the_same_exclusive_vm_ownership(self):
        with tempfile.TemporaryDirectory() as folder, open(pathlib.Path(folder) / "lock", "a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            child = subprocess.run([sys.executable, "-c",
                "import fcntl,sys; fcntl.flock(int(sys.argv[1]),fcntl.LOCK_EX|fcntl.LOCK_NB)", str(lock.fileno())],
                pass_fds=(lock.fileno(),), capture_output=True)
            self.assertEqual(child.returncode, 0)
            competitor = subprocess.run([sys.executable, "-c",
                "import fcntl,sys; f=open(sys.argv[1],'a'); fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB)", lock.name],
                capture_output=True)
            self.assertNotEqual(competitor.returncode, 0)

    def test_reservation_survives_restart_and_cannot_reissue_even_after_close(self):
        with tempfile.TemporaryDirectory() as folder:
            state = State(folder)
            ledger = state.reserve(IDENTITY)
            self.assertEqual(json.loads(state.active.read_text()), ledger)
            state = State(folder)
            with self.assertRaises(ValueError):
                state.reserve(IDENTITY)
            state.close(ledger, "interrupted-no-retry")
            with self.assertRaises(ValueError):
                state.reserve(IDENTITY)
            self.assertNotIn(TOKEN, state.path(22).read_text())
            self.assertEqual(state.path(22).stat().st_mode & 0o777, 0o600)

    def test_lost_registration_response_cleans_up_without_issuing_again(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(controller, "local_cleanup"), \
                patch.object(controller, "MAINTENANCE", pathlib.Path(folder) / "maintenance"):
            state, api = State(folder), FakeAPI()
            api.lose_post = True
            with self.assertRaises(APIError):
                controller.execute_locked(api, state, IDENTITY, 33)
            self.assertTrue(state.active.exists())
            controller.tick(api, state, 33)
            self.assertFalse(state.active.exists())
            self.assertEqual(sum(method == "POST" for method, _ in api.calls), 1)
            self.assertEqual(json.loads(state.path(22).read_text())["state"], "interrupted-no-retry")

    def test_lost_delete_response_recovers_same_identity_and_never_rebuilds(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(controller, "local_cleanup"), \
                patch.object(controller, "MAINTENANCE", pathlib.Path(folder) / "maintenance"):
            state, api = State(folder), FakeAPI()
            ledger = state.reserve(IDENTITY)
            state.update(ledger, "vm-cleaned", runnerId=44, jobConclusion="success", vmExit=0)
            api.runners = [{"id": 44, "name": ledger["runnerName"], "status": "offline", "busy": False}]
            api.lose_delete = True
            with self.assertRaises(APIError):
                controller.tick(api, state, 33)
            controller.tick(api, state, 33)
            self.assertEqual(sum(method == "DELETE" for method, _ in api.calls), 1)
            self.assertFalse(any(method == "POST" for method, _ in api.calls))
            self.assertEqual(json.loads(state.path(22).read_text())["state"], "completed")

    def test_cleanup_cannot_delete_foreign_busy_or_online_runner(self):
        for changes in [{"id": 55}, {"busy": True}, {"status": "online"}]:
            api = FakeAPI()
            ledger = {"runnerName": runner_name(IDENTITY), "runnerId": 44}
            api.runners = [{"id": 44, "name": ledger["runnerName"], "status": "offline", "busy": False, **changes}]
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                controller.remove_identity(api, ledger)
            self.assertFalse(any(method == "DELETE" for method, _ in api.calls))

    def test_maintenance_never_issues_a_token_or_starts_a_vm(self):
        with tempfile.TemporaryDirectory() as folder:
            marker = pathlib.Path(folder) / "maintenance"
            marker.touch()
            with patch.object(controller, "MAINTENANCE", marker):
                api = FakeAPI()
                controller.tick(api, State(pathlib.Path(folder) / "state"), 33)
                self.assertEqual(api.calls, [])


class GuestTests(unittest.TestCase):
    def test_listener_has_no_registration_token_and_identity_is_removed_after_failure(self):
        for fail in [False, True]:
            with self.subTest(fail=fail), tempfile.TemporaryDirectory() as folder, patch.object(job_runner.os, "getuid", return_value=1000):
                root = pathlib.Path(folder)
                actions = root / "actions"; actions.mkdir()
                expected = root / "expected.json"; expected.write_text(json.dumps(IDENTITY))
                seen = []
                def execute(argv, **kwargs):
                    seen.append(argv)
                    self.assertNotIn(TOKEN, argv)
                    if argv[-1] == "--version":
                        return types.SimpleNamespace(stdout=job_runner.RUNNER_VERSION + "\n")
                    if argv[0].endswith("config.sh"):
                        self.assertEqual(kwargs["env"]["ACTIONS_RUNNER_INPUT_TOKEN"], TOKEN)
                        self.assertIn("wallabot,android-build," + job_label(IDENTITY), argv)
                        (actions / ".runner").write_text(json.dumps({"agentName": runner_name(IDENTITY), "agentId": 44,
                            "gitHubUrl": "https://github.com/" + REPOSITORY, "ephemeral": True,
                            "disableUpdate": True, "workFolder": "_work"}), encoding="utf-8-sig")
                    else:
                        self.assertTrue(argv[0].endswith("run.sh"))
                        self.assertNotIn("ACTIONS_RUNNER_INPUT_TOKEN", kwargs["env"])
                        self.assertIn("ACTIONS_RUNNER_HOOK_JOB_STARTED", kwargs["env"])
                        if fail:
                            raise subprocess.TimeoutExpired(argv, 1)
                    return types.SimpleNamespace(returncode=0)
                request = {"schemaVersion": 1, "mode": "run-job", **IDENTITY,
                           "registrationToken": TOKEN, "expiresAt": expires()}
                if fail:
                    with self.assertRaises(subprocess.TimeoutExpired):
                        job_runner.run_job(request, root / "log", actions, execute, expected)
                else:
                    result = job_runner.run_job(request, root / "log", actions, execute, expected)
                    self.assertTrue(result["listenerStarted"] and result["credentialsRemoved"])
                self.assertNotIn("registrationToken", request)
                self.assertFalse(actions.exists())
                self.assertEqual(len(seen), 3)


class MonitorTests(unittest.TestCase):
    def test_job_assignment_is_observed_until_the_vm_exits(self):
        with tempfile.TemporaryDirectory() as folder:
            state, api = State(folder), FakeAPI()
            ledger = state.reserve(IDENTITY)
            api.jobs[-1].update(status="in_progress", runner_id=44, runner_name=ledger["runnerName"])
            elapsed = [0]
            def sleep(seconds):
                elapsed[0] += seconds
                api.jobs[-1].update(status="completed", conclusion="success")
            process = types.SimpleNamespace(poll=lambda: 0 if elapsed[0] >= 45 else None)
            controller.monitor(api, state, ledger, process, lambda: elapsed[0], sleep)
            self.assertEqual(ledger["runnerId"], 44)
            self.assertEqual(elapsed[0], 45)

    def test_cancellation_or_wrong_assignment_stops_monitoring_without_remote_mutation(self):
        for wrong_assignment in [False, True]:
            with tempfile.TemporaryDirectory() as folder:
                state, api = State(folder), FakeAPI()
                ledger = state.reserve(IDENTITY)
                if wrong_assignment:
                    api.jobs[-1].update(runner_id=55, runner_name="foreign")
                else:
                    api.run["status"] = "completed"
                with self.assertRaises(ValueError):
                    controller.monitor(api, state, ledger, types.SimpleNamespace(poll=lambda: None), lambda: 0,
                                       lambda _: self.fail("should stop immediately"))
                self.assertTrue(all(method == "GET" for method, _ in api.calls))

    def test_network_uncertainty_has_a_bounded_lifetime(self):
        with tempfile.TemporaryDirectory() as folder:
            state = State(folder); ledger = state.reserve(IDENTITY)
            elapsed = [0]
            def unavailable(*args):
                raise APIError()
            def sleep(seconds):
                elapsed[0] += seconds
            with self.assertRaises(ValueError):
                controller.monitor(unavailable, state, ledger, types.SimpleNamespace(poll=lambda: None),
                                   lambda: elapsed[0], sleep)
            self.assertEqual(elapsed[0], 120)


class AppTests(unittest.TestCase):
    def test_installation_token_is_scoped_to_one_repo_and_never_in_command_arguments(self):
        seen = []
        def transport(method, path, token, data=None):
            seen.append((method, path, data))
            if path.endswith("/installation"):
                return {"id": 2, "app_id": 1, "account": {"login": "maximofn"}, "suspended_at": None,
                        "repository_selection": "selected", "permissions": PERMISSIONS}
            if path == "/app/installations/2/access_tokens":
                self.assertEqual(data, {"repository_ids": [33], "permissions": PERMISSIONS})
                return {"token": TOKEN, "permissions": PERMISSIONS, "expires_at": expires()}
            if path.startswith("/installation/repositories"):
                return {"total_count": 1, "repositories": [{"id": 33, "full_name": REPOSITORY}]}
            return {"ok": True}
        api = GitHub({"appId": 1, "installationId": 2, "repositoryId": 33}, "unused", transport, lambda *args: "fake-jwt")
        self.assertEqual(api("GET", PREFIX + "/actions/runs/11"), {"ok": True})
        api("GET", PREFIX + "/actions/runs/11")
        self.assertEqual(sum(method == "POST" for method, _, _ in seen), 1)
        with self.assertRaises(ValueError):
            api("GET", "/repos/another/repo/actions/runners")

    def test_partial_or_oversized_inventory_is_not_treated_as_absence(self):
        with self.assertRaises(ValueError):
            collection(lambda *args: {"total_count": 2001, "runners": [{}] * 100}, "/runners", "runners")
        with self.assertRaises(ValueError):
            collection(lambda *args: {"total_count": 0, "runners": [{}]}, "/runners", "runners")


if __name__ == "__main__":
    unittest.main()
