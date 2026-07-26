import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TrackingMode } from "$lib/shared/animation-engine/domain/types/trail-types";
import { getPropDimensions } from "$lib/shared/animation-engine/services/IPropTextureLoader";
import { setTrailPointOverrideProvider } from "$lib/shared/animation-engine/domain/types/trail-point-types";
import { setTipPointOverrideProvider } from "$lib/shared/animation-engine/domain/types/prop-tip-points";
import { resolveTrailPointConfig } from "$lib/shared/animation-engine/domain/types/trail-point-types";
import { ENGINE_GRID_RADIUS } from "$lib/shared/mandala/domain/mandala-constants";
import {
  computeEngineAlignedMandalaScale,
  resolveMandalaTipOffsets,
} from "$lib/shared/mandala/services/mandala-path-preparer";
import { calculate } from "$lib/shared/mandala/services/mandala-geometry-calculator";
import type {
  MandalaTipOverrides,
  StepLike,
} from "$lib/shared/mandala/services/types";

// Both derive from the prop's own pictograph viewBox half-width — the animation
// canvas draws that artwork, so the traced tip sits on its visible end.
const CLUB_TIP_REACH = 258.67 / 2;
const STAFF_TIP_REACH = 252.8 / 2;

afterEach(() => {
  setTrailPointOverrideProvider(null);
  setTipPointOverrideProvider(null);
});

function staticEastStep(): StepLike {
  const motion = {
    motionType: "static",
    rotationDirection: "noRotation",
    startLocation: "e",
    endLocation: "e",
    turns: 0,
    startOrientation: "out",
    endOrientation: "out",
  };
  return {
    motions: {
      blue: { ...motion },
      red: { ...motion },
    },
  };
}

function zeroTurnAntiStep(): StepLike {
  return {
    motions: {
      blue: {
        motionType: "anti",
        rotationDirection: "ccw",
        startLocation: "w",
        endLocation: "n",
        turns: 0,
        startOrientation: "in",
        endOrientation: "out",
      },
    },
  };
}

