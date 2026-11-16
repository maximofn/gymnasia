/** Controlled web comparison for GYM-43 (ticket para ejecutar tools independientes en paralelo).
 * Real Coach, executor and catalog; fake provider and 200 ms catalog transport.
 * This measures web batch latency, not native CPU, battery or real model latency.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";

const root = process.env.TOOL_BATCH_BENCH_ROOT ?? dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
assert.ok(process.env.TOOL_BATCH_BENCH_DIST, "Set TOOL_BATCH_BENCH_DIST to an exported web build.");
const dist = resolve(process.env.TOOL_BATCH_BENCH_DIST);
assert.ok(existsSync(join(dist, "index.html")), "The exported web build must contain index.html.");
const label = process.env.TOOL_BATCH_BENCH_LABEL ?? "unlabelled";
assert.ok(/^[a-z0-9-]+$/.test(label), "Use a simple label for the report filename.");
const repetitions = Number(process.env.TOOL_BATCH_BENCH_REPETITIONS ?? 30);
assert.ok(Number.isInteger(repetitions) && repetitions > 0 && repetitions <= 100);
const output = process.env.TOOL_BATCH_BENCH_OUTPUT ?? "/tmp/gymnasia-tool-batch-performance";
const delayMs = 200;
const queries = ["press", "curl", "sentadilla"];
const scope = (key) => `gymnasia.development:${key}`;
const storeKey = scope("gymnasia.mobile.local.v3");
const catalogKey = scope("gymnasia.mobile.exercise_catalog.v4");
const mime = { ".html": "text/html", ".js": "application/javascript", ".ttf": "font/ttf", ".png": "image/png", ".json": "application/json", ".wav": "audio/wav" };
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const candidate = normalize(join(dist, pathname === "/" ? "index.html" : pathname));
  const file = candidate.startsWith(`${dist}/`) && existsSync(candidate) ? candidate : join(dist, "index.html");
  response.writeHead(200, { "content-type": mime[extname(file)] ?? "application/octet-stream" });
  response.end(readFileSync(file));
});

function sse(index, items, answer = "") {
  const event = (type, fields) => `event: ${type}\ndata: ${JSON.stringify({ type, ...fields })}\n\n`;
  return event("response.created", { response: { id: `resp_${index}` } })
    + items.map((item, output_index) => event("response.output_item.done", { output_index, item })).join("")
    + (answer ? event("response.output_text.delta", { delta: answer }) : "")
    + event("response.completed", { response: { id: `resp_${index}`, output: items } }) + "data: [DONE]\n\n";
}

function statistics(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const medianMs = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { n: sorted.length, medianMs,
    p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], minMs: sorted[0], maxMs: sorted.at(-1), samplesMs: samples };
}

await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const browser = await chromium.launch({ headless: true });
const samples = { cold: [], warm: [] };
const networkConcurrency = [];
let page;
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const manifest = JSON.parse(readFileSync(join(root, "ejercicios/catalog-v1/manifest.json"), "utf8"));
  const firstPage = readFileSync(join(root, "ejercicios/catalog-v1/pages/0000.json"), "utf8");
  await page.addInitScript(({ key, catalogKey, manifest, firstPage }) => {
    if (sessionStorage.getItem("tool-batch-seeded")) return;
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify({ templates: [], workoutHistory: [], dietByDate: {},
      dietSettings: { goal: "maintain", daily_calories: "2200", macro_mode: "manual_calories",
        manual_macro_calories: { carbs: "1100", protein: "550", fat: "550" },
        protein_grams_per_kg: "2", carbs_grams_per_kg: "3", fat_grams_per_kg: "1" },
      measurements: [], toolOperationReceipts: [], threads: [{ id: "bench", title: "Coach" }],
      messagesByThread: { bench: [] }, keys: [{ provider: "openai", is_active: true,
        api_key: "fake-benchmark-key", model: "gpt-5.6-luna", reasoning_effort: "low" }], chatProvider: "openai", foodAIProvider: "google" }));
    localStorage.setItem(catalogKey, JSON.stringify({ schemaVersion: 4, active: { manifest, fetchedAt: new Date().toISOString() }, previous: null }));
    localStorage.setItem(`${catalogKey}:artifact:${manifest.catalogVersion}:pages/0000.json`, firstPage);
    sessionStorage.setItem("tool-batch-seeded", "1");
  }, { key: storeKey, catalogKey, manifest, firstPage });
  await page.route("**/dev-store", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("https://api.github.com/**", (route) => route.fulfill({ status: 404, body: "{}" }));
  let active = 0, peak = 0, searches = 0;
  await page.route("https://raw.githubusercontent.com/**", async (route) => {
    const url = new URL(route.request().url());
    const prefix = "/maximofn/gymnasia/main/ejercicios/catalog-v1/";
    if (!url.pathname.startsWith(prefix)) return route.fulfill({ status: 404, body: "{}" });
    const relative = url.pathname.slice(prefix.length);
    assert.ok(/^(manifest\.json|pages\/\d{4}\.json|search\/[a-f0-9]{2}\.json|by-id\/[a-f0-9]{2}\.json)$/.test(relative));
    if (relative.startsWith("search/")) {
      searches += 1; active += 1; peak = Math.max(peak, active);
      await sleep(delayMs);
      active -= 1;
    }
    return route.fulfill({ status: 200, contentType: "application/json",
      body: readFileSync(join(root, "ejercicios/catalog-v1", relative), "utf8") });
  });
  let round = 0, started = 0, elapsed = 0, trial = 0;
  await page.route("**/v1/responses*", async (route) => {
    const body = route.request().postDataJSON();
    round += 1;
    assert.ok(round <= 2, "Unexpected provider round.");
    const answer = `Lote ${trial} completado.`;
    if (round === 2) {
      elapsed = performance.now() - started;
      const results = body.input.filter((item) => item.type === "function_call_output");
      assert.deepEqual(results.map((item) => item.call_id), queries.map((_, index) => `call_${trial}_${index}`));
      for (const item of results) {
        const result = JSON.parse(item.output);
        assert.ok(result.results.length > 0, "The actual catalog handler must return exercises.");
      }
    }
    const items = round === 1 ? queries.map((query, index) => ({ type: "function_call",
      id: `fc_${trial}_${index}`, call_id: `call_${trial}_${index}`, name: "search_exercises", arguments: JSON.stringify({ query }) }))
      : [{ type: "message", id: `msg_${trial}`, role: "assistant", content: [{ type: "output_text", text: answer }] }];
    if (round === 1) started = performance.now();
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" },
      body: sse(`${trial}_${round}`, items, round === 2 ? answer : "") });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: "networkidle" });
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.active?.manifest?.itemCount > 0, catalogKey);
  await page.getByTestId("nav-tab-chat").click();
  for (let repetition = -1; repetition < repetitions; repetition += 1) {
    for (const cache of ["cold", "warm"]) {
      if (cache === "cold") await page.evaluate((prefix) => {
        for (const key of Object.keys(localStorage)) if (key.startsWith(prefix) && key.includes("search/")) localStorage.removeItem(key);
      }, catalogKey);
      trial += 1; round = 0; active = 0; peak = 0; searches = 0;
      await page.getByTestId("chat-input").fill(`Busca press, curl y sentadilla, prueba ${trial}.`);
      await page.getByTestId("chat-send").click();
      await page.locator('[data-testid^="chat-message-assistant-"]').filter({ hasText: `Lote ${trial} completado.` }).waitFor();
      assert.equal(round, 2);
      assert.equal(searches, cache === "cold" ? 3 : 0);
      assert.equal(errors.length, 0, errors.join("\n"));
      if (repetition >= 0) {
        samples[cache].push(elapsed);
        if (cache === "cold") networkConcurrency.push(peak);
      }
    }
  }
  mkdirSync(output, { recursive: true });
  const html = readFileSync(join(dist, "index.html"), "utf8");
  const bundlePath = html.match(/src="([^"]+\/index-[a-f0-9]+\.js)"/)?.[1];
  assert.ok(bundlePath, "Record the bundle actually referenced by index.html.");
  const report = { label, scope: "controlled-web-real-tools-fake-provider", delayMs, queries, repetitions,
    sourceCommit: process.env.TOOL_BATCH_BENCH_SOURCE_COMMIT
      ?? execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    bundlePath, bundleSha256: createHash("sha256").update(readFileSync(join(dist, bundlePath))).digest("hex"),
    cacheScope: "Cold clears only search shards; manifest and exercise pages are cached after warmup. Warm retains all catalog caches.",
    browser: browser.version(), viewport: { width: 390, height: 844 }, cold: statistics(samples.cold),
    warm: statistics(samples.warm), networkConcurrency,
    limitation: "Synthetic catalog transport delay. No native device, CPU, battery or real-provider latency claim." };
  writeFileSync(join(output, `${label}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, cold: { ...report.cold, samplesMs: undefined }, warm: { ...report.warm, samplesMs: undefined } }, null, 2));
} catch (error) {
  mkdirSync(output, { recursive: true });
  await page?.screenshot({ path: join(output, `${label}-failure.png`), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
