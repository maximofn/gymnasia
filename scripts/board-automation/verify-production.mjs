import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

export const EXPECTED_PAGE_TITLE = "<title>Gymnasia — Tablero de seguimiento</title>";

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function verifyProduction({
  localPath,
  rootUrl,
  attempts = 1,
  intervalMs = 0,
  sourceCommit = "unknown",
  deploymentUrl = null,
  fetchImpl = fetch,
  sleepImpl = pause,
}) {
  const localHash = sha256(readFileSync(localPath));
  const canonicalRoot = new URL("/", rootUrl).toString();
  const boardUrl = new URL("/data/board.json", rootUrl).toString();
  let remoteHash = null;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const [pageResponse, boardResponse] = await Promise.all([
        fetchImpl(canonicalRoot, { redirect: "follow", cache: "no-store" }),
        fetchImpl(boardUrl, { redirect: "follow", cache: "no-store" }),
      ]);
      if (!pageResponse.ok || !boardResponse.ok) {
        throw new Error(`Producción devolvió HTTP ${pageResponse.status}/${boardResponse.status}.`);
      }
      const page = await pageResponse.text();
      if (!page.includes(EXPECTED_PAGE_TITLE)) {
        throw new Error("La URL canónica no sirve el tablero esperado.");
      }
      remoteHash = sha256(Buffer.from(await boardResponse.arrayBuffer()));
      if (remoteHash === localHash) {
        return {
          schemaVersion: 1,
          status: "match",
          checkedAt: new Date().toISOString(),
          sourceCommit,
          deploymentUrl,
          rootUrl: canonicalRoot,
          boardUrl,
          localHash,
          remoteHash,
          attemptsUsed: attempt,
        };
      }
      lastError = new Error("El SHA-256 publicado no coincide con el archivo local.");
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await sleepImpl(intervalMs);
  }

  const evidence = {
    schemaVersion: 1,
    status: "mismatch",
    checkedAt: new Date().toISOString(),
    sourceCommit,
    deploymentUrl,
    rootUrl: canonicalRoot,
    boardUrl,
    localHash,
    remoteHash,
    attemptsUsed: attempts,
  };
  const error = new Error(lastError?.message || "No se pudo comprobar producción.");
  error.evidence = evidence;
  throw error;
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!key?.startsWith("--") || argv[index + 1] === undefined) {
      throw new Error(`Argumento incompleto: ${key || "(vacío)"}.`);
    }
    options[key.slice(2)] = argv[index + 1];
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const outputPath = options.output;
  let evidence;
  try {
    evidence = await verifyProduction({
      localPath: options.local,
      rootUrl: options.url,
      attempts: Number(options.attempts || 1),
      intervalMs: Number(options["interval-ms"] || 0),
      sourceCommit: options.commit || "unknown",
      deploymentUrl: options["deployment-url"] || null,
    });
  } catch (error) {
    evidence = error.evidence;
    if (outputPath && evidence) writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
    throw error;
  }
  if (outputPath) writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Producción verificada: ${evidence.remoteHash}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
