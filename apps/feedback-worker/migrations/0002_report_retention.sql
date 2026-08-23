-- Retención de 30 días para el cuerpo de las denuncias de respuestas de IA.
ALTER TABLE issues ADD COLUMN redacted_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_issues_report_retention
  ON issues (kind, state, redacted_at, created_at);
