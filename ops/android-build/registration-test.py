#!/usr/bin/env python3
"""Credential-free tests: no GitHub, SSH, runner registration or host changes."""
import datetime
import importlib.util
import json
import os
import pathlib
import subprocess
import tempfile
import types
import unittest

from runner_registration import RUNNER_VERSION, probe, validate_request

spec = importlib.util.spec_from_file_location("control", pathlib.Path(__file__).with_name("registration-control.py"))
control = importlib.util.module_from_spec(spec)
spec.loader.exec_module(control)

TOKEN = "test_credential_" + "x" * 40


def request():
    return {"schemaVersion": 1, "mode": "register-probe", "nonce": "a" * 32,
            "registrationToken": TOKEN,
            "expiresAt": (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=50)).isoformat()}


def runner_record(name, identity=123):
    return {"id": identity, "name": name, "busy": False, "status": "offline", "ephemeral": True,
            "version": RUNNER_VERSION, "labels": [{"name": x} for x in ["self-hosted", "Linux", "X64", "wallabot", "android-build"]]}


class FakeGitHub:
    def __init__(self):
        self.runners = [runner_record("unrelated-production-runner", 999)]
        self.calls = []

    def __call__(self, method, endpoint, **kwargs):
        self.calls.append((method, endpoint))
        if method == "GET":
            assert endpoint == control.ENDPOINT + "?per_page=100" and kwargs == {"paginate": True}
            return [{"runners": self.runners[:1]}, {"runners": self.runners[1:]}]
        if method == "POST":
            assert endpoint == control.ENDPOINT + "/registration-token"
            return {"token": TOKEN, "expires_at": request()["expiresAt"]}
        assert method == "DELETE"
        assert endpoint == control.ENDPOINT + "/123", "Never delete the unrelated runner"
        self.runners = [x for x in self.runners if x["id"] != 123]


