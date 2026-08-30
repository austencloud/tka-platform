import { describe, expect, it } from "vitest";
import type { FlowFestMoment } from "../../src/lib/features/flow-fest-sim/state/flow-fest-progress";
import {
  FLOW_FEST_GATE3_CAMERA_IDS,
  FLOW_FEST_GATE3_VISUAL_HIERARCHY,
  getFlowFestVisualProfile,
  parseFlowFestGate3ReviewRequest,
} from "../../src/routes/test/flow-fest-sim/flow-fest-visual-system";

const MOMENTS = [
  "afternoon",
  "golden-hour",
  "night",
  "dawn",
] as const satisfies readonly FlowFestMoment[];

/**
 * Relative luminance of a `#rrggbb` grade tint. These tints are multipliers on
 * already-authored albedo, so only their relative ordering carries meaning.
 */
function tintLuminance(hex: string): number {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  const value = Number.parseInt(hex.slice(1), 16);
  const r = ((value >> 16) & 0xff) / 255;
  const g = ((value >> 8) & 0xff) / 255;
  const b = (value & 0xff) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rigTotal(moment: FlowFestMoment): number {
  const profile = getFlowFestVisualProfile(moment);
  return (
    profile.sun.intensity +
    profile.fill.intensity +
    profile.hemisphere.intensity +
    profile.ambient.intensity
  );
}

describe("Flow Fest Gate 3 visual system", () => {
  it("keeps the three review moments materially distinct", () => {
    const day = getFlowFestVisualProfile("afternoon");
    const dusk = getFlowFestVisualProfile("golden-hour");
    const night = getFlowFestVisualProfile("night");

    expect(new Set([day.sky.top, dusk.sky.top, night.sky.top]).size).toBe(3);
    expect(day.sun.intensity).toBeGreaterThan(dusk.sun.intensity);
    expect(dusk.sun.intensity).toBeGreaterThan(night.sun.intensity);
    expect(night.fog.density).toBeGreaterThan(day.fog.density);
    expect(night.sun.enabled).toBe(false);
    expect(day.grade.exposure).not.toBe(night.grade.exposure);
  });

  it("parses a deterministic registered review request", () => {
    const request = parseFlowFestGate3ReviewRequest(
      new URLSearchParams(
        "gate3=1&camera=middle-earth&moment=dusk&branch=upper-tent"
      )
    );

    expect(request).toEqual({
      enabled: true,
      cameraId: "middle-earth",
      momentId: "dusk",
      moment: "golden-hour",
      branch: "upper-tent",
    });
  });

  it("fails closed to no visual override when review mode is absent", () => {
    expect(
      parseFlowFestGate3ReviewRequest(
        new URLSearchParams("camera=middle-earth&moment=night")
      )
    ).toEqual({
      enabled: false,
      cameraId: null,
      momentId: null,
      moment: null,
      branch: "lower-tent",
    });
  });

  it("locks five source cameras and a land-first hierarchy", () => {
    expect(FLOW_FEST_GATE3_CAMERA_IDS).toEqual([
      "lower-gate",
      "lower-level",
      "upper-parking",
      "middle-earth",
      "night-composition",
    ]);
    expect(FLOW_FEST_GATE3_VISUAL_HIERARCHY).toHaveLength(5);
    expect(FLOW_FEST_GATE3_VISUAL_HIERARCHY[0]).toContain("Measured landform");
    expect(FLOW_FEST_GATE3_VISUAL_HIERARCHY.at(-1)).toContain("LED circle");
  });
});

/**
 * Each case below is a defect that shipped. The grade is four hex strings and
 * two numbers per moment, so a plausible-looking edit reintroduces one of them
 * without any type error and without any frame being rendered.
 */
describe("Flow Fest night grade", () => {
  it("defines every grade channel for every moment", () => {
    for (const moment of MOMENTS) {
      const { grade } = getFlowFestVisualProfile(moment);
      for (const tint of [
        grade.terrainTint,
        grade.foliageTint,
        grade.barkTint,
        grade.grassTint,
        grade.dressingTint,
      ]) {
        expect(tint).toMatch(/^#[0-9a-f]{6}$/);
      }
      expect(grade.terrainDetailColorStrength).toBeGreaterThan(0);
      expect(grade.terrainDetailColorStrength).toBeLessThanOrEqual(0.92);
      expect(grade.exposure).toBeGreaterThan(0);
    }
  });

  it("keeps camp fabric brighter than foliage at night", () => {
    // Nylon fly sheets are the most reflective thing in a dark campground. An
    // earlier night grade inverted this and every camp rendered as one flat
    // black wall while the tree line stayed pale.
    const night = getFlowFestVisualProfile("night").grade;
    expect(tintLuminance(night.dressingTint)).toBeGreaterThan(
      tintLuminance(night.foliageTint)
    );
    expect(tintLuminance(night.dressingTint)).toBeGreaterThan(
      tintLuminance(night.terrainTint)
    );
  });

  it("compensates grass for its near-vertical blade normals at night", () => {
    // Blades stand upright, so a hemisphere light hands them the sky/ground
    // blend and the moon only grazes them. Without the brightest tint of the
    // night set, the whole foreground field crushed to black.
    const night = getFlowFestVisualProfile("night").grade;
    expect(tintLuminance(night.grassTint)).toBeGreaterThan(
      tintLuminance(night.terrainTint)
    );
    expect(tintLuminance(night.grassTint)).toBeGreaterThan(
      tintLuminance(night.foliageTint)
    );
  });

  it("hands the ground to the moment tint at night and to the atlas by day", () => {
    // The detail atlas is a sunlit bare-dirt scan. At full strength no
    // multiply can reach it, which is what made the bench above the field read
    // as desert sand under a 2 AM sky.
    const night = getFlowFestVisualProfile("night").grade;
    const day = getFlowFestVisualProfile("afternoon").grade;
    expect(night.terrainDetailColorStrength).toBeLessThan(0.35);
    expect(day.terrainDetailColorStrength).toBeGreaterThan(
      night.terrainDetailColorStrength * 2
    );
    for (const moment of MOMENTS) {
      expect(
        getFlowFestVisualProfile(moment).grade.terrainDetailColorStrength
      ).toBeGreaterThanOrEqual(night.terrainDetailColorStrength);
    }
  });

  it("leaves the authored summer palette untouched at midday", () => {
    const day = getFlowFestVisualProfile("afternoon").grade;
    expect(day.grassTint).toBe("#ffffff");
    expect(day.dressingTint).toBe("#ffffff");
  });

  it("darkens night enough to read as night and not as a void", () => {
    const night = rigTotal("night");
    const afternoon = rigTotal("afternoon");
    expect(night / afternoon).toBeLessThan(0.4);
    expect(night / afternoon).toBeGreaterThan(0.2);
    expect(rigTotal("golden-hour")).toBeGreaterThan(night);
    expect(getFlowFestVisualProfile("night").grade.exposure).toBeGreaterThan(
      getFlowFestVisualProfile("afternoon").grade.exposure
    );
  });
});
