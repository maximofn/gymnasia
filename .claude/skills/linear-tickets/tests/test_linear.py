import argparse
import io
import importlib.util
import json
import os
import random
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "linear.py"
SPEC = importlib.util.spec_from_file_location("linear", SCRIPT)
linear = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(linear)


COMPLETE_PLAN = """Contexto del ticket.

## Plan de pruebas
- [X] Unitarios: cubren el parser.
- [x] E2E: recorre el flujo principal.
- [X] Integración con proveedor falso: simula dos rondas.
- [x] Contrato: valida los schemas.
- [ ] Regresión: No aplica: no corrige ningún bug existente.
- [X] Fuzzing / property-based: genera argumentos arbitrarios.
"""


class ApiKeyLoadingTests(unittest.TestCase):
    def test_loads_a_quoted_key_from_an_explicit_env_file(self):
        with tempfile.TemporaryDirectory() as directory:
            env_path = Path(directory) / ".env"
            env_path.write_text('LINEAR_API_KEY="lin_api_worktree"\n')
            with mock.patch.dict(
                "os.environ",
                {"LINEAR_ENV_FILE": str(env_path)},
                clear=True,
            ):
                self.assertEqual(linear.load_api_key(), "lin_api_worktree")


class BoardSynchronizationTests(unittest.TestCase):
    @staticmethod
    def board(title="Titulo local", state="todo", ignore=None):
        return {
            "meta": {"updated": "2026-01-01", "ignore": ignore or []},
            "groups": [
                {
                    "id": "otros",
                    "kind": "group",
                    "tickets": [
                        {
                            "id": "GYM-10",
                            "title": title,
                            "state": state,
                            "summary": "Resumen editorial que no debe cambiar.",
                            "dependsOn": [],
                            "related": [],
                        }
                    ],
                }
            ],
        }

    @staticmethod
    def node(identifier="GYM-10", title="Titulo local", state="Todo"):
        return {"identifier": identifier, "title": title, "state": {"name": state}}

    def test_clean_report_has_stable_machine_contract(self):
        report = linear.build_board_report(
            self.board(ignore=["GYM-1"]),
            [self.node(), self.node("GYM-1", "Onboarding", "Done")],
            checked_at="2026-09-12T10:00:00Z",
        )

        self.assertEqual(report, {
            "schemaVersion": 1,
            "checkedAt": "2026-09-12T10:00:00Z",
            "team": "GYM",
            "status": "clean",
            "changes": {
                "states": [],
                "titles": [],
                "missingFromBoard": [],
                "missingFromLinear": [],
            },
            "safeChangeCount": 0,
            "reviewRequiredCount": 0,
        })

    def test_state_and_title_are_safe_but_inventory_drift_requires_review(self):
        safe = linear.build_board_report(
            self.board(),
            [self.node(title="Titulo de Linear", state="In Review")],
            checked_at="fixed",
        )
        self.assertEqual(safe["status"], "safe_changes")
        self.assertEqual(safe["changes"]["states"][0]["to"], "in_progress")
        self.assertEqual(safe["changes"]["titles"][0]["to"], "Titulo de Linear")

        review = linear.build_board_report(
            self.board(),
            [self.node("GYM-11", "Nuevo", "Backlog")],
            checked_at="fixed",
        )
        self.assertEqual(review["status"], "review_required")
        self.assertEqual(review["safeChangeCount"], 0)
        self.assertEqual(review["reviewRequiredCount"], 2)
        self.assertEqual(review["changes"]["missingFromBoard"][0]["id"], "GYM-11")
        self.assertEqual(review["changes"]["missingFromLinear"], [{"id": "GYM-10"}])

    def test_apply_safe_preserves_format_and_editorial_fields(self):
        board = self.board()
        raw = json.dumps(board, ensure_ascii=False, indent=2) + "\n"
        title = 'Titulo con á, "comillas", \\ y una llave }'
        report = linear.build_board_report(
            board,
            [self.node(title=title, state="In Progress")],
            checked_at="fixed",
        )

        updated = linear.apply_board_report(
            raw,
            report,
            include_titles=True,
            updated_on="2026-09-12",
        )
        parsed = json.loads(updated)
        ticket = parsed["groups"][0]["tickets"][0]
        self.assertEqual(ticket["title"], title)
        self.assertEqual(ticket["state"], "in_progress")
        self.assertEqual(ticket["summary"], "Resumen editorial que no debe cambiar.")
        self.assertEqual(parsed["meta"]["updated"], "2026-09-12")
        self.assertTrue(updated.endswith("\n"))

    def test_apply_safe_refuses_partial_changes_when_inventory_needs_review(self):
        board = self.board(title="Viejo")
        raw = json.dumps(board, ensure_ascii=False, indent=2) + "\n"
        report = linear.build_board_report(
            board,
            [
                self.node(title="Nuevo"),
                self.node("GYM-11", "Alta", "Todo"),
            ],
            checked_at="fixed",
        )

        with self.assertRaisesRegex(ValueError, "no aplica cambios parciales"):
            linear.apply_board_report(raw, report, include_titles=True)
        self.assertEqual(json.loads(raw)["groups"][0]["tickets"][0]["title"], "Viejo")

    def test_legacy_apply_changes_state_but_not_title(self):
        board = self.board(title="Viejo")
        raw = json.dumps(board, ensure_ascii=False, indent=2) + "\n"
        report = linear.build_board_report(
            board,
            [self.node(title="Nuevo", state="Done")],
            checked_at="fixed",
        )

        updated = linear.apply_board_report(raw, report, include_titles=False, updated_on="2026-09-12")
        ticket = json.loads(updated)["groups"][0]["tickets"][0]
        self.assertEqual(ticket["state"], "done")
        self.assertEqual(ticket["title"], "Viejo")

    def test_json_mode_reports_drift_without_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root.joinpath(*linear.BOARD_PATH)
            path.parent.mkdir(parents=True)
            path.write_text(json.dumps(self.board()), encoding="utf-8")
            args = argparse.Namespace(
                team="GYM",
                format="json",
                apply=False,
                apply_safe=False,
            )
            output = io.StringIO()
            with (
                mock.patch.object(linear, "repo_root", return_value=root),
                mock.patch.object(linear, "fetch_board_nodes", return_value=[self.node(state="Done")]),
                redirect_stdout(output),
            ):
                linear.cmd_board(args)

        self.assertEqual(json.loads(output.getvalue())["status"], "safe_changes")

    def test_failed_surgical_change_never_calls_atomic_writer(self):
        board = self.board()
        del board["groups"][0]["tickets"][0]["state"]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root.joinpath(*linear.BOARD_PATH)
            path.parent.mkdir(parents=True)
            path.write_text(json.dumps(board), encoding="utf-8")
            args = argparse.Namespace(
                team="GYM",
                format="human",
                apply=False,
                apply_safe=True,
            )
            with (
                mock.patch.object(linear, "repo_root", return_value=root),
                mock.patch.object(linear, "fetch_board_nodes", return_value=[self.node()]),
                mock.patch.object(linear, "atomic_write_text") as writer,
                self.assertRaisesRegex(SystemExit, "No se ha escrito nada"),
            ):
                linear.cmd_board(args)
            writer.assert_not_called()

    def test_atomic_writer_preserves_file_permissions(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "board.json"
            path.write_text("antes", encoding="utf-8")
            path.chmod(0o640)

            linear.atomic_write_text(path, "después")

            self.assertEqual(path.read_text(encoding="utf-8"), "después")
            self.assertEqual(os.stat(path).st_mode & 0o777, 0o640)

    def test_random_safe_sequences_round_trip_without_touching_summary(self):
        generator = random.Random(172)
        states = ["Backlog", "Todo", "In Progress", "In Review", "Done", "Canceled"]
        for index in range(100):
            board = self.board(title=f"Local {index}", state="todo")
            raw = json.dumps(board, ensure_ascii=False, indent=2) + "\n"
            title = f'Titulo {index} "{generator.randrange(1000)}" \\ á }}'
            state = generator.choice(states)
            report = linear.build_board_report(
                board,
                [self.node(title=title, state=state)],
                checked_at="fixed",
            )
            updated = linear.apply_board_report(raw, report, include_titles=True)
            ticket = json.loads(updated)["groups"][0]["tickets"][0]
            self.assertEqual(ticket["title"], title)
            self.assertEqual(ticket["state"], linear.board_state_id(state))
            self.assertEqual(ticket["summary"], "Resumen editorial que no debe cambiar.")


class TestPlanValidationTests(unittest.TestCase):
    def test_accepts_complete_plan_with_not_applicable_reasons(self):
        description = """Contexto del ticket.

## Plan de pruebas
- Unitarios: cubren el parser.
- E2E: recorre el flujo principal.
- Integración con proveedor falso: simula dos rondas.
- Contrato: valida los schemas.
- Regresión: conserva el bug como fixture.
- Fuzzing / property-based: genera argumentos arbitrarios.
"""

        self.assertEqual(linear.validate_test_plan(description), description)

    def test_rejects_missing_heading(self):
        with self.assertRaisesRegex(SystemExit, "Plan de pruebas"):
            linear.validate_test_plan("Unitarios y E2E")

    def test_reports_every_missing_category(self):
        with self.assertRaises(SystemExit) as raised:
            linear.validate_test_plan("## Plan de pruebas\n- Unitarios: sí")

        message = str(raised.exception)
        self.assertIn("E2E", message)
        self.assertIn("proveedor falso", message)
        self.assertIn("contrato", message)
        self.assertIn("regresión", message)
        self.assertIn("fuzzing", message)

    def test_requires_categories_as_labels_not_mentions_in_another_explanation(self):
        description = COMPLETE_PLAN.replace(
            "- [x] E2E: recorre el flujo principal.\n",
            "",
        ).replace(
            "cubren el parser.",
            "cubren el parser usado por el E2E.",
        )

        with self.assertRaisesRegex(SystemExit, "E2E"):
            linear.validate_test_plan(description)


class ClosureValidationTests(unittest.TestCase):
    def test_accepts_checked_items_and_justified_not_applicable(self):
        linear.validate_closure_test_plan(COMPLETE_PLAN)

    def test_rejects_unchecked_applicable_category(self):
        description = COMPLETE_PLAN.replace(
            "- [x] E2E: recorre el flujo principal.",
            "- [ ] E2E: recorre el flujo principal.",
        )

        with self.assertRaisesRegex(SystemExit, "E2E"):
            linear.validate_closure_test_plan(description)

    def test_rejects_not_applicable_placeholder(self):
        description = COMPLETE_PLAN.replace(
            "No aplica: no corrige ningún bug existente.",
            "No aplica: <motivo>",
        )

        with self.assertRaisesRegex(SystemExit, "regresión"):
            linear.validate_closure_test_plan(description)

    def test_evidence_must_include_check_and_result(self):
        self.assertEqual(
            linear.validate_closure_evidence([
                " npm test: 16/16 tests verdes ",
                "QA manual: Pixel 8, flujo feliz correcto",
            ]),
            [
                "npm test: 16/16 tests verdes",
                "QA manual: Pixel 8, flujo feliz correcto",
            ],
        )
        with self.assertRaisesRegex(SystemExit, "Evidencia no concreta"):
            linear.validate_closure_evidence(["todo verde"])

    def test_update_cannot_bypass_protected_close(self):
        args = argparse.Namespace(
            id="GYM-99",
            title=None,
            description=None,
            priority=None,
            state="Done",
            parent=None,
        )
        with mock.patch.object(
            linear,
            "resolve_issue_uuid",
            side_effect=AssertionError("no debe consultar Linear"),
        ):
            with self.assertRaisesRegex(SystemExit, "cierre está protegido"):
                linear.cmd_update(args)

    def test_close_comments_evidence_before_moving_to_done(self):
        calls = []

        def fake_query(gql, variables=None):
            if "issue(id:$id)" in gql:
                return {
                    "issue": {
                        "identifier": "GYM-99",
                        "description": COMPLETE_PLAN,
                        "state": {"name": "In Progress", "type": "started"},
                    }
                }
            if "commentCreate" in gql:
                calls.append(("comment", variables))
                return {"commentCreate": {"success": True}}
            if "issueUpdate" in gql:
                calls.append(("update", variables))
                return {
                    "issueUpdate": {
                        "success": True,
                        "issue": {
                            "identifier": "GYM-99",
                            "state": {"name": "Done"},
                        },
                    }
                }
            raise AssertionError("GraphQL inesperado")

        args = argparse.Namespace(
            id="GYM-99",
            evidence=["npm test: 16/16 tests verdes"],
            dry_run=False,
        )
        output = io.StringIO()
        with (
            mock.patch.object(linear, "resolve_issue_uuid", return_value="uuid-99"),
            mock.patch.object(linear, "resolve_state_id", return_value="done-state"),
            mock.patch.object(linear, "query", side_effect=fake_query),
            redirect_stdout(output),
        ):
            linear.cmd_close(args)

        self.assertEqual([kind for kind, _variables in calls], ["comment", "update"])
        comment_input = calls[0][1]["input"]
        self.assertEqual(comment_input["issueId"], "uuid-99")
        self.assertIn("npm test: 16/16 tests verdes", comment_input["body"])
        self.assertEqual(calls[1][1]["input"], {"stateId": "done-state"})
        self.assertIn("Siguiente paso obligatorio", output.getvalue())

    def test_close_dry_run_never_mutates_linear(self):
        def fake_query(gql, _variables=None):
            if "issue(id:$id)" not in gql:
                raise AssertionError("dry-run no debe ejecutar mutaciones")
            return {
                "issue": {
                    "identifier": "GYM-99",
                    "description": COMPLETE_PLAN,
                    "state": {"name": "Todo", "type": "unstarted"},
                }
            }

        args = argparse.Namespace(
            id="GYM-99",
            evidence=["npm test: 16/16 tests verdes"],
            dry_run=True,
        )
        output = io.StringIO()
        with (
            mock.patch.object(linear, "resolve_issue_uuid", return_value="uuid-99"),
            mock.patch.object(linear, "query", side_effect=fake_query),
            redirect_stdout(output),
        ):
            linear.cmd_close(args)

        self.assertIn("cierre válido [dry-run]", output.getvalue())

    def test_close_does_not_move_state_when_comment_fails(self):
        def fake_query(gql, _variables=None):
            if "issue(id:$id)" in gql:
                return {
                    "issue": {
                        "identifier": "GYM-99",
                        "description": COMPLETE_PLAN,
                        "state": {"name": "In Progress", "type": "started"},
                    }
                }
            if "commentCreate" in gql:
                return {"commentCreate": {"success": False}}
            if "issueUpdate" in gql:
                raise AssertionError("no debe cerrar sin comentario de evidencia")
            raise AssertionError("GraphQL inesperado")

        args = argparse.Namespace(
            id="GYM-99",
            evidence=["npm test: 16/16 tests verdes"],
            dry_run=False,
        )
        with (
            mock.patch.object(linear, "resolve_issue_uuid", return_value="uuid-99"),
            mock.patch.object(linear, "resolve_state_id", return_value="done-state"),
            mock.patch.object(linear, "query", side_effect=fake_query),
        ):
            with self.assertRaisesRegex(SystemExit, "sigue abierto"):
                linear.cmd_close(args)


class IssueRelationTests(unittest.TestCase):
    def test_link_creates_blocks_relations_in_the_correct_direction(self):
        calls = []

        def fake_resolve(identifier):
            return {
                "GYM-200": "uuid-target",
                "GYM-143": "uuid-143",
                "GYM-145": "uuid-145",
            }[identifier]

        def fake_query(gql, variables=None):
            self.assertIn("issueRelationCreate", gql)
            calls.append(variables["input"])
            return {
                "issueRelationCreate": {
                    "success": True,
                    "issueRelation": {"id": "relation", "type": "blocks"},
                }
            }

        args = argparse.Namespace(
            id="GYM-200",
            blocked_by=["GYM-143", "GYM-145"],
        )
        with (
            mock.patch.object(linear, "resolve_issue_uuid", side_effect=fake_resolve),
            mock.patch.object(linear, "query", side_effect=fake_query),
        ):
            linear.cmd_link(args)

        self.assertEqual(
            calls,
            [
                {
                    "issueId": "uuid-143",
                    "relatedIssueId": "uuid-target",
                    "type": "blocks",
                },
                {
                    "issueId": "uuid-145",
                    "relatedIssueId": "uuid-target",
                    "type": "blocks",
                },
            ],
        )

    @staticmethod
    def relation(relation_id="relation-196-198", relation_type="blocks"):
        return {
            "id": relation_id,
            "type": relation_type,
            "issue": {"id": "uuid-196", "identifier": "GYM-196"},
            "relatedIssue": {"id": "uuid-198", "identifier": "GYM-198"},
        }

    def test_unlink_previews_without_deleting(self):
        calls = []

        def fake_resolve(identifier):
            return {"GYM-196": "uuid-196", "GYM-198": "uuid-198"}[identifier]

        def fake_query(gql, variables=None):
            calls.append((gql, variables))
            return {
                "issue": {
                    "relations": {"nodes": []},
                    "inverseRelations": {"nodes": [self.relation()]},
                }
            }

        args = argparse.Namespace(id="GYM-198", blocked_by=["GYM-196"], apply=False)
        with (
            mock.patch.object(linear, "resolve_issue_uuid", side_effect=fake_resolve),
            mock.patch.object(linear, "query", side_effect=fake_query),
        ):
            linear.cmd_unlink(args)

        self.assertEqual(len(calls), 1)
        self.assertIn("IssueRelations", calls[0][0])

    def test_unlink_deletes_the_relation_uuid_in_the_correct_direction(self):
        def fake_resolve(identifier):
            return {"GYM-196": "uuid-196", "GYM-198": "uuid-198"}[identifier]

        def fake_query(gql, variables=None):
            if "IssueRelations" in gql:
                return {
                    "issue": {
                        "relations": {"nodes": []},
                        "inverseRelations": {"nodes": [self.relation()]},
                    }
                }
            self.assertIn("issueRelationDelete", gql)
            self.assertEqual(variables, {"id": "relation-196-198"})
            return {"issueRelationDelete": {"success": True}}

        args = argparse.Namespace(id="GYM-198", blocked_by=["GYM-196"], apply=True)
        with (
            mock.patch.object(linear, "resolve_issue_uuid", side_effect=fake_resolve),
            mock.patch.object(linear, "query", side_effect=fake_query),
        ):
            linear.cmd_unlink(args)

    def test_unlink_refuses_missing_relations_before_deleting(self):
        args = argparse.Namespace(id="GYM-198", blocked_by=["GYM-196"], apply=True)
        with (
            mock.patch.object(
                linear,
                "resolve_issue_uuid",
                side_effect=lambda value: {"GYM-196": "uuid-196", "GYM-198": "uuid-198"}[value],
            ),
            mock.patch.object(
                linear,
                "query",
                return_value={"issue": {"relations": {"nodes": []}, "inverseRelations": {"nodes": []}}},
            ) as mocked_query,
        ):
            with self.assertRaisesRegex(SystemExit, "no se ha borrado nada"):
                linear.cmd_unlink(args)

        self.assertEqual(mocked_query.call_count, 1)

    def test_relate_creates_a_related_relation(self):
        calls = []

        def fake_resolve(identifier):
            return {"GYM-196": "uuid-196", "GYM-198": "uuid-198"}[identifier]

        def fake_query(gql, variables=None):
            if "IssueRelations" in gql:
                return {"issue": {"relations": {"nodes": []}, "inverseRelations": {"nodes": []}}}
            calls.append(variables["input"])
            return {
                "issueRelationCreate": {
                    "success": True,
                    "issueRelation": {"id": "related-id", "type": "related"},
                }
            }

        args = argparse.Namespace(id="GYM-196", with_id="GYM-198")
        with (
            mock.patch.object(linear, "resolve_issue_uuid", side_effect=fake_resolve),
            mock.patch.object(linear, "query", side_effect=fake_query),
        ):
            linear.cmd_relate(args)

        self.assertEqual(
            calls,
            [{"issueId": "uuid-196", "relatedIssueId": "uuid-198", "type": "related"}],
        )

    def test_relate_is_idempotent(self):
        relation = self.relation(relation_type="related")
        args = argparse.Namespace(id="GYM-196", with_id="GYM-198")
        with (
            mock.patch.object(
                linear,
                "resolve_issue_uuid",
                side_effect=lambda value: {"GYM-196": "uuid-196", "GYM-198": "uuid-198"}[value],
            ),
            mock.patch.object(
                linear,
                "query",
                return_value={"issue": {"relations": {"nodes": [relation]}, "inverseRelations": {"nodes": []}}},
            ) as mocked_query,
        ):
            linear.cmd_relate(args)

        self.assertEqual(mocked_query.call_count, 1)


if __name__ == "__main__":
    unittest.main()
