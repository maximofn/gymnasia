#!/usr/bin/env node

import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const mobileRequire = createRequire(
  join(repositoryRoot, "apps/mobile/package.json"),
);
const ts = mobileRequire("typescript");

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];

function toPosix(value) {
  return value.split(sep).join("/");
}

function isSourceFile(path) {
  return SOURCE_EXTENSIONS.includes(extname(path));
}

function matchesPath(path, candidate) {
  return candidate.endsWith("/") ? path.startsWith(candidate) : path === candidate;
}

function isExcluded(path, exclusions) {
  return exclusions.some((candidate) => {
    if (candidate.startsWith("*")) {
      return path.endsWith(candidate.slice(1));
    }
    return matchesPath(path, candidate);
  });
}

function walk(directory, root, exclusions, result = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    const relativePath = toPosix(relative(root, absolutePath));
    if (isExcluded(relativePath, exclusions)) {
      continue;
    }
    if (entry.isDirectory()) {
      walk(absolutePath, root, exclusions, result);
    } else if (entry.isFile() && isSourceFile(entry.name)) {
      result.push(relativePath);
    }
  }
  return result.sort();
}

function collectModuleSpecifiers(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers = [];

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      specifiers.push(node.moduleReference.expression.text);
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return [...new Set(specifiers)];
}

function resolveLocalImport(importerPath, specifier, codeRoot) {
  if (!specifier.startsWith(".")) {
    return null;
  }
  const importerAbsolutePath = join(codeRoot, importerPath);
  const unresolvedPath = resolve(dirname(importerAbsolutePath), specifier);
  const candidates = SOURCE_EXTENSIONS.includes(extname(unresolvedPath))
    ? [unresolvedPath]
    : [
        ...SOURCE_EXTENSIONS.map((extension) => `${unresolvedPath}${extension}`),
        ...SOURCE_EXTENSIONS.map((extension) => join(unresolvedPath, `index${extension}`)),
      ];
  const resolvedPath = candidates.find((candidate) => existsSync(candidate));
  if (!resolvedPath) {
    if (extname(unresolvedPath)) {
      return { ignored: true };
    }
    return { missing: true, path: toPosix(relative(codeRoot, unresolvedPath)) };
  }
  const relativePath = toPosix(relative(codeRoot, resolvedPath));
  if (relativePath === ".." || relativePath.startsWith("../")) {
    return { outside: true, path: relativePath };
  }
  return { path: relativePath };
}

function packageName(specifier) {
  if (specifier.startsWith("@")) {
    return specifier.split("/").slice(0, 2).join("/");
  }
  return specifier.split("/")[0];
}

function findLayer(path, layers) {
  return layers.find((layer) => layer.paths.some((candidate) => matchesPath(path, candidate)))?.id ?? null;
}

function isPublicEntry(path, publicEntries) {
  return publicEntries.some((candidate) => matchesPath(path, candidate));
}

function isLegacyImport(importer, imported, rules) {
  return rules.some(
    (rule) =>
      matchesPath(importer, rule.from) &&
      matchesPath(imported, rule.to),
  );
}

function findCycles(graph) {
  const state = new Map();
  const stack = [];
  const cycles = [];
  const cycleKeys = new Set();

  function visit(node) {
    state.set(node, "visiting");
    stack.push(node);
    for (const dependency of graph.get(node) ?? []) {
      if (!graph.has(dependency)) {
        continue;
      }
      if (state.get(dependency) === "visiting") {
        const start = stack.indexOf(dependency);
        const cycle = [...stack.slice(start), dependency];
        const nodes = cycle.slice(0, -1);
        const rotations = nodes.map((_, index) => [
          ...nodes.slice(index),
          ...nodes.slice(0, index),
        ].join(" -> "));
        const key = rotations.sort()[0];
        if (!cycleKeys.has(key)) {
          cycleKeys.add(key);
          cycles.push(cycle);
        }
      } else if (!state.has(dependency)) {
        visit(dependency);
      }
    }
    stack.pop();
    state.set(node, "visited");
  }

  for (const node of graph.keys()) {
    if (!state.has(node)) {
      visit(node);
    }
  }
  return cycles;
}

