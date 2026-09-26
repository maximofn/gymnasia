import { readFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = dirname(fileURLToPath(import.meta.url));

const variants = [
  {
    base: "bases/01-json-valid-base.png",
    output: "01-json-valido-no-listo.png",
    position: "left",
    lines: [
      { text: "JSON", className: "white" },
      { text: "VÁLIDO", className: "white" },
      { text: "≠ LISTO", className: "lime" },
    ],
  },
  {
    base: "bases/02-no-ejecutes-base.png",
    output: "02-no-ejecutes-aun.png",
    position: "top-right",
    lines: [
      { text: "NO EJECUTES", className: "white compact" },
      { text: "AÚN", className: "red hero" },
    ],
  },
  {
    base: "bases/03-tres-providers-base.png",
    output: "03-tres-providers-una-regla.png",
    position: "upper-right",
    lines: [
      { text: "3 PROVIDERS", className: "white compact" },
      { text: "1 REGLA", className: "lime hero" },
    ],
  },
];

await mkdir(join(root, "previews"), { recursive: true });
const font = await readFile("/System/Library/Fonts/Supplemental/Impact.ttf");
const fontUrl = `data:font/ttf;base64,${font.toString("base64")}`;
const browser = await chromium.launch({ headless: true });

try {
  for (const variant of variants) {
    const background = await readFile(join(root, variant.base));
    const backgroundUrl = `data:image/png;base64,${background.toString("base64")}`;
    const lines = variant.lines
      .map(({ text, className }) => `<div class="line ${className}">${text}</div>`)
      .join("");
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.setContent(`<!doctype html>
      <html>
        <head>
          <style>
            @font-face {
              font-family: "Impact Local";
              src: url("${fontUrl}") format("truetype");
              font-display: block;
            }
            * { box-sizing: border-box; }
            html, body { width: 1920px; height: 1080px; margin: 0; overflow: hidden; }
            .poster { position: relative; width: 100%; height: 100%; background: #030609; }
            .poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
            .headline {
              position: absolute;
              z-index: 2;
              font-family: "Impact Local", Impact, sans-serif;
              text-transform: uppercase;
              letter-spacing: -0.015em;
              line-height: 0.87;
              filter: drop-shadow(0 13px 9px rgba(0, 0, 0, 0.7));
            }
            .headline.left { left: 66px; top: 132px; text-align: left; }
            .headline.top-right { right: 72px; top: 82px; text-align: right; }
            .headline.upper-right { right: 68px; top: 48px; text-align: right; }
            .line {
              color: #f7f8fa;
              font-size: 184px;
              -webkit-text-stroke: 14px #050709;
              paint-order: stroke fill;
              white-space: nowrap;
            }
            .line + .line { margin-top: 8px; }
            .line.compact { font-size: 148px; }
            .line.hero { font-size: 226px; }
            .line.lime {
              color: #c8ff00;
              text-shadow: 0 0 32px rgba(200, 255, 0, 0.48);
            }
            .line.red {
              color: #ff4d3d;
              text-shadow: 0 0 32px rgba(255, 77, 61, 0.5);
            }
          </style>
        </head>
        <body>
          <main class="poster">
            <img src="${backgroundUrl}" alt="" />
            <div class="headline ${variant.position}">${lines}</div>
          </main>
        </body>
      </html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(root, variant.output) });
    await page.close();
  }
} finally {
  await browser.close();
}
