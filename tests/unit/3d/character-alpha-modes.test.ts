/**
 * Two of the twelve shipped characters render see-through.
 *
 * Ch01 and Ch12 declare their body material `BLEND` in glTF. Three's loader
 * maps that to `transparent: true` with `depthWrite: false`, so the meshes that
 * share it - skin, shirt, jeans, shoes - all draw in the transparent pass
 * against no depth buffer. Whichever mesh happens to draw last wins every
 * overlapping pixel, and the winner changes with the camera: an arm vanishes,
 * a shoulder shows the inside of the back, a thigh shows the leg behind it.
 *
 * Both characters pack hair and body into a single texture, so the sheet
 * carries an alpha channel and their exporter marked every material sampling it
 * transparent. The correction is not a guess about the sheet: rasterizing each
 * material's own UV triangles shows the body meshes sample 739,826 and 741,697
 * texels and not one of them is below the alpha cutoff. Those materials are
 * opaque, which is what the ten correctly exported characters already declare.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  classifySampledAlpha,
  ALPHA_CUTOFF_BYTE,
} from "../../../scripts/lib/character-alpha-modes.mjs";

/** Build a sample set with the requested split of alpha bytes. */
function samples(parts: Array<[value: number, fraction: number]>) {
  const total = 10_000;
  const out = new Uint8Array(total);
  let i = 0;
  for (const [value, fraction] of parts) {
    for (let n = 0; n < Math.round(fraction * total) && i < total; n += 1) {
      out[i++] = value;
    }
  }
  // Rounding leftovers stay 0, which is a legitimate alpha value.
  return out;
}

describe("sampled alpha classification", () => {
  it("calls a wholly opaque sample set opaque rather than masked", () => {
    // Ch01's body, measured: 739,826 sampled texels, every one of them 255.
    const result = classifySampledAlpha(samples([[255, 1]]));

    expect(result.mode).toBe("OPAQUE");
    expect(result.minAlpha).toBe(255);
    expect(result.fractionBelowCutoff).toBe(0);
  });

  it("still calls it opaque when compression left a few texels under 255", () => {
    // Ch12's body, measured: minimum sampled alpha 250. Nowhere near the
    // cutoff, so an alpha test there could only ever cost and never discard.
    const result = classifySampledAlpha(
      samples([
        [250, 0.01],
        [255, 0.99],
      ])
    );

    expect(result.mode).toBe("OPAQUE");
    expect(result.minAlpha).toBe(250);
  });

  it("keeps the alpha test for a two-valued cutout", () => {
    const result = classifySampledAlpha(
      samples([
        [0, 0.6],
        [255, 0.4],
      ])
    );

    expect(result.mode).toBe("MASK");
  });

  it("leaves a genuine gradient as the artist declared it", () => {
    // Ch07's hair, measured over its own UV islands: 42% of what it samples
    // sits strictly between clear and opaque. Blending is what that is for.
    const result = classifySampledAlpha(
      samples([
        [0, 0.5],
        [128, 0.42],
        [255, 0.08],
      ])
    );

    expect(result.mode).toBeNull();
  });

  it("judges an existing mask against its own cutoff", () => {
    const alpha = samples([
      [200, 0.02],
      [255, 0.98],
    ]);

    // At the glTF default the test can never discard, so the mode is pointless.
    expect(classifySampledAlpha(alpha, ALPHA_CUTOFF_BYTE).mode).toBe("OPAQUE");
    // A material that raised its own cutoff above those texels really is
    // cutting something out, and keeps its test.
    expect(classifySampledAlpha(alpha, 220).mode).toBe("MASK");
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
const shipped = [
  "ch01",
  "ch07",
  "ch10",
  "ch12",
  "ch18",
  "ch21",
  "ch22",
  "ch24",
  "ch34",
  "ch41",
  "ch42",
  "ch44",
];
const present = shipped.every((id) =>
  fs.existsSync(path.join(OPTIMIZED, `${id}.glb`))
);

describe.skipIf(!present)("shipped character GLBs", () => {
  it("declares every material the mode its own geometry proves it needs", async () => {
    const { readCharacterAlphaModes } = await import(
      "../../../scripts/lib/character-alpha-modes.mjs"
    );

    const offenders: string[] = [];
    for (const id of shipped) {
      const materials = await readCharacterAlphaModes(
        path.join(OPTIMIZED, `${id}.glb`)
      );
      for (const material of materials) {
        // A translucent base colour is a decision about the whole material and
        // the texture cannot overrule it.
        if (material.baseColorAlpha !== 1) continue;
        if (!material.neededMode) continue;
        if (material.alphaMode !== material.neededMode) {
          offenders.push(
            `${id}:${material.name} declares ${material.alphaMode}, samples ${material.sampledTexels} texels with minimum alpha ${material.minSampledAlpha}, needs ${material.neededMode}`
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  }, 300_000);

  it("leaves a corrected file alone on a second pass", async () => {
    const { normalizeCharacterAlphaModes } = await import(
      "../../../scripts/lib/character-alpha-modes.mjs"
    );

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-modes-"));
    const copy = path.join(dir, "ch01.glb");
    fs.copyFileSync(path.join(OPTIMIZED, "ch01.glb"), copy);
    try {
      expect(await normalizeCharacterAlphaModes(copy)).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
