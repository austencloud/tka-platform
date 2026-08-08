#!/usr/bin/env node
/** Bake the Forest floor's repeating detail and macro ecology into one map. */

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const SOURCE = resolve("static/textures/forest-floor/diffuse.jpg");
const OUTPUT = resolve("static/textures/forest-floor/forest-floor-zoned.jpg");
const SIZE = 4096;
const MACRO_SIZE = 512;
const WORLD_EXTENT = 200;
const DETAIL_METRES = 5.2;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function zoneNoise(x, y) {
  return (
    0.54 * Math.sin(x * 0.057 + y * 0.031) +
    0.31 * Math.cos(x * 0.029 - y * 0.063) +
    0.15 * Math.sin((x + y) * 0.101)
  );
}

function shadePattern(x, y) {
  return (
    0.62 * Math.sin(x * 0.043 - y * 0.026) +
    0.38 * Math.cos(x * 0.024 + y * 0.052)
  );
}

function ellipseMetric(x, y, [centerX, centerY, radiusX, radiusY, rotation]) {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const localX = (x - centerX) * cosine + (y - centerY) * sine;
  const localY = -(x - centerX) * sine + (y - centerY) * cosine;
  return Math.hypot(localX / radiusX, localY / radiusY);
}

const DAMP_HOLLOWS = [
  [-58, 34, 23, 14, -0.28],
  [56, 47, 27, 16, 0.42],
  [73, -43, 24, 15, -0.62],
  [-66, -58, 31, 17, 0.24],
];

function mixColor(first, second, weight) {
  const amount = clamp(weight);
  return first.map(
    (channel, index) => channel + (second[index] - channel) * amount
  );
}

function macroTint(x, y) {
  const radius = Math.hypot(x, y);
  const noise = zoneNoise(x, y);
  const leaf = [1.02, 1.01, 0.93];
  const moss = [0.82, 1.08, 0.76];
  const damp = [0.77, 0.88, 0.88];
  const distant = [0.82, 0.91, 0.81];
  const path = [1.03, 0.88, 0.72];
  const packed = [1.08, 0.91, 0.76];
  const shadeWeight = smoothstep(0.04, 0.76, shadePattern(x, y) + noise * 0.24);
  const dampWeight = Math.max(
    ...DAMP_HOLLOWS.map(
      (hollow) => 1 - smoothstep(0.72, 1.36, ellipseMetric(x, y, hollow))
    )
  );
  const distantWeight = smoothstep(106 + noise * 7, 142 + noise * 9, radius);
  const pathWeight =
    smoothstep(27, 33, radius) * (1 - smoothstep(36, 45, radius));
  const packedWeight = 1 - smoothstep(27, 33, radius);

  let color = mixColor(leaf, moss, shadeWeight * 0.72);
  color = mixColor(color, damp, dampWeight * 0.82);
  color = mixColor(color, distant, distantWeight * 0.78);
  color = mixColor(color, path, pathWeight);
  color = mixColor(color, packed, packedWeight);
  const brightness = 0.99 + 0.035 * Math.sin(x * 0.083 + y * 0.047);
  return color.map((channel) => channel * brightness);
}

function fract(value) {
  return value - Math.floor(value);
}

const tileSize = Math.max(
  32,
  Math.round((SIZE * DETAIL_METRES) / (WORLD_EXTENT * 2))
);
const { data: tile, info } = await sharp(SOURCE)
  .resize(tileSize, tileSize, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const output = Buffer.allocUnsafe(SIZE * SIZE * 3);

for (let pixelY = 0; pixelY < SIZE; pixelY += 1) {
  const worldY = WORLD_EXTENT - (pixelY / (SIZE - 1)) * WORLD_EXTENT * 2;
  for (let pixelX = 0; pixelX < SIZE; pixelX += 1) {
    const worldX = -WORLD_EXTENT + (pixelX / (SIZE - 1)) * WORLD_EXTENT * 2;
    const warpedX =
      worldX +
      0.78 * Math.sin(worldY * 0.031) +
      0.32 * Math.cos((worldX + worldY) * 0.057);
    const warpedY =
      worldY +
      0.71 * Math.cos(worldX * 0.029) -
      0.29 * Math.sin((worldX - worldY) * 0.061);
    const sourceX = Math.min(
      info.width - 1,
      Math.floor(fract(warpedX / DETAIL_METRES) * info.width)
    );
    const sourceY = Math.min(
      info.height - 1,
      Math.floor((1 - fract(warpedY / DETAIL_METRES)) * info.height)
    );
    const sourceIndex = (sourceY * info.width + sourceX) * info.channels;
    const outputIndex = (pixelY * SIZE + pixelX) * 3;
    for (let channel = 0; channel < 3; channel += 1) {
      output[outputIndex + channel] = tile[sourceIndex + channel];
    }
  }
}

const macro = Buffer.allocUnsafe(MACRO_SIZE * MACRO_SIZE * 3);
for (let pixelY = 0; pixelY < MACRO_SIZE; pixelY += 1) {
  const worldY = WORLD_EXTENT - (pixelY / (MACRO_SIZE - 1)) * WORLD_EXTENT * 2;
  for (let pixelX = 0; pixelX < MACRO_SIZE; pixelX += 1) {
    const worldX =
      -WORLD_EXTENT + (pixelX / (MACRO_SIZE - 1)) * WORLD_EXTENT * 2;
    const tint = macroTint(worldX, worldY);
    const index = (pixelY * MACRO_SIZE + pixelX) * 3;
    for (let channel = 0; channel < 3; channel += 1) {
      macro[index + channel] = Math.round(clamp(tint[channel]) * 255);
    }
  }
}

const macroLayer = await sharp(macro, {
  raw: { width: MACRO_SIZE, height: MACRO_SIZE, channels: 3 },
})
  .resize(SIZE, SIZE, { kernel: sharp.kernel.cubic })
  .png()
  .toBuffer();

await mkdir(dirname(OUTPUT), { recursive: true });
await sharp(output, { raw: { width: SIZE, height: SIZE, channels: 3 } })
  .composite([{ input: macroLayer, blend: "multiply" }])
  .jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true })
  .toFile(OUTPUT);

console.log(
  JSON.stringify(
    {
      output: OUTPUT,
      size: SIZE,
      macroSize: MACRO_SIZE,
      detailTilePixels: tileSize,
      worldExtent: WORLD_EXTENT,
    },
    null,
    2
  )
);
