import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { EXPECTED_PAGE_TITLE, sha256, verifyProduction } from "./verify-production.mjs";

function response(body, status = 200) {
  const bytes = Buffer.from(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => bytes.toString("utf8"),
    arrayBuffer: async () => bytes,
  };
}

function withBoardFile(contents, callback) {
  const directory = mkdtempSync(join(tmpdir(), "board-production-test-"));
  const path = join(directory, "board.json");
  writeFileSync(path, contents);
  return Promise.resolve(callback(path)).finally(() => rmSync(directory, { recursive: true, force: true }));
}

test("verifica título y bytes exactos del tablero publicado", () => withBoardFile("{\"ok\":true}\n", async (path) => {
  const fetchImpl = async (url) => (
    url.endsWith("board.json")
      ? response("{\"ok\":true}\n")
      : response(`<html>${EXPECTED_PAGE_TITLE}</html>`)
  );
  const evidence = await verifyProduction({
    localPath: path,
    rootUrl: "https://gymnasia.example/",
    sourceCommit: "a".repeat(40),
    fetchImpl,
  });

  assert.equal(evidence.status, "match");
  assert.equal(evidence.localHash, sha256(Buffer.from("{\"ok\":true}\n")));
  assert.equal(evidence.remoteHash, evidence.localHash);
}));

test("reintenta una propagación incompleta y conserva el número de intentos", () => withBoardFile("correcto", async (path) => {
  let boardRequests = 0;
  let waits = 0;
  const fetchImpl = async (url) => {
    if (!url.endsWith("board.json")) return response(EXPECTED_PAGE_TITLE);
    boardRequests += 1;
    return response(boardRequests === 1 ? "antiguo" : "correcto");
  };
  const evidence = await verifyProduction({
    localPath: path,
    rootUrl: "https://gymnasia.example",
    attempts: 2,
    intervalMs: 1,
    fetchImpl,
    sleepImpl: async () => { waits += 1; },
  });

  assert.equal(evidence.attemptsUsed, 2);
  assert.equal(waits, 1);
}));

test("un fallo terminal devuelve evidencia saneada para la alerta", () => withBoardFile("local", async (path) => {
  await assert.rejects(
    verifyProduction({
      localPath: path,
      rootUrl: "https://gymnasia.example",
      fetchImpl: async (url) => response(url.endsWith("board.json") ? "remoto" : EXPECTED_PAGE_TITLE),
    }),
    (error) => {
      assert.equal(error.evidence.status, "mismatch");
      assert.equal(error.evidence.localHash, sha256(Buffer.from("local")));
      assert.equal(error.evidence.remoteHash, sha256(Buffer.from("remoto")));
      return true;
    },
  );
}));
