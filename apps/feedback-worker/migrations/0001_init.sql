-- Idempotencia y deduplicación de incidencias.
CREATE TABLE IF NOT EXISTS issues (
  idempotency_key TEXT PRIMARY KEY,
  kind            TEXT NOT NULL,
  content_hash    TEXT NOT NULL,
  state           TEXT NOT NULL CHECK (state IN ('pending', 'created')),
  issue_number    INTEGER,
  issue_url       TEXT,
  created_at      INTEGER NOT NULL
);

-- Soporta la ventana de deduplicación por contenido de 24 h.
CREATE INDEX IF NOT EXISTS idx_issues_content_hash
  ON issues (content_hash, created_at);

-- Contadores de rate limiting por identificador (hoy, la IP de origen).
CREATE TABLE IF NOT EXISTS requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_requests_identifier
  ON requests (identifier, created_at);
