// Comprueba que ningún paso pone contenido en la zona reservada para la cámara
// (arriba a la derecha). Sale con código 1 y lista los elementos que la invaden.
//
//   node docs/videos/coach-tool-errors/check-camera.mjs
import { chromium } from "playwright";

const dir = new URL(".", import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto("file://" + dir + "slides.html?static");
await page.evaluate(() => document.fonts.ready);

const bad = [];
const slides = await page.evaluate(() => window.slideList());
for (const [i, s] of slides.entries()) {
  if (s.w !== 1920) continue; // la miniatura no va en el vídeo
  for (let step = 1; step <= s.steps; step++) {
    await page.evaluate(([i, step]) => window.show(i, step), [i, step]);
    await page.waitForTimeout(120); // las animaciones de 1 ms del modo estático tienen que terminar
    const hits = await page.evaluate((i) => {
      const cam = window.cameraZone(); // en píxeles del lienzo 1920×1080
      const slide = document.querySelectorAll(".slide")[i];
      const pieces = [...document.querySelectorAll("#hud > *"), ...slide.querySelectorAll(".card, .tk, .node, .tag, .bubble, .stamp, .badge, .note, .eyebrow, h1, h2, .ann, .x2, svg.wires path, .lane, .console")];
      return pieces.filter((e) => {
        if (e.closest("[data-s]:not(.in)") || getComputedStyle(e).visibility === "hidden" || e.closest("#stage.nohud #hud")) return false;
        const r = e.getBoundingClientRect();
        return r.width && r.right > cam.x && r.top < cam.y + cam.h;
      }).map((e) => (e.className.baseVal ?? e.className) + " «" + (e.textContent || "").trim().slice(0, 40) + "»");
    }, i);
    for (const h of hits) bad.push(`${s.id} paso ${step}: ${h}`);
  }
}
await browser.close();
if (bad.length) { console.log(bad.join("\n")); process.exit(1); }
console.log("Zona de cámara libre en todos los pasos");
