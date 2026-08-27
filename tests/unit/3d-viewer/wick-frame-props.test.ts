import { describe, expect, it } from "vitest";

import { PropType } from "@austencloud/scene-3d";
import { resolvePropTipAnchors3D } from "$lib/shared/3d/effects/prop-tip-geometry-3d";
import { PROP_TIP_POINTS } from "$lib/shared/animation-engine/domain/types/prop-tip-points";
import {
  QUIAD_ARM_LENGTH,
  QUIAD_PROP,
  TRIAD_ARM_LENGTH,
  TRIAD_PROP,
} from "../../../node_modules/@austencloud/scene-3d/src/lib/components/props/triad-frame";

/** The staff length every reach ratio is a fraction of, in metres. */
const STAFF_LENGTH_M = 0.8636;
const STAFF_HALF_M = STAFF_LENGTH_M / 2;
const BUILD = { fanBuild: "pictograph", finish: "day" } as const;

/** Radius of a tip point from the hand, in pictograph units. */
function reach2D(propType: string, index: number): number {
  const point = PROP_TIP_POINTS[propType].points[index];
  return Math.hypot(point.dx, point.dy);
}

/** Smallest angle between two tip points, in degrees. */
function spacing2D(propType: string, from: number, to: number): number {
  const points = PROP_TIP_POINTS[propType].points;
  const a = Math.atan2(points[from].dy, points[from].dx);
  const b = Math.atan2(points[to].dy, points[to].dx);
  const degrees = Math.abs(((b - a) * 180) / Math.PI) % 360;
  return Math.min(degrees, 360 - degrees);
}

describe("wick-frame props", () => {
  it("gives the quiad four arms where the triad has three", () => {
    // This is the bug the parameterization fixed: the quiad branch rendered
    // Triad3D unmodified, so a four-armed prop came out with three arms.
    expect(TRIAD_PROP.arms).toBe(3);
    expect(QUIAD_PROP.arms).toBe(4);

    // The 2D artwork is what the 3D frame has to mirror.
    expect(PROP_TIP_POINTS.triad.points).toHaveLength(3);
    expect(PROP_TIP_POINTS.quiad.points).toHaveLength(4);
    expect(spacing2D("quiad", 0, 1)).toBeCloseTo(90, 4);
    expect(spacing2D("quiad", 1, 2)).toBeCloseTo(90, 4);
  });

  it("keeps the quiad's own arm, which is shorter than the triad's", () => {
    // Easy to miss: a quiad is not a triad with a fourth spine welded on.
    expect(QUIAD_ARM_LENGTH).toBeLessThan(TRIAD_ARM_LENGTH);

    // Both reaches come from the shipped 2D tip points, because those are what
    // the mandala radius and the trail geometry already measure against.
    const derived =
      (TRIAD_ARM_LENGTH * reach2D("quiad", 0)) / reach2D("triad", 0);
    expect(QUIAD_ARM_LENGTH).toBeCloseTo(derived, 5);
    expect(QUIAD_PROP.armLength).toBe(QUIAD_ARM_LENGTH);
    expect(TRIAD_PROP.armLength).toBe(TRIAD_ARM_LENGTH);
  });

  it("puts all four quiad emitters on its canonical arm ends", () => {
    const anchors = resolvePropTipAnchors3D(PropType.QUIAD, STAFF_HALF_M, BUILD);
    const [anchor] = anchors;

    expect(anchors).toHaveLength(4);
    expect(anchor.effectTipIndex).toBe(1);
    expect(anchor.offset.y).toBeCloseTo(STAFF_LENGTH_M * (104.17 / 252.8), 6);

    // The 3D reach used to borrow TRIAD_REACH_RATIO, which was only right while
    // the quiad was rendering as a three-armed prop.
    const [triadAnchor] = resolvePropTipAnchors3D(
      PropType.TRIAD,
      STAFF_HALF_M,
      BUILD
    );
    expect(anchor.offset.y).toBeLessThan(triadAnchor.offset.y);
  });

  it("tracks the sword's tip at the GLB blade apex", () => {
    // sword.glb puts 20.98in of blade forward of the guard on a 34.00in prop.
    const [anchor] = resolvePropTipAnchors3D(
      PropType.SWORD,
      STAFF_HALF_M,
      BUILD
    );
    expect(anchor.offset.y).toBeCloseTo(STAFF_LENGTH_M * (20.98 / 34), 4);
  });
});
