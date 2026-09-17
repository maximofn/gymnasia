#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import {
  evaluateArtifactCandidate,
  extractCertificateDigest,
  extractNotificationSoundsFromArchiveListing,
  extractNotificationSoundsFromCompiledResources,
  expectedNotificationSounds,
  loadReleasePolicy,
  parseManifestXml,
  repositoryRoot,
} from "./production-release.mjs";
import { assertLocalBuildMetadata, assertVersionCodeProgression } from "./local-build.mjs";

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error("Argumentos inválidos para verify-artifact.mjs.");
    }
    options[key.slice(2)] = value;
  }
  for (const required of ["artifact", "kind", "profile", "source-evidence", "snapshot", "output"]) {
    if (!options[required]) throw new Error(`Falta --${required}.`);
  }
  if (!["apk", "aab"].includes(options.kind)) throw new Error("--kind debe ser apk o aab.");
  if (options.kind === "aab" && !options.bundletool) {
    throw new Error("Un AAB exige --bundletool con la ruta a bundletool 1.18.3.");
  }
  return options;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} terminó con código ${result.status}: ${result.stderr}`);
  }
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function extractJsonFromArchive(artifact, paths) {
  for (const path of paths) {
    const result = spawnSync("unzip", ["-p", artifact, path], {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 5 * 1024 * 1024,
    });
    if (result.status === 0 && result.stdout.trim()) return JSON.parse(result.stdout);
  }
  throw new Error(`El artefacto no contiene ${paths.join(" ni ")}.`);
}

function readBuildMetadata(path, options, artifact, manifest) {
  if (!path) return {};
  const parsed = JSON.parse(readFileSync(resolve(path), "utf8"));
  const build = Array.isArray(parsed) ? parsed[0] : parsed;
  if (build?.backend === "wallabot-local") {
    if (!options.transaction || !options["version-code-baseline"]) {
      throw new Error("La build local exige transacción y referencia de versionCode.");
    }
    const transaction = JSON.parse(readFileSync(resolve(options.transaction), "utf8"));
    assertLocalBuildMetadata(build, transaction, artifact, options.kind);
    const baseline = JSON.parse(readFileSync(resolve(options["version-code-baseline"]), "utf8"));
    if (baseline.schemaVersion !== 2 || !Number.isSafeInteger(baseline.minimumExclusive)) {
      throw new Error("La referencia de versionCode no corresponde a Production.");
    }
    if (options.kind === "aab") assertVersionCodeProgression(manifest.versionCode, baseline.minimumExclusive);
    return { id: build.attemptId, backend: build.backend, toolchain: build.toolchain };
  }
  if (options.transaction) throw new Error("Una build local exige metadatos locales; no acepta un ID remoto.");
  return {
    id: build?.id ?? null,
    url: build?.artifacts?.applicationArchiveUrl ?? build?.artifacts?.buildUrl ?? null,
  };
}

function fileSha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function inspectArtifact(options, policy, artifact) {
  const archiveListing = run("unzip", ["-l", artifact]);
  const appConfig = extractJsonFromArchive(
    artifact,
    options.kind === "aab" ? ["base/assets/app.config"] : ["assets/app.config", "base/assets/app.config"],
  );

  if (options.kind === "aab") {
    const bundletoolSha256 = fileSha256(resolve(options.bundletool));
    const version = run("java", ["-jar", resolve(options.bundletool), "version"]).trim();
    if (bundletoolSha256 !== policy.bundletool.sha256) {
      throw new Error(`El SHA-256 de bundletool no coincide con ${policy.bundletool.sha256}.`);
    }
    if (!version.includes(policy.bundletool.version)) {
      throw new Error(`Se exige bundletool ${policy.bundletool.version}; recibido ${version}.`);
    }
    run("java", ["-jar", resolve(options.bundletool), "validate", `--bundle=${artifact}`]);
    const manifestXml = run("java", [
      "-jar",
      resolve(options.bundletool),
      "dump",
      "manifest",
      `--bundle=${artifact}`,
      "--module=base",
    ]);
    const jarSignature = run("jarsigner", ["-verify", artifact]);
    if (!/jar verified/i.test(jarSignature)) {
      throw new Error("jarsigner no confirmó la firma del AAB.");
    }
    const certificateOutput = run("keytool", ["-printcert", "-jarfile", artifact]);
    return {
      archiveListing,
      appConfig,
      manifestXml,
      certificateOutput,
      notificationSounds: extractNotificationSoundsFromArchiveListing(archiveListing),
      tools: { bundletoolVersion: policy.bundletool.version, bundletoolSha256 },
    };
  }

  const manifestXml = run("apkanalyzer", ["manifest", "print", artifact]);
  const certificateOutput = run("apksigner", ["verify", "--print-certs", artifact]);
  const resourceTable = run("aapt2", ["dump", "resources", artifact]);
  return {
    archiveListing,
    appConfig,
    manifestXml,
    certificateOutput,
    notificationSounds: extractNotificationSoundsFromCompiledResources(
      resourceTable,
      expectedNotificationSounds(),
    ),
    tools: { aapt2: true, apkanalyzer: true, apksigner: true },
  };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const policy = loadReleasePolicy();
  const artifact = resolve(options.artifact);
  const sourceEvidence = JSON.parse(readFileSync(resolve(options["source-evidence"]), "utf8"));
  const snapshot = JSON.parse(readFileSync(resolve(options.snapshot), "utf8"));
  const inspection = inspectArtifact(options, policy, artifact);
  const manifest = parseManifestXml(inspection.manifestXml);
  const certificateSha256 = extractCertificateDigest(inspection.certificateOutput);
  const size = statSync(artifact).size;
  const sha256 = fileSha256(artifact);
  const detectedMimeType = run("file", ["--brief", "--mime-type", artifact]).trim();
  const httpMimeType = String(options["http-mime"] ?? "").split(";", 1)[0].trim().toLowerCase();
  const publishedFilename = options["published-filename"] ?? basename(artifact);
  const evaluated = evaluateArtifactCandidate({
    policy,
    kind: options.kind,
    profile: options.profile,
    sourceEvidence,
    manifest,
    appConfig: inspection.appConfig,
    snapshot,
    certificateSha256,
    archiveListing: inspection.archiveListing,
    notificationSounds: inspection.notificationSounds,
    size,
    sha256,
    httpMimeType,
    detectedMimeType,
    publishedFilename,
  });
  const evidence = {
    schemaVersion: 2,
    kind: "ProductionArtifactEvidenceV2",
    result: evaluated.violations.length === 0 ? "passed" : "failed",
    verifiedAt: new Date().toISOString(),
    source: {
      commit: sourceEvidence.commit,
      evidenceSha256: fileSha256(resolve(options["source-evidence"])),
      profile: options.profile,
    },
    build: readBuildMetadata(options["build-metadata"], options, { sha256, size }, manifest),
    artifact: {
      filename: basename(artifact),
      publishedFilename,
      type: options.kind,
      size,
      sha256,
      httpMimeType,
      detectedMimeType,
      packageName: manifest.packageName,
      versionName: manifest.versionName,
      versionCode: manifest.versionCode,
      minSdk: manifest.minSdk,
      targetSdk: manifest.targetSdk,
      certificateSha256,
      permissions: manifest.permissions,
      notificationSounds: evaluated.notificationSounds,
    },
    policySnapshot: {
      candidate: snapshot.candidate,
      promptSha256: snapshot.sha256,
      bundleSha256: snapshot.bundleSha256,
      runtimePolicySha256: snapshot.runtimePolicySha256,
      sequence: snapshot.sequence,
    },
    tools: inspection.tools,
    violations: evaluated.violations,
  };
  const output = resolve(options.output);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  if (evidence.result !== "passed") {
    for (const violation of evaluated.violations) {
      console.error(`[${violation.code}] ${violation.message}`);
    }
    throw new Error(`El artefacto de Production no es publicable. Evidencia: ${output}`);
  }
  console.log(`Artefacto Production verificado: ${sha256}. Evidencia: ${output}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