function firstPoint(path: string): { x: number; y: number } {
  const match = /^M (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/.exec(path);
  if (!match) throw new Error(`Expected SVG move command, received: ${path}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

describe("animation mandala trail-point alignment", () => {
  it("keeps the animated club short of the grid center and aligned with its traced tip", () => {
    const dimensions = getPropDimensions("club");
    const clubSvg = readFileSync(
      // The pictograph family is what the animation canvas fetches now
      // (svg-generator's resolvePropSvgPath). The club's two files are
      // byte-identical — it was the first prop converged onto this family.
      resolve(process.cwd(), "static/images/props/pictograph/club.svg"),
      "utf8"
    );
    const viewBox = /viewBox=["']0 0 ([\d.]+) ([\d.]+)["']/.exec(clubSvg);
    const tracedTip = resolveMandalaTipOffsets(
      "club",
      TrackingMode.RIGHT_END
    )[0]!;

    expect(dimensions).toEqual({ width: 258.67, height: 34.17 });
    expect(viewBox?.slice(1).map(Number)).toEqual([
      dimensions.width,
      dimensions.height,
    ]);
    expect(150 - dimensions.width / 2).toBeCloseTo(20.665, 3);
    expect(tracedTip.dx).toBe(CLUB_TIP_REACH);
  });

  // The mandala traces the point the trail draws from. It used to read the
  // baseline table while the trail read the override table, and the two order a
  // prop's arms differently, so the mandala came out rotated off the trail.
  it("traces the same point the trail system selected", () => {
    setTipPointOverrideProvider((propType) =>
      propType === "club" ? { points: [{ dx: 150, dy: 0 }] } : null
    );

    expect(resolveMandalaTipOffsets("club", TrackingMode.RIGHT_END)).toEqual([
      { dx: 150, dy: 0 },
    ]);
  });

  it("follows an override that reorders a prop's arms instead of tracing a different arm", () => {
    // Triad's saved points list the rear-upper arm first and the forward arm
    // second; the code table lists them the other way round. The trail picks
    // the index off the saved list, so the mandala has to resolve it there too.
    const saved = [
      { dx: -62.2, dy: -107.8 },
      { dx: 124.4, dy: 0 },
      { dx: -62.2, dy: 107.8 },
    ];
    setTipPointOverrideProvider((propType) =>
      propType === "triad" ? { points: saved } : null
    );

    const [mandalaTip] = resolveMandalaTipOffsets(
      "triad",
      TrackingMode.RIGHT_END
    );
    const trail = resolveTrailPointConfig("triad");
    const trailSource = trail.right;
    expect(trailSource.type).toBe("tip");
    const trailTip = saved[(trailSource as { index: number }).index]!;

    expect(mandalaTip).toEqual({ dx: trailTip.dx, dy: trailTip.dy });
    expect(mandalaTip).toEqual({ dx: 124.4, dy: 0 });
  });

  it("keeps a zero-turn anti-spin club locus off center", () => {
    const [resolvedClubTip] = resolveMandalaTipOffsets(
      "club",
      TrackingMode.RIGHT_END
    );

    const resizedPaths = calculate(
      [zeroTurnAntiStep()],
      "club",
      undefined,
      undefined,
      {
        blue: [resolvedClubTip!],
        red: [],
      }
    );
    const oldFullRadiusPaths = calculate(
      [zeroTurnAntiStep()],
      "club",
      undefined,
      undefined,
      {
        blue: [{ dx: ENGINE_GRID_RADIUS, dy: 0 }],
        red: [],
      }
    );
    const scale = computeEngineAlignedMandalaScale(950);
    const resizedStart = firstPoint(resizedPaths.blue[0]!.d);
    const oldStart = firstPoint(oldFullRadiusPaths.blue[0]!.d);

    expect(Math.hypot(resizedStart.x, resizedStart.y) * scale).toBeCloseTo(
      ENGINE_GRID_RADIUS - CLUB_TIP_REACH,
      1
    );
    expect(Math.hypot(oldStart.x, oldStart.y) * scale).toBeCloseTo(0, 1);
  });

  it("uses the same physical endpoint selection as live trail tracking", () => {
    expect(resolveMandalaTipOffsets("club", TrackingMode.LEFT_END)).toEqual([
      { dx: CLUB_TIP_REACH, dy: 0 },
    ]);
    expect(resolveMandalaTipOffsets("staff", TrackingMode.LEFT_END)).toEqual([
      { dx: -STAFF_TIP_REACH, dy: 0 },
    ]);
    expect(resolveMandalaTipOffsets("staff", TrackingMode.RIGHT_END)).toEqual([
      { dx: STAFF_TIP_REACH, dy: 0 },
    ]);
    expect(resolveMandalaTipOffsets("staff", TrackingMode.BOTH_ENDS)).toEqual([
      { dx: -STAFF_TIP_REACH, dy: 0 },
      { dx: STAFF_TIP_REACH, dy: 0 },
    ]);
    // The fan's outer rib lands on the club's reach — the whole point of the
    // pictograph convergence.
    expect(resolveMandalaTipOffsets("fan", TrackingMode.RIGHT_END)).toEqual([
      { dx: 130, dy: 0 },
    ]);
    expect(resolveMandalaTipOffsets("staff", TrackingMode.HAND)).toEqual([
      { dx: 0, dy: 0 },
    ]);
  });

  it("honors custom trail points instead of falling back to prop defaults", () => {
    setTrailPointOverrideProvider(() => ({
      left: { type: "custom", dx: -92, dy: 14 },
      right: { type: "custom", dx: 147, dy: -11 },
    }));

    expect(resolveMandalaTipOffsets("staff", TrackingMode.BOTH_ENDS)).toEqual([
      { dx: -92, dy: 14 },
      { dx: 147, dy: -11 },
    ]);
  });

  it("maps each hand's independent prop length onto the live engine pixels", () => {
    const overrides: MandalaTipOverrides = {
      blue: [{ dx: CLUB_TIP_REACH, dy: 0 }],
      red: [{ dx: 300, dy: 0 }],
    };
    const paths = calculate(
      [staticEastStep()],
      "club",
      "bigstaff",
      undefined,
      overrides
    );
    const scale = computeEngineAlignedMandalaScale(950);
    const blue = firstPoint(paths.blue[0]!.d);
    const red = firstPoint(paths.red[0]!.d);

    expect(scale).toBeCloseTo(150 / 80, 12);
    expect(Math.hypot(blue.x, blue.y) * scale).toBeCloseTo(
      ENGINE_GRID_RADIUS + CLUB_TIP_REACH,
      1
    );
    expect(Math.hypot(red.x, red.y) * scale).toBeCloseTo(150 + 300, 1);
  });
});
