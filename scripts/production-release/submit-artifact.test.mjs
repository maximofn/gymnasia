import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import fc from "fast-check";
import { verifySubmissionArtifact } from "./submit-artifact.mjs";
import { repositoryRoot } from "./production-release.mjs";
import { fixture, hash } from "./release-test-fixtures.mjs";


test("verifica los bytes descargados y la cadena de evidencias antes de enviar", () => {
  const directory = mkdtempSync(join(tmpdir(), "submit-artifact-"));
  try {
    const input = fixture();
    const artifact = join(directory, "gymnasia.aab");
    writeFileSync(artifact, input.bytes);
    assert.equal(verifySubmissionArtifact({ ...input, artifact }).sha256, hash(input.bytes));
    writeFileSync(artifact, Buffer.alloc(input.bytes.length, 1));
    assert.throws(() => verifySubmissionArtifact({ ...input, artifact }), /no es el validado/);
    writeFileSync(artifact, input.bytes);
    assert.throws(() => verifySubmissionArtifact({ ...input, artifact,
      sourceBytes: Buffer.from(input.sourceBytes.toString().replace('"passed"', '"failed"')) }));
    assert.throws(() => verifySubmissionArtifact({ ...input, artifact,
      evidenceBytes: Buffer.from(input.evidenceBytes.toString().replace('"production"', '"staging"')) }));
  } finally { rmSync(directory, { recursive: true }); }
});

test("regresión: la CLI sin evidencia no contacta EAS aunque exista un token", () => {
  const directory = mkdtempSync(join(tmpdir(), "submit-cli-"));
  try {
    const marker = join(directory, "eas-called");
    writeFileSync(join(directory, "eas"), `#!/bin/sh\ntouch '${marker}'\n`, { mode: 0o700 });
    const result = spawnSync(process.execPath, ["scripts/production-release/eas-submit.mjs", "submit",
      "--artifact", join(directory, "unvalidated.aab"), "--output", join(directory, "output.json")], {
      cwd: repositoryRoot, env: { PATH: directory, EXPO_TOKEN: "fake-test-token" }, encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /sin evidencia/);
    assert.throws(() => readFileSync(marker));
  } finally { rmSync(directory, { recursive: true }); }
});

test("una fuente o transacción para GitHub APK nunca autoriza subir a Play", () => {
  const input = fixture();
  assert.throws(() => verifySubmissionArtifact({ ...input, artifact: "/not-read.aab",
    transaction: { ...input.transaction, publicationTarget: "github-apk" },
  }), /no autoriza Google Play/);
  const source = { ...JSON.parse(input.sourceBytes), publicationTarget: "github-apk" };
  assert.throws(() => verifySubmissionArtifact({ ...input, artifact: "/not-read.aab",
    sourceBytes: Buffer.from(JSON.stringify(source)),
  }), /no autoriza Google Play/);
});

test("propiedad: cualquier sustitución de bytes de igual tamaño se rechaza", () => {
  const directory = mkdtempSync(join(tmpdir(), "submit-property-"));
  try {
    const artifact = join(directory, "gymnasia.aab");
    const input = fixture();
    fc.assert(fc.property(fc.uint8Array({ minLength: input.bytes.length, maxLength: input.bytes.length }), (changed) => {
      fc.pre(!Buffer.from(changed).equals(input.bytes));
      writeFileSync(artifact, changed);
      assert.throws(() => verifySubmissionArtifact({ ...input, artifact }));
    }));
  } finally { rmSync(directory, { recursive: true }); }
});
