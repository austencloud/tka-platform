import { describe, expect, it } from "vitest";
import type { BufferAttribute } from "three";
import { SilkRibbonGeometry3D } from "$lib/shared/3d/effects/silk/silk-ribbon-geometry-3d";
import { BoundedSourcePath3D } from "$lib/shared/3d/effects/scene-effects/bounded-source-path-3d";
import type { Silk3DParams } from "$lib/shared/effects/translators/webgl3d-types";

function makeParams(flutter: number): Silk3DParams {
  return {
    intensity: 0.5,
    width: 0.5,
    duration: 0.5,
    flutter,
    tautness: 0.2,
    palette: "satin",
    customColor: "#c0c0d0",
    trackingMode: "both_ends",
    resolvedPalette: { id: "satin", body: "#c0c0d0", edge: "#ffffff" },
    baseHalfWidthWorld: 0.25,
    lifetimeSeconds: 2,
    motionReferenceSpeed: 3,
    maxPointsPerTip: 16,
  };
}

function renderPositions(flutter: number): number[] {
  const path = new BoundedSourcePath3D(16);
  for (let index = 0; index < 8; index++) {
    path.push({ x: index * 0.2, y: 0, z: 0 }, index * 0.1, 1, 0);
  }

  const ribbon = new SilkRibbonGeometry3D(16);
  ribbon.beginFrame();
  ribbon.writeRibbon(path, makeParams(flutter), 1.2, {
    headSideX: 0,
    headSideY: 0,
    headSideZ: 0,
    hasHeadSide: false,
  });
  ribbon.commit();

  const positions = ribbon.geometry.getAttribute("position") as BufferAttribute;
  return Array.from(positions.array).slice(0, path.count * 2 * 3);
}

describe("SilkRibbonGeometry3D", () => {
  it("uses flutter to move the ribbon vertices", () => {
    const still = renderPositions(0);
    const fluttering = renderPositions(1);
    const largestDelta = Math.max(
      ...still.map((value, index) => Math.abs(value - fluttering[index]!))
    );

    expect(largestDelta).toBeGreaterThan(0.01);
  });
});
