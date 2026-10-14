// Exporta cada paso de slides.html a un PNG en png/, con el tamaño de su diapositiva.
//
//   node docs/videos/coach-tool-errors/render.mjs
import { mkdirSync, rmSync } from "node:fs";
import { chromium } from "playwright";

const dir = new URL(".", import.meta.url).pathname;
const out = dir + "png/";
rmSync(out, { recursive: true, force: true });
mkdirSync(out);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
// ?static deja cada paso en su estado final, sin animaciones.
await page.goto("file://" + dir + "slides.html?static");
await page.evaluate(() => document.fonts.ready);

let count = 0;
const slides = await page.evaluate(() => window.slideList());
for (const [i, s] of slides.entries()) {
  await page.setViewportSize({ width: s.w, height: s.h });
  for (let step = 1; step <= s.steps; step++) {
    await page.evaluate(([i, step]) => window.show(i, step), [i, step]);
    await page.waitForTimeout(120);
    const name = s.steps > 1 ? `${s.id}-${step}` : s.id;
    await page.screenshot({ path: `${out}${name}.png`, omitBackground: s.transparent });
    count++;
  }
}
await browser.close();
console.log(`${count} PNG en ${out}`);
