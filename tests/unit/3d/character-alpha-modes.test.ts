/**
 * Two of the twelve shipped characters render see-through.
 *
 * Ch01 and Ch12 declare their body material `BLEND` in glTF. Three's loader
 * maps that to `transparent: true` with `depthWrite: false`, so the four meshes
 * that share it - skin, shirt, jeans, shoes - all draw in the transparent pass
 * against no depth buffer. Whichever mesh happens to draw last wins every
 * overlapping pixel, and the winner changes with the camera: an arm vanishes,
 * a shoulder shows the inside of the back, a thigh shows the leg behind it.
 *
 * Both characters pack hair and body into a single texture, so the sheet
 * carries an alpha channel and their exporter marked every material sampling
 * it as transparent. The other ten keep hair on its own sheet and their bodies
 * came out `OPAQUE`. The distributions below are the real ones, measured from
 * the deployed optimized GLBs.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { classifyAlphaChannel } from "../../../scripts/lib/character-alpha-modes.mjs";

/**
 * Build an alpha channel with the requested split.
 *
 * Ten thousand texels is enough to express a fraction to four decimal places,
 * which is finer than any threshold this classifier uses.
 */
function alphaChannel(opaque: number, clear: number, partial: number) {
  const total = 10_000;
  const channel = new Uint8Array(total);
  let i = 0;
  for (let n = 0; n < Math.round(opaque * total); n += 1) channel[i++] = 255;
  for (let n = 0; n < Math.round(clear * total); n += 1) channel[i++] = 0;
  for (let n = 0; n < Math.round(partial * total); n += 1) channel[i++] = 128;
  // Anything unassigned by rounding stays 0, which is a legitimate value.
  return channel;
}

describe("character alpha-mode classification", () => {
  it("reads a body atlas that only carries a cutout as a cutout", () => {
    // Ch01's body sheet, measured: 98.56% opaque, 0.91% clear, 0.53% between.
    const ch01 = classifyAlphaChannel(alphaChannel(0.9856, 0.0091, 0.0053));
    // Ch12's, measured: 96.00 / 2.38 / 1.62.
    const ch12 = classifyAlphaChannel(alphaChannel(0.96, 0.0238, 0.0162));

    expect(ch01.isCutout).toBe(true);
    expect(ch12.isCutout).toBe(true);
  });

  it("leaves a real hair sheet alone", () => {
    // Ch07's hair sheet, measured: 7.55% opaque, 49.78% clear, 42.67% between.
    // Nearly half of it is a gradient; blending is what it is for.
    const ch07Hair = classifyAlphaChannel(
      alphaChannel(0.0755, 0.4978, 0.4267)
    );
    // Ch22's is the most extreme of the seven: 11.30 / 31.67 / 57.03.
    const ch22Hair = classifyAlphaChannel(alphaChannel(0.113, 0.3167, 0.5703));

    expect(ch07Hair.isCutout).toBe(false);
    expect(ch22Hair.isCutout).toBe(false);
  });

  it("rejects a sheet whose alpha is a genuine gradient over solid colour", () => {
    // A window or a fade: mostly opaque, but the rest is a ramp rather than a
    // stamped hole. Three per cent of intermediate values is enough to mean it.
    const gradient = classifyAlphaChannel(alphaChannel(0.96, 0.01, 0.03));

    expect(gradient.isCutout).toBe(false);
  });

  it("reports the three fractions it measured", () => {
    const stats = classifyAlphaChannel(alphaChannel(0.5, 0.25, 0.25));

    expect(stats.opaqueFraction).toBeCloseTo(0.5, 4);
    expect(stats.clearFraction).toBeCloseTo(0.25, 4);
    expect(stats.partialFraction).toBeCloseTo(0.25, 4);
  });
});

/**
 * The optimized GLBs are gitignored, so this half only runs on a machine that
 * has cut them. A missing large binary is not the same finding as a broken
 * pipeline, and reporting it as one trains people to ignore the suite.
 */
const OPTIMIZED = path.resolve(
  process.cwd(),
  "static/models/avatars/_optimized"
);
const shipped = ["ch01", "ch07", "ch10", "ch12", "ch18", "ch21", "ch22"];
const present = shipped.every((id) =>
  fs.existsSync(path.join(OPTIMIZED, `${id}.glb`))
);

describe.skipIf(!present)("shipped character GLBs", () => {
  it("declares no fully opaque body as a blend", async () => {
    const { readCharacterAlphaModes } = await import(
      "../../../scripts/lib/character-alpha-modes.mjs"
    );

    const offenders: string[] = [];
    for (const id of shipped) {
      const materials = await readCharacterAlphaModes(
        path.join(OPTIMIZED, `${id}.glb`)
      );
      for (const material of materials) {
        if (material.alphaMode === "BLEND" && material.baseColorAlpha === 1) {
          offenders.push(`${id}:${material.name}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  }, 120_000);
});
