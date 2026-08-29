import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const manifestPath = join(repoRoot, "docs/store/google-play/listing.es.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const assetsDir = join(repoRoot, "docs/store/google-play/assets");
const screenshotDir = join(assetsDir, "screenshots");
const tmpDir = join(repoRoot, ".tmp-store-listing");

mkdirSync(assetsDir, { recursive: true });
mkdirSync(screenshotDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

function magick(args) {
  execFileSync("magick", args, { cwd: repoRoot, stdio: "inherit" });
}

function pathFromRepo(relativePath) {
  return join(repoRoot, relativePath);
}

magick([
  "apps/mobile/assets/icon.png",
  "-background", "#0A0E14",
  "-alpha", "background",
  "-flatten",
  "-resize", "512x512!",
  "-alpha", "set",
  "-channel", "A",
  "-evaluate", "set", "100%",
  "+channel",
  "-strip",
  `PNG32:${pathFromRepo(manifest.assets.icon.path)}`,
]);

const browser = await chromium.launch({ headless: true });
const featurePage = await browser.newPage({ viewport: { width: 1024, height: 500 } });
const featureSource = readFileSync(
  join(repoRoot, "docs/store/google-play/sources/feature-graphic.svg"),
  "utf8",
);
await featurePage.setContent(
  `<style>html,body{margin:0;width:1024px;height:500px;overflow:hidden;background:#07090D}</style>${featureSource}`,
);
const featureTmpPath = join(tmpDir, "feature-graphic.png");
await featurePage.screenshot({ path: featureTmpPath, type: "png" });
await featurePage.close();
magick([
  featureTmpPath,
  "-alpha", "off",
  "-strip",
  `PNG24:${pathFromRepo(manifest.assets.featureGraphic.path)}`,
]);

const missingRaw = [];
for (const [index, screenshot] of manifest.assets.screenshots.entries()) {
  const rawPath = pathFromRepo(screenshot.rawPath);
  if (!existsSync(rawPath)) {
    missingRaw.push(screenshot.rawPath);
    continue;
  }

  const composedPath = join(tmpDir, `composed-${index + 1}.png`);
  const outputPath = pathFromRepo(screenshot.path);
  const rawData = readFileSync(rawPath).toString("base64");
  const screenshotPage = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await screenshotPage.setContent(`
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #07090D; }
      .caption { height: 300px; padding: 38px 80px 30px; display: flex; align-items: center; border-bottom: 6px solid #CBFF1A; }
      h1 { margin: 0; color: #F4F7FB; font: 800 52px/1.12 Arial, Helvetica, sans-serif; letter-spacing: -0.6px; }
      img { display: block; width: 1080px; height: 1620px; object-fit: cover; object-position: center; }
    </style>
    <div class="caption"><h1>${escapeHtml(screenshot.caption)}</h1></div>
    <img src="data:image/png;base64,${rawData}" alt="">
  `);
  await screenshotPage.screenshot({ path: composedPath, type: "png" });
  await screenshotPage.close();
  magick([
    composedPath,
    "-alpha", "off",
    "-strip",
    `PNG24:${outputPath}`,
  ]);
}

await browser.close();
rmSync(tmpDir, { recursive: true, force: true });

if (missingRaw.length > 0) {
  console.warn("Icono y feature graphic generados. Faltan las capturas reales:");
  missingRaw.forEach((path) => console.warn(`- ${path}`));
  process.exitCode = 2;
} else {
  console.log("Todos los assets de Google Play se han generado correctamente.");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
