import assert from "node:assert/strict";
import test from "node:test";
import process from "node:process";

import {
  spawnProcessTree,
  stopProcessTree,
} from "../../apps/mobile/scripts/process-tree.mjs";

test("detiene también los descendientes que conservan abierto el servidor E2E", {
  skip: process.platform === "win32",
}, async (t) => {
  const descendant = `
    process.on("SIGINT", () => {
      process.stdout.write("descendant-stopped\\n", () => process.exit(0));
    });
    process.stdout.write("descendant-ready\\n");
    setInterval(() => {}, 1000);
  `;
  const parent = `
    const { spawn } = require("node:child_process");
    spawn(process.execPath, ["-e", ${JSON.stringify(descendant)}], {
      stdio: ["ignore", "inherit", "inherit"],
    });
    setInterval(() => {}, 1000);
  `;
  const child = spawnProcessTree(process.execPath, ["-e", parent], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += `${chunk}`;
  });
  t.after(() => {
    if (!Number.isInteger(child.pid)) return;
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("el descendiente no arrancó")), 2000);
    const inspect = () => {
      if (!output.includes("descendant-ready")) return;
      clearTimeout(timeout);
      child.stdout.off("data", inspect);
      resolve();
    };
    child.stdout.on("data", inspect);
    inspect();
  });

  await stopProcessTree(child, { graceMs: 1000 });
  assert.match(output, /descendant-stopped/);
});
