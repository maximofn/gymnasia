/**
 * Persistencia en D1: idempotencia y rate limiting.
 *
 * Se define una interfaz mínima en vez de depender de los tipos de Cloudflare,
 * para que los tests puedan pasar un doble sin levantar el runtime de Workers.
 */

export type SqlStatement = {
  bind: (...values: unknown[]) => SqlStatement;
  first: <T>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

export type SqlDatabase = {
  prepare: (query: string) => SqlStatement;
};

export type IssueRecord = {
  idempotency_key: string;
  state: "pending" | "created";
  issue_number: number | null;
  issue_url: string | null;
};

/**
 * Reserva una clave de idempotencia.
 *
 * Devuelve el registro existente si ya lo había, y `null` si la reserva es
 * nueva. La reserva se hace **antes** de llamar a GitHub: así dos peticiones
 * simultáneas con la misma clave no crean dos issues.
 */
export async function reserveIdempotencyKey(
  db: SqlDatabase,
  key: string,
  kind: string,
  contentHash: string,
  now: number,
): Promise<IssueRecord | null> {
  const existing = await db
    .prepare(
      "SELECT idempotency_key, state, issue_number, issue_url FROM issues WHERE idempotency_key = ?",
    )
    .bind(key)
    .first<IssueRecord>();
  if (existing) return existing;

  // Un reporte con el mismo contenido en las últimas 24 h se considera el
  // mismo, aunque la clave difiera. Evita issues gemelas de usuarios distintos.
  const duplicate = await db
    .prepare(
      "SELECT idempotency_key, state, issue_number, issue_url FROM issues"
        + " WHERE content_hash = ? AND state = 'created' AND created_at > ?",
    )
    .bind(contentHash, now - DEDUPE_WINDOW_MS)
    .first<IssueRecord>();
  if (duplicate) return duplicate;

  try {
    await db
      .prepare(
        "INSERT INTO issues (idempotency_key, kind, content_hash, state, created_at)"
          + " VALUES (?, ?, ?, 'pending', ?)",
      )
      .bind(key, kind, contentHash, now)
      .run();
  } catch {
    // Carrera: otra petición insertó la misma clave entre el SELECT y el
    // INSERT. Se relee en vez de crear una segunda issue.
    const raced = await db
      .prepare(
        "SELECT idempotency_key, state, issue_number, issue_url FROM issues WHERE idempotency_key = ?",
      )
      .bind(key)
      .first<IssueRecord>();
    if (raced) return raced;
    throw new Error("No se pudo reservar la clave de idempotencia.");
  }

  return null;
}

export const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Promueve una reserva a issue creada. */
export async function completeIdempotencyKey(
  db: SqlDatabase,
  key: string,
  issueNumber: number,
  issueUrl: string,
): Promise<void> {
  await db
    .prepare(
      "UPDATE issues SET state = 'created', issue_number = ?, issue_url = ? WHERE idempotency_key = ?",
    )
    .bind(issueNumber, issueUrl, key)
    .run();
}

/** Libera una reserva cuando la creación falla, para permitir reintentar. */
export async function releaseIdempotencyKey(
  db: SqlDatabase,
  key: string,
): Promise<void> {
  await db.prepare("DELETE FROM issues WHERE idempotency_key = ? AND state = 'pending'")
    .bind(key)
    .run();
}

export type RateLimitVerdict = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export type RateLimitRule = { windowMs: number; max: number };

/**
 * Rate limiting con contadores en D1.
 *
 * Se implementa a mano en vez de con el binding nativo de Workers porque D1
 * está garantizado en el plan gratuito. Ver el README.
 */
export async function checkRateLimit(
  db: SqlDatabase,
  identifier: string,
  now: number,
  rules: RateLimitRule[],
): Promise<RateLimitVerdict> {
  for (const rule of rules) {
    const windowStart = now - rule.windowMs;
    const row = await db
      .prepare("SELECT COUNT(*) AS hits FROM requests WHERE identifier = ? AND created_at > ?")
      .bind(identifier, windowStart)
      .first<{ hits: number }>();
    const hits = row?.hits ?? 0;
    if (hits >= rule.max) {
      return { allowed: false, retryAfterSeconds: Math.ceil(rule.windowMs / 1000) };
    }
  }

  await db
    .prepare("INSERT INTO requests (identifier, created_at) VALUES (?, ?)")
    .bind(identifier, now)
    .run();

  return { allowed: true, retryAfterSeconds: 0 };
}

/** Borra contadores viejos. Se llama de forma oportunista, no en cada petición. */
export async function pruneRateLimitCounters(
  db: SqlDatabase,
  now: number,
  maxAgeMs: number,
): Promise<void> {
  await db
    .prepare("DELETE FROM requests WHERE created_at < ?")
    .bind(now - maxAgeMs)
    .run();
}
