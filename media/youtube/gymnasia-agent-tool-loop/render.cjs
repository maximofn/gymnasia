#!/usr/bin/env node
// Export the editable SVGs and assemble the thumbnail with deterministic text.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const directory = __dirname;

async function main() {
  const frames = fs.readdirSync(directory).filter((name) => /^0[1-7]-.*\.svg$/.test(name));
  for (const name of frames) {
    await sharp(path.join(directory, name))
      .png()
      .toFile(path.join(directory, name.replace(/\.svg$/, ".png")));
  }

  const overlay = await sharp(path.join(directory, "thumbnail-overlay.svg")).png().toBuffer();
  const composite = await sharp(path.join(directory, "thumbnail-art.png"))
    .composite([{ input: overlay }])
    .png()
    .toBuffer();
  await sharp(composite)
    .resize(1280, 720)
    .png()
    .toFile(path.join(directory, "thumbnail.png"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
