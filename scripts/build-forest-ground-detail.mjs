#!/usr/bin/env node
/** Build the repeatable, walking-distance detail families for Forest terrain. */

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const OUTPUT_DIRECTORY = resolve("static/textures/forest-floor");
const families = {
  neutral: {
    source: resolve("static/textures/forest-floor/diffuse.jpg"),
    brightness: 0.92,
    saturation: 0.78,
  },
  meadow: {
    source: resolve("static/textures/terrain/grass/diffuse.jpg"),
    brightness: 1.06,
    saturation: 1.02,
  },
  litter: {
    source: resolve(
      "assets/3d-source/forest/ground-materials/forest-leaves-diffuse.jpg"
    ),
    brightness: 0.78,
    saturation: 0.78,
  },
  damp: {
    source: resolve(
      "assets/3d-source/forest/ground-materials/brown-mud-diffuse.jpg"
    ),
    brightness: 0.88,
    saturation: 0.72,
  },
};

await mkdir(OUTPUT_DIRECTORY, { recursive: true });
const outputs = [];
for (const [family, settings] of Object.entries(families)) {
  const output = resolve(
    OUTPUT_DIRECTORY,
    `forest-ground-detail-${family}.jpg`
  );
  await sharp(settings.source)
    .resize(1024, 1024, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.lanczos3,
    })
    .modulate({
      brightness: settings.brightness,
      saturation: settings.saturation,
    })
    .sharpen({ sigma: 0.62, m1: 0.52, m2: 1.04 })
    .jpeg({ quality: 88, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(output);
  const metadata = await sharp(output).metadata();
  outputs.push({
    family,
    source: settings.source,
    output,
    width: metadata.width,
    height: metadata.height,
  });
}

console.log(JSON.stringify(outputs, null, 2));
