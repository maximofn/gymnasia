import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { analyzeMobileBoundaries } from "./check.mjs";

const basePolicy = {
  codeRoot: "mobile",
  exclude: [],
  layers: [
    { id: "controllers", paths: ["controllers/"] },
    { id: "screens", paths: ["screens/"] },
    { id: "platform", paths: ["platform/"] },
    { id: "domain", paths: ["domain/"] },
  ],
  allowedDependencies: {
    controllers: ["domain", "platform"],
    screens: ["controllers", "domain"],
    platform: [],
    domain: [],
  },
  publicEntries: {
    controllers: ["controllers/types.ts"],
    domain: ["domain/index.ts"],
    platform: ["platform/index.ts"],
  },
  forbiddenExternalImports: {
    domain: ["react-native", "expo-file-system"],
    screens: ["expo-file-system"],
  },
  legacyImports: [],
};

async function withFixture(files, run) {
  const root = await mkdtemp(join(tmpdir(), "gymnasia-mobile-boundaries-"));
  try {
    for (const [path, source] of Object.entries(files)) {
      const absolutePath = join(root, "mobile", path);
      mkdirSync(join(absolutePath, ".."), { recursive: true });
      writeFileSync(absolutePath, source);
    }
    return await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("accepts imports through public entries and dynamic imports", async () => {
  await withFixture(
    {
      "domain/index.ts": "export const value = 1;",
      "platform/index.ts": "export const storage = {};",
      "controllers/types.ts": "export type Controller = {};",
      "controllers/home.ts": "import { value } from '../domain'; export const load = () => import('../platform');",
      "screens/Home.tsx": "import type { Controller } from '../controllers/types'; export const screen = null;",
    },
    (root) => {
      const result = analyzeMobileBoundaries({ rootDir: root, policy: basePolicy });
      assert.deepEqual(result.violations, []);
    },
  );
});

test("rejects private cross-layer imports and forbidden platform APIs", async () => {
  await withFixture(
    {
      "domain/index.ts": "export const value = 1;",
      "domain/private.ts": "import { View } from 'react-native'; export const secret = View;",
      "controllers/types.ts": "export type Controller = {};",
      "screens/Home.tsx": "import { secret } from '../domain/private'; export const screen = secret;",
      "platform/index.ts": "export const storage = {};",
    },
    (root) => {
      const result = analyzeMobileBoundaries({ rootDir: root, policy: basePolicy });
      assert.ok(result.violations.some(({ type }) => type === "public-entry"));
      assert.ok(result.violations.some(({ type }) => type === "external-layer"));
    },
  );
});

test("rejects local cycles", async () => {
  await withFixture(
    {
      "domain/index.ts": "export { value } from './value';",
      "domain/value.ts": "import './index'; export const value = 1;",
      "controllers/types.ts": "export type Controller = {};",
      "platform/index.ts": "export const storage = {};",
      "screens/Home.tsx": "export const screen = null;",
    },
    (root) => {
      const result = analyzeMobileBoundaries({ rootDir: root, policy: basePolicy });
      assert.ok(result.violations.some(({ type }) => type === "cycle"));
    },
  );
});
