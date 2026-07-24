import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TrackingMode } from "$lib/shared/animation-engine/domain/types/trail-types";
import { getPropDimensions } from "$lib/shared/animation-engine/services/IPropTextureLoader";
import { setTrailPointOverrideProvider } from "$lib/shared/animation-engine/domain/types/trail-point-types";
import { setTipPointOverrideProvider } from "$lib/shared/animation-engine/domain/types/prop-tip-points";
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

const CLUB_TIP_REACH = 258.67 / 2;

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
      resolve(process.cwd(), "static/images/props/animated/club.svg"),
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

  it("keeps effect-point overrides out of canonical mandala geometry", () => {
    setTipPointOverrideProvider((propType) =>
      propType === "club" ? { points: [{ dx: 150, dy: 0 }] } : null
    );

    expect(resolveMandalaTipOffsets("club", TrackingMode.RIGHT_END)).toEqual([
      { dx: CLUB_TIP_REACH, dy: 0 },
    ]);
  });

  it("keeps a zero-turn anti-spin club locus off center despite a stale effect point", () => {
    setTipPointOverrideProvider((propType) =>
      propType === "club" ? { points: [{ dx: 150, dy: 0 }] } : null
    );
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
      { dx: -135, dy: 0 },
    ]);
    expect(resolveMandalaTipOffsets("staff", TrackingMode.RIGHT_END)).toEqual([
      { dx: 135, dy: 0 },
    ]);
    expect(resolveMandalaTipOffsets("staff", TrackingMode.BOTH_ENDS)).toEqual([
      { dx: -135, dy: 0 },
      { dx: 135, dy: 0 },
    ]);
    expect(resolveMandalaTipOffsets("fan", TrackingMode.RIGHT_END)).toEqual([
      { dx: 150, dy: 0 },
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