class RegistrationTests(unittest.TestCase):
    def test_rejects_expired_long_lived_mixed_secrets_and_arbitrary_targets(self):
        for patch in [{"expiresAt": "2000-01-01T00:00:00Z"},
                      {"expiresAt": "2100-01-01T00:00:00Z"}, {"expiresAt": "2026-09-14T12:00:00"},
                      {"expoToken": TOKEN}, {"repository": "attacker/fork"}, {"mode": "build"},
                      {"nonce": "../bad"}, {"registrationToken": TOKEN + "\n"}]:
            with self.subTest(patch=list(patch)), self.assertRaises((AssertionError, ValueError)):
                validate_request({**request(), **patch})

    def fake_execute(self, actions, fail=False):
        def execute(argv, **kwargs):
            self.assertNotIn(TOKEN, argv)
            if argv[-1] == "--version":
                self.assertNotIn("ACTIONS_RUNNER_INPUT_TOKEN", kwargs["env"])
                return types.SimpleNamespace(stdout=RUNNER_VERSION + "\n")
            self.assertEqual(pathlib.Path(argv[0]).name, "config.sh")
            self.assertEqual(kwargs["env"]["ACTIONS_RUNNER_INPUT_TOKEN"], TOKEN)
            self.assertIn("--ephemeral", argv)
            self.assertIn("--disableupdate", argv)
            self.assertNotIn("--replace", argv)
            self.assertNotIn("--token", argv)
            self.assertEqual(argv[argv.index("--url") + 1], "https://github.com/maximofn/gymnasia")
            self.assertEqual(argv[argv.index("--labels") + 1], "wallabot,android-build")
            settings = {"agentId": 123, "agentName": argv[argv.index("--name") + 1],
                        "gitHubUrl": "https://github.com/maximofn/gymnasia", "ephemeral": True,
                        "disableUpdate": True, "workFolder": "_work"}
            (actions / ".runner").write_text(json.dumps(settings))
            (actions / ".credentials_rsaparams").write_text(TOKEN)
            (actions / "_diag").mkdir()
            (actions / "_diag/private.log").write_text(TOKEN)
            if fail:
                raise subprocess.CalledProcessError(1, argv)
            return types.SimpleNamespace(returncode=0)
        return execute

    def test_registers_ephemeral_without_listener_and_removes_identity(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder); actions = root / "actions"; actions.mkdir()
            data = request()
            report = probe(data, root / "private.log", actions, self.fake_execute(actions))
            self.assertEqual(report["id"], 123)
            self.assertFalse(report["listenerStarted"])
            self.assertTrue(report["credentialsRemoved"])
            self.assertNotIn("registrationToken", data)
            self.assertNotIn(TOKEN, json.dumps(report))
            self.assertFalse(actions.exists())

    def test_registration_failure_still_removes_private_runner_files(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder); actions = root / "actions"; actions.mkdir()
            data = request()
            with self.assertRaises(subprocess.CalledProcessError):
                probe(data, root / "private.log", actions, self.fake_execute(actions, fail=True))
            self.assertFalse(actions.exists())
            self.assertNotIn("registrationToken", data)

    def test_does_not_replace_an_existing_runner_identity(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder); actions = root / "actions"; actions.mkdir()
            (actions / ".runner").write_text("existing")
            with self.assertRaises(AssertionError):
                probe(request(), root / "private.log", actions, lambda *a, **k: self.fail("must not execute"))
            self.assertEqual((actions / ".runner").read_text(), "existing")

    def test_issuance_is_exclusive_and_ledger_contains_no_token(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder) / "attempt"; api = FakeGitHub()
            control.prepare(root, api)
            self.assertEqual((root / "request.json").stat().st_mode & 0o777, 0o600)
            self.assertNotIn(TOKEN, (root / "attempt.json").read_text())
            with self.assertRaises(FileExistsError):
                control.prepare(root, api)
            self.assertEqual(sum(x[0] == "POST" for x in api.calls), 1)

    def setup_attempt(self, root, api):
        prepared = control.prepare(root, api)
        data = json.loads((root / "request.json").read_text())
        api.runners.append(runner_record(prepared["runnerName"]))
        report = {"mode": "register-probe", "nonce": data["nonce"], "result": "passed",
                  "registration": {"id": 123, "name": prepared["runnerName"], "ephemeral": True,
                                   "disableUpdate": True, "version": RUNNER_VERSION,
                                   "listenerStarted": False, "credentialsRemoved": True}}
        path = root / "report.json"; path.write_text(json.dumps(report))
        return path

    def test_finish_checks_github_identity_and_removes_only_this_runner(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder) / "attempt"; api = FakeGitHub(); report = self.setup_attempt(root, api)
            result = control.finish(root, report, api)
            self.assertEqual(result["state"], "verified-and-removed")
            self.assertEqual([x["id"] for x in api.runners], [999])
            self.assertFalse((root / "request.json").exists())
            calls = len(api.calls)
            self.assertEqual(control.finish(root, report, api), result)
            self.assertEqual(len(api.calls), calls)

    def test_busy_or_online_runner_is_not_removed(self):
        for patch in [{"busy": True}, {"status": "online"}]:
            with self.subTest(patch=patch), tempfile.TemporaryDirectory() as folder:
                root = pathlib.Path(folder) / "attempt"; api = FakeGitHub(); report = self.setup_attempt(root, api)
                api.runners[-1].update(patch)
                with self.assertRaises(AssertionError):
                    control.finish(root, report, api)
                self.assertFalse(any(x[0] == "DELETE" for x in api.calls))

    def test_bad_report_cannot_select_another_runner_for_deletion(self):
        for invalid in ["{", '[]', json.dumps({"registration": {"id": 999}})]:
            with self.subTest(invalid=invalid), tempfile.TemporaryDirectory() as folder:
                root = pathlib.Path(folder) / "attempt"; api = FakeGitHub(); report = self.setup_attempt(root, api)
                report.write_text(invalid)
                self.assertEqual(control.finish(root, report, api)["state"], "failed-and-removed")
                self.assertEqual([x["id"] for x in api.runners], [999])

    def test_lost_delete_response_can_be_reconciled_without_reissuing_token(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder) / "attempt"; api = FakeGitHub(); report = self.setup_attempt(root, api)
            def lost_response(method, endpoint, **kwargs):
                result = api(method, endpoint, **kwargs)
                if method == "DELETE":
                    raise TimeoutError("simulated lost response")
                return result
            with self.assertRaises(TimeoutError):
                control.finish(root, report, lost_response)
            self.assertEqual(control.finish(root, report, api)["state"], "verified-and-removed")
            self.assertEqual(sum(x[0] == "POST" for x in api.calls), 1)
            self.assertEqual(sum(x[0] == "DELETE" for x in api.calls), 1)


if __name__ == "__main__":
    unittest.main()
