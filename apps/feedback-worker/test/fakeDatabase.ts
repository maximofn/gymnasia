import type { SqlDatabase, SqlStatement } from "../src/storage";

type IssueRow = {
  idempotency_key: string;
  kind: string;
  content_hash: string;
  state: "pending" | "created";
  issue_number: number | null;
  issue_url: string | null;
  created_at: number;
};

type RequestRow = { identifier: string; created_at: number };

/**
 * Doble en memoria de D1.
 *
 * Reconoce las consultas por fragmento en vez de interpretar SQL. Es
 * deliberadamente tonto: si alguien cambia una consulta en `storage.ts` sin
 * actualizar el doble, los tests fallan de forma ruidosa en vez de pasar por
 * accidente.
 */
export function createFakeDatabase(options: { failInsert?: boolean } = {}) {
  const issues = new Map<string, IssueRow>();
  const requests: RequestRow[] = [];

  const database: SqlDatabase = {
    prepare(query: string): SqlStatement {
      let bound: unknown[] = [];
      const statement: SqlStatement = {
        bind(...values: unknown[]) {
          bound = values;
          return statement;
        },
        async first<T>(): Promise<T | null> {
          if (query.includes("FROM issues") && query.includes("idempotency_key = ?")) {
            return (issues.get(String(bound[0])) as T | undefined) ?? null;
          }
          if (query.includes("FROM issues") && query.includes("content_hash = ?")) {
            const [hash, after] = bound as [string, number];
            const match = [...issues.values()].find(
              (row) =>
                row.content_hash === hash
                && row.state === "created"
                && row.created_at > after,
            );
            return (match as T | undefined) ?? null;
          }
          if (query.includes("COUNT(*)") && query.includes("FROM requests")) {
            const [identifier, after] = bound as [string, number];
            const hits = requests.filter(
              (row) => row.identifier === identifier && row.created_at > after,
            ).length;
            return { hits } as T;
          }
          throw new Error(`Consulta no reconocida por el doble: ${query}`);
        },
        async run() {
          if (query.startsWith("INSERT INTO issues")) {
            if (options.failInsert) throw new Error("UNIQUE constraint failed");
            const [key, kind, hash, createdAt] = bound as [string, string, string, number];
            if (issues.has(key)) throw new Error("UNIQUE constraint failed");
            issues.set(key, {
              idempotency_key: key,
              kind,
              content_hash: hash,
              state: "pending",
              issue_number: null,
              issue_url: null,
              created_at: createdAt,
            });
            return {};
          }
          if (query.startsWith("UPDATE issues")) {
            const [issueNumber, issueUrl, key] = bound as [number, string, string];
            const row = issues.get(key);
            if (row) {
              row.state = "created";
              row.issue_number = issueNumber;
              row.issue_url = issueUrl;
            }
            return {};
          }
          if (query.startsWith("DELETE FROM issues")) {
            const key = String(bound[0]);
            const row = issues.get(key);
            if (row && row.state === "pending") issues.delete(key);
            return {};
          }
          if (query.startsWith("INSERT INTO requests")) {
            const [identifier, createdAt] = bound as [string, number];
            requests.push({ identifier, created_at: createdAt });
            return {};
          }
          if (query.startsWith("DELETE FROM requests")) {
            const before = Number(bound[0]);
            for (let index = requests.length - 1; index >= 0; index -= 1) {
              if (requests[index].created_at < before) requests.splice(index, 1);
            }
            return {};
          }
          throw new Error(`Consulta no reconocida por el doble: ${query}`);
        },
      };
      return statement;
    },
  };

  return { database, issues, requests };
}
