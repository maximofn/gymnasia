import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const assetDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = join(assetDirectory, "captures");
const presentationUrl = pathToFileURL(join(assetDirectory, "index.html")).href;

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

await page.goto(`${presentationUrl}?capture=thumbnail#scene-1`);
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(500);
await page.evaluate(() => document.activeElement?.blur());
await page.screenshot({
  path: join(outputDirectory, "thumbnail-1920x1080.png"),
});

const sceneCount = await page.locator("[data-scene]").count();
for (let sceneIndex = 1; sceneIndex <= sceneCount; sceneIndex += 1) {
  await page.goto(`${presentationUrl}?capture=${sceneIndex}#scene-${sceneIndex}`);
  await page.waitForTimeout(500);
  const maxStep = Number(
    await page.locator("[data-scene].is-active").getAttribute("data-max-step"),
  );
  for (let step = 0; step < maxStep; step += 1) {
    await page.keyboard.press("ArrowRight");
  }
  await page.waitForTimeout(500);
  await page.evaluate(() => document.activeElement?.blur());
  await page.screenshot({
    path: join(outputDirectory, `scene-${String(sceneIndex).padStart(2, "0")}.png`),
  });
}

await browser.close();
console.log(`Captured ${sceneCount} scenes in ${outputDirectory}`);
