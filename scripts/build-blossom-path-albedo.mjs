#!/usr/bin/env node
/**
 * Derive the Blossom garden's walking-surface albedo from the shared rock set.
 *
 * The terrain library ships four albedos and none of them is a path. `rock` is
 * the only one with real aggregate grain, but it is wet dark slate: a mean of
 * roughly sRGB 0.31 with an olive-blue cast. Laid across a garden at night it
 * renders darker than the lawn beside it, so every walk read as asphalt poured
 * over grass. Crushed stone under a moon is the brightest thing on a garden
 * floor, not the darkest.
 *
 * A baseColorFactor cannot fix that. glTF clamps the factor to one, so it can
 * only ever darken, and the lift needed here is more than four times. This pass
 * does the lift once, offline, in texture space: desaturate toward luminance to
 * drop the olive cast, raise the midtones, and stretch what is left so the
 * aggregate survives the brightening instead of washing into a flat sheet.
 *
 * Input:  static/textures/terrain/rock/diffuse.jpg
 * Output: static/textures/blossom-floor/path-fines-albedo.jpg
 *
 * The normal and roughness maps are reused from the rock set unchanged — only
 * the colour was wrong.
 */

import sharp from "sharp";
import { resolve } from "path";

const INPUT = resolve("static/textures/terrain/rock/diffuse.jpg");
const OUTPUT = resolve("static/textures/blossom-floor/path-fines-albedo.jpg");

/** How far each texel is pulled toward its own luminance. */
const DESATURATION = 0.62;
/** Midtone lift, applied as an inverse gamma. */
const MIDTONE_GAMMA = 1.95;
/**
 * Contrast stretch about the lifted midpoint.
 *
 * The first pass lifted to a mean of about 0.59 and left the contrast near the
 * source's. Seen from standing height that surface was pale but soft: the
 * aggregate had been brightened into a smear rather than sharpened into grains.
 * A harder stretch about a lower pivot keeps the mean where a moonlit walk
 * belongs while pushing the dark interstices back down, which is what actually
 * reads as loose stone underfoot.
 */
const CONTRAST = 1.52;
const CONTRAST_PIVOT = 0.52;
/** Faint warm cast, so the walks separate from the lawn by hue as well as value. */
const WARMTH = [1.035, 1.0, 0.935];

const clamp = (value) => Math.min(1, Math.max(0, value));

const source = sharp(INPUT);
const { width, height } = await source.metadata();
const { data } = await source.raw().toBuffer({ resolveWithObject: true });
const channels = data.length / (width * height);

let sum = [0, 0, 0];
let sourceSum = [0, 0, 0];

for (let index = 0; index < data.length; index += channels) {
  const rgb = [data[index] / 255, data[index + 1] / 255, data[index + 2] / 255];
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];

  for (let channel = 0; channel < 3; channel += 1) {
    sourceSum[channel] += rgb[channel];
    let value = rgb[channel] + (luminance - rgb[channel]) * DESATURATION;
    value = Math.pow(value, 1 / MIDTONE_GAMMA);
    value = clamp(CONTRAST_PIVOT + (value - CONTRAST_PIVOT) * CONTRAST);
    value = clamp(value * WARMTH[channel]);
    sum[channel] += value;
    data[index + channel] = Math.round(value * 255);
  }
}

const texels = width * height;
const format = (totals) =>
  totals.map((total) => (total / texels).toFixed(3)).join(", ");

await sharp(data, { raw: { width, height, channels } })
  .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
  .toFile(OUTPUT);

console.log(`Input:  ${INPUT} (${width}x${height})`);
console.log(`Output: ${OUTPUT}`);
console.log(`  source mean sRGB: [${format(sourceSum)}]`);
console.log(`  path mean sRGB:   [${format(sum)}]`);
