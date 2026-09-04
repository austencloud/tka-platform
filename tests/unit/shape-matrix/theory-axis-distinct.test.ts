import { describe, expect, it } from "vitest";

import { buildTheorySpinRatioAtlas, spinRatioKey, type SpinRatio } from "@vtg/domain";
import {
  buildTheoryAxis,
  theoryFlowerKey,
  theorySoloKnobs,
  type TheoryFlower,
} from "$lib/shared/shape-matrix/domain/theory-flower";
import { traceScaledPath } from "$lib/shared/notation/qft/qft-model";

/*
 * The grid draws one tile per axis variant, so two variants that trace the
 * same curve are a duplicate tile and a missing shape.
 *
 * That is exactly what 1:2 shipped: `in` and `out` are one flower entered half
 * a period apart, so the surface showed the down-facing petal twice and never
 * showed the up-facing one. The law is in `startsCoincide`; this file is the
 * geometry that law claims, checked by drawing the curves.
 */

const HAND_UNITS = 1;
const PROP_UNITS = 0.84; // a staff's tracked tip, in hand-orbit radii

/** Tolerance sits well above the sampling pitch and far below any real gap. */
const SAME_LOCUS = 0.02;

type Point = { x: number; y: number };

function curve(flower: TheoryFlower, samples: number): Point[] {
  return traceScaledPath(
    theorySoloKnobs(flower),
    { hand: HAND_UNITS, prop: PROP_UNITS },
    samples
  );
}

/** How far the worst point of `probe` sits from the nearest point of `dense`. */
function strayDistance(probe: Point[], dense: Point[]): number {
  let worst = 0;
  for (const p of probe) {
    let best = Infinity;
    for (const d of dense) {
      const gap = (d.x - p.x) ** 2 + (d.y - p.y) ** 2;
      if (gap < best) best = gap;
    }
    if (best > worst) worst = best;
  }
  return Math.sqrt(worst);
}

/** Set equality of the two drawn paths, which is what a viewer compares. */
function drawsTheSameCurve(a: TheoryFlower, b: TheoryFlower): boolean {
  const denseA = curve(a, 1500);
  const denseB = curve(b, 1500);
  const probeA = curve(a, 150);
  const probeB = curve(b, 150);
  return (
    strayDistance(probeB, denseA) < SAME_LOCUS &&
    strayDistance(probeA, denseB) < SAME_LOCUS
  );
}

function orisOf(ratio: SpinRatio): string[] {
  return buildTheoryAxis(ratio)
    .filter((flower) => flower.style === "pro")
    .map((flower) => flower.ori);
}

function ratio(propRotations: number, handCycles: number): SpinRatio {
  return { propRotations, handCycles } as SpinRatio;
}

describe("theory axis variants are distinct curves", () => {
  it("never emits two variants that draw the same path, anywhere in the atlas", () => {
    const duplicates: string[] = [];

    for (const atlasRatio of buildTheorySpinRatioAtlas()) {
      const axis = buildTheoryAxis(atlasRatio);
      for (let i = 0; i < axis.length; i += 1) {
        for (let j = i + 1; j < axis.length; j += 1) {
          const a = axis[i] as TheoryFlower;
          const b = axis[j] as TheoryFlower;
          if (drawsTheSameCurve(a, b)) {
            duplicates.push(`${theoryFlowerKey(a)} == ${theoryFlowerKey(b)}`);
          }
        }
      }
    }

    expect(duplicates).toEqual([]);
  });

  it("keeps in and out for every odd hand-cycle ratio", () => {
    for (const atlasRatio of buildTheorySpinRatioAtlas()) {
      if (atlasRatio.handCycles % 2 === 0) continue;
      if (atlasRatio.propRotations === 0) continue; // float owns four starts
      expect(orisOf(atlasRatio), spinRatioKey(atlasRatio)).toEqual([
        "in",
        "out",
      ]);
    }
  });

  it("replaces the collapsed start with the quarter turn at 1:2", () => {
    // `out` is `in` re-entered here, and `clock` is the flower flipped end for
    // end: the variant the grid was missing rather than a fifth one.
    expect(orisOf(ratio(1, 2))).toEqual(["in", "clock"]);
    expect(buildTheoryAxis(ratio(1, 2)).map(theoryFlowerKey)).toEqual([
      "1:2-pro-in",
      "1:2-pro-clock",
      "1:2-anti-in",
      "1:2-anti-clock",
    ]);
  });

  it("drops to one start where every compass start coincides", () => {
    // A hand-cycle count divisible by four leaves nothing for a quarter turn
    // to separate, so those axes are two rows rather than four.
    for (const collapsed of [ratio(1, 4), ratio(3, 4), ratio(1, 8), ratio(7, 8)]) {
      expect(orisOf(collapsed), spinRatioKey(collapsed)).toEqual(["in"]);
      expect(buildTheoryAxis(collapsed)).toHaveLength(2);
    }
  });

  it("leaves the endpoints exactly as they were", () => {
    expect(buildTheoryAxis(ratio(0, 1)).map((f) => f.ori)).toEqual([
      "in",
      "out",
      "clock",
      "counter",
    ]);
    expect(buildTheoryAxis(ratio(1, 0)).map(theoryFlowerKey)).toEqual([
      "1:0-pro-out",
    ]);
  });
});