export function analyzeMobileBoundaries({ rootDir, policy }) {
  const codeRoot = resolve(rootDir, policy.codeRoot);
  const files = walk(codeRoot, codeRoot, policy.exclude ?? []);
  const fileSet = new Set(files);
  const violations = [];
  const graph = new Map(files.map((file) => [file, []]));
  const legacyMatches = new Set();

  for (const file of files) {
    const sourceLayer = findLayer(file, policy.layers);
    if (!sourceLayer) {
      violations.push({ type: "unclassified", file, message: `${file} no pertenece a ninguna capa` });
      continue;
    }
    const sourceText = readFileSync(join(codeRoot, file), "utf8");
    for (const specifier of collectModuleSpecifiers(sourceText, file)) {
      const localImport = resolveLocalImport(file, specifier, codeRoot);
      if (!localImport) {
        const forbidden = policy.forbiddenExternalImports?.[sourceLayer] ?? [];
        const importedPackage = packageName(specifier);
        if (forbidden.includes(importedPackage)) {
          violations.push({
            type: "external-layer",
            file,
            message: `${file} (${sourceLayer}) no puede importar ${specifier}`,
          });
        }
        continue;
      }
      if (localImport.ignored) {
        continue;
      }
      if (localImport.missing) {
        violations.push({
          type: "unresolved",
          file,
          message: `${file} no puede resolver ${specifier}`,
        });
        continue;
      }
      if (localImport.outside || !fileSet.has(localImport.path)) {
        continue;
      }
      graph.get(file).push(localImport.path);
      const targetLayer = findLayer(localImport.path, policy.layers);
      if (!targetLayer) {
        violations.push({
          type: "unclassified-target",
          file,
          message: `${localImport.path} no pertenece a ninguna capa`,
        });
        continue;
      }
      if (sourceLayer === targetLayer) {
        continue;
      }

      const legacyRuleIndex = (policy.legacyImports ?? []).findIndex(
        (rule) => matchesPath(file, rule.from) && matchesPath(localImport.path, rule.to),
      );
      if (legacyRuleIndex >= 0) {
        legacyMatches.add(legacyRuleIndex);
        continue;
      }

      const allowedLayers = policy.allowedDependencies[sourceLayer] ?? [];
      if (!allowedLayers.includes(targetLayer)) {
        violations.push({
          type: "layer",
          file,
          message: `${file} (${sourceLayer}) no puede importar ${localImport.path} (${targetLayer})`,
        });
        continue;
      }
      const publicEntries = policy.publicEntries?.[targetLayer];
      if (publicEntries && !isPublicEntry(localImport.path, publicEntries)) {
        violations.push({
          type: "public-entry",
          file,
          message: `${file} debe importar una entrada publica de ${targetLayer}, no ${localImport.path}`,
        });
      }
    }
  }

  for (const [index, rule] of (policy.legacyImports ?? []).entries()) {
    if (!legacyMatches.has(index)) {
      violations.push({
        type: "stale-legacy",
        file: rule.from,
        message: `La excepcion heredada ${rule.from} -> ${rule.to} ya no se usa; eliminela`,
      });
    }
  }

  for (const cycle of findCycles(graph)) {
    violations.push({
      type: "cycle",
      file: cycle[0],
      message: `Ciclo local: ${cycle.join(" -> ")}`,
    });
  }

  return { files, graph, violations };
}

export function loadPolicy(rootDir = repositoryRoot) {
  return JSON.parse(
    readFileSync(join(rootDir, "scripts/mobile-boundaries/policy.json"), "utf8"),
  );
}

async function main() {
  const policy = loadPolicy(repositoryRoot);
  const result = analyzeMobileBoundaries({ rootDir: repositoryRoot, policy });
  if (result.violations.length > 0) {
    console.error(`Limites moviles: ${result.violations.length} infraccion(es)`);
    for (const violation of result.violations) {
      console.error(`- [${violation.type}] ${violation.message}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(
    `Limites moviles correctos: ${result.files.length} modulos, sin ciclos ni imports prohibidos.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
