#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const manifest = JSON.parse(
  await readFile(resolve("scripts/forest-tree-regeneration.json"), "utf8")
);
const candidate = manifest.candidate;
const input = resolve(manifest.outputDirectory, `${candidate.id}_raw.glb`);
const output = resolve(manifest.outputDirectory, `${candidate.id}.glb`);
const reviewOutput = resolve(manifest.outputDirectory, `${candidate.id}_review.glb`);
const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "forest-tree-regeneration-"));
const neutralInput = resolve(temporaryDirectory, `${candidate.id}_neutral.glb`);
const evidenceDirectory = resolve(manifest.evidenceDirectory);

const requireFromCli = createRequire(
  realpathSync(resolve("node_modules/@gltf-transform/cli/package.json"))
);
const [{ NodeIO }, { ALL_EXTENSIONS }] = await Promise.all([
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.read(input);
const calibration = {
  pixels: 0,
  transparentPixels: 0,
  foliagePixels: 0,
  barkAndNeutralPixels: 0,
  barkPaddingPixels: 0,
  originalMeanRgb: [0, 0, 0],
  calibratedMeanRgb: [0, 0, 0],
};
for (const material of document.getRoot().listMaterials()) {
  const baseColorTexture = material.getBaseColorTexture();
  if (baseColorTexture?.getImage()) {
    const originalImage = baseColorTexture.getImage();
    const decoded = await sharp(originalImage)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixels = decoded.data;
    const width = decoded.info.width;
    const height = decoded.info.height;
    let barkMask = new Uint8Array(width * height);
    const originalSum = [0, 0, 0];
    const calibratedSum = [0, 0, 0];
    const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const alpha = pixels[offset + 3];
      if (alpha === 0) {
        calibration.transparentPixels += 1;
        continue;
      }
      const right = pixels[offset];
      const green = pixels[offset + 1];
      const left = pixels[offset + 2];
      originalSum[0] += right;
      originalSum[1] += green;
      originalSum[2] += left;
      const greenDominance = green - Math.max(right, left);
      if (green > 42 && greenDominance > 7) {
        calibration.foliagePixels += 1;
        const variation = ((offset / 4) % 29) / 29 - 0.5;
        pixels[offset] = clamp(right * 0.43 + 10 + variation * 7);
        pixels[offset + 1] = clamp(green * 0.59 + 12 + variation * 11);
        pixels[offset + 2] = clamp(left * 0.72 + 7 - variation * 4);
      } else {
        calibration.barkAndNeutralPixels += 1;
        const luminance = 0.2126 * right + 0.7152 * green + 0.0722 * left;
        const lift = luminance < 130 ? 30 * (1 - luminance / 175) : 0;
        pixels[offset] = clamp(right * 0.95 + lift + 10);
        pixels[offset + 1] = clamp(green * 0.68 + lift * 0.48 + 7);
        pixels[offset + 2] = clamp(left * 0.70 + lift * 0.38 + 7);
        barkMask[offset / 4] = 1;
      }
      calibratedSum[0] += pixels[offset];
      calibratedSum[1] += pixels[offset + 1];
      calibratedSum[2] += pixels[offset + 2];
    }
    for (let pass = 0; pass < 2; pass += 1) {
      const expandedMask = barkMask.slice();
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const index = y * width + x;
          if (barkMask[index]) continue;
          const neighbors = [index - 1, index + 1, index - width, index + width];
          const sourceIndex = neighbors.find((neighbor) => barkMask[neighbor]);
          if (sourceIndex === undefined) continue;
          const targetOffset = index * 4;
          const sourceOffset = sourceIndex * 4;
          pixels[targetOffset] = pixels[sourceOffset];
          pixels[targetOffset + 1] = pixels[sourceOffset + 1];
          pixels[targetOffset + 2] = pixels[sourceOffset + 2];
          expandedMask[index] = 1;
          calibration.barkPaddingPixels += 1;
        }
      }
      barkMask = expandedMask;
    }
    calibration.pixels += decoded.info.width * decoded.info.height;
    const visiblePixels = calibration.pixels - calibration.transparentPixels;
    calibration.originalMeanRgb = originalSum.map((value) => value / visiblePixels);
    calibration.calibratedMeanRgb = calibratedSum.map((value) => value / visiblePixels);
    const calibratedImage = await sharp(pixels, {
      raw: {
        width: decoded.info.width,
        height: decoded.info.height,
        channels: 4,
      },
    })
      .png()
      .toBuffer();
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(
      resolve(evidenceDirectory, "forest-tree-regeneration-base-color-original.png"),
      await sharp(originalImage).png().toBuffer()
    );
    await writeFile(
      resolve(evidenceDirectory, "forest-tree-regeneration-base-color-calibrated.png"),
      calibratedImage
    );
    baseColorTexture.setImage(calibratedImage).setMimeType("image/png");
  }
  material.setMetallicFactor(0.0);
  material.setRoughnessFactor(0.9);
  material.setEmissiveFactor([0, 0, 0]);
  material.setEmissiveTexture(null);
}
await writeFile(
  resolve(evidenceDirectory, "forest-tree-regeneration-texture-calibration.json"),
  `${JSON.stringify(calibration, null, 2)}\n`
);
await io.write(neutralInput, document);
await io.write(reviewOutput, document);

console.log(`${candidate.id}: ${(statSync(input).size / 1024 / 1024).toFixed(1)} MiB raw`);
execFileSync(
  process.execPath,
  [
    resolve("node_modules/@gltf-transform/cli/bin/cli.js"),
    "optimize",
    neutralInput,
    output,
    "--texture-compress",
    "webp",
    "--texture-size",
    String(candidate.optimizedTextureSize),
    "--compress",
    "meshopt",
    "--simplify",
    "false",
    "--instance",
    "true",
    "--flatten",
    "true",
  ],
  { stdio: "inherit" }
);
await rm(temporaryDirectory, { recursive: true, force: true });
console.log(`-> ${output} (${(statSync(output).size / 1024 / 1024).toFixed(1)} MiB)`);
