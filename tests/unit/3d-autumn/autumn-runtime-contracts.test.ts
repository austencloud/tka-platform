import { describe, expect, it } from "vitest";

import { resolveAutumnShadowRole } from "$lib/shared/3d/environments/scenes/autumn/runtime/lighting/autumn-shadow-roles";
import { AUTUMN_MOON_DIRECTION } from "$lib/shared/3d/environments/scenes/autumn/runtime/lighting/autumn-moon";
import { resolveMotionScale } from "$lib/shared/3d/environments/primitives/motion-preference";
import { allocateAutumnFireflies } from "$lib/shared/3d/environments/scenes/autumn/runtime/atmosphere/autumn-ground-life-layout";

describe("Autumn shadow budget", () => {
  it("casts from near-field silhouettes only", () => {
    for (const name of [
      "HeroTreeA_01",
      "HeroTreeB_03",
      "Sapling_02",
      "FallenLog_01",
      "Fern_12",
      "Shore_Boulder_04",
      "Forest_Boulder_11",
      "FairyRing_East_03",
      "Autumn_Owl_Perch",
    ]) {
      expect(resolveAutumnShadowRole(name)).toEqual({
        cast: true,
        receive: true,
      });
    }
  });

  it("keeps ground surfaces as receivers so contact reads without a depth pass", () => {
    for (const name of [
      "Autumn_Terrain",
      "MossPatch_04",
      "Pond_Sculpted_Basin",
      "Autumn_Leaf_Drifts",
      "Autumn_Twig_Litter",
    ]) {
      expect(resolveAutumnShadowRole(name)).toEqual({
        cast: false,
        receive: true,
      });
    }
  });

  it("excludes the distant belt and the wind-owned grass entirely", () => {
    // The belt sits ~24-27m out, outside the +/-12 shadow camera, so casting
    // from it would pay a depth pass that can never darken a visible pixel.
    for (const name of [
      "DistantBirch_02",
      "DistantLarch_01",
      "DistantSnag_05",
      "DistantWillow_03",
      // AutumnWind owns these; claiming them here too would make the winner
      // depend on effect ordering.
      "Autumn_Grass_Base",
      "Autumn_Grass_High",
    ]) {
      expect(resolveAutumnShadowRole(name)).toEqual({
        cast: false,
        receive: false,
      });
    }
  });

  it("defaults unknown geometry to receive-only", () => {
    expect(resolveAutumnShadowRole("Something_New")).toEqual({
      cast: false,
      receive: true,
    });
    expect(resolveAutumnShadowRole("")).toEqual({ cast: false, receive: true });
  });
});

describe("Autumn moon", () => {
  it("stays behind and left of the hero camera so the belt gap still frames it", () => {
    const [x, y, z] = AUTUMN_MOON_DIRECTION;
    expect(x).toBeLessThan(0);
    expect(z).toBeLessThan(0);
    expect(y).toBeGreaterThan(0);
  });

  it("sits high enough that shadows stay inside the shadow camera", () => {
    const [x, y, z] = AUTUMN_MOON_DIRECTION;
    const elevation = Math.atan2(y, Math.hypot(x, z)) * (180 / Math.PI);
    // Below ~22 degrees a 1.75m performer casts a shadow longer than 4.3m and
    // immediately leaves the +/-12 clearing camera at a grazing angle.
    expect(elevation).toBeGreaterThan(22);
    expect(elevation).toBeLessThan(40);
  });
});

describe("Reduced-motion scale", () => {
  it("freezes animation when the viewer asked for reduced motion", () => {
    expect(resolveMotionScale(true)).toBe(0);
    expect(resolveMotionScale(false)).toBe(1);
  });

  it("lets an explicit override win in both directions", () => {
    expect(resolveMotionScale(true, 1)).toBe(1);
    expect(resolveMotionScale(false, 0)).toBe(0);
    expect(resolveMotionScale(false, 0.25)).toBe(0.25);
  });

  it("never runs time backwards", () => {
    expect(resolveMotionScale(false, -3)).toBe(0);
    expect(resolveMotionScale(false, Number.NaN)).toBe(1);
  });
});

describe("Weighted ground-life allocation", () => {
  it("returns an empty allocation instead of NaN indices", () => {
    // The distribution loop indexes by `i % counts.length`; with no weights
    // that is NaN and the old version returned garbage rather than nothing.
    expect(allocateAutumnFireflies(0)).toEqual(
      allocateAutumnFireflies(0).map(() => 0)
    );
  });

  it("still distributes every requested firefly", () => {
    const counts = allocateAutumnFireflies(36);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(36);
    expect(counts.every((count) => count > 0)).toBe(true);
  });
});
