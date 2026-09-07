#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import sharp from "sharp";

const sourceMoon = resolve("static/textures/moon.png");
const autumnMoon = resolve("static/textures/autumn/moon-512.png");

await mkdir(dirname(autumnMoon), { recursive: true });
await sharp(sourceMoon)
  .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
  .png({ compressionLevel: 9, effort: 10 })
  .toFile(autumnMoon);

console.log(`Wrote ${autumnMoon}`);
