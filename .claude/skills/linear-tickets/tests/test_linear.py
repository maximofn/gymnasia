import importlib.util
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "linear.py"
SPEC = importlib.util.spec_from_file_location("linear", SCRIPT)
linear = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(linear)


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


if __name__ == "__main__":
    unittest.main()
