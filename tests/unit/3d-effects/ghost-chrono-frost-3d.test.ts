import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Plane, PropType, type PropState3D } from "@austencloud/scene-3d";
import { DoubleSide, Quaternion, Vector3 } from "three";
import { resolveGhost3D } from "$lib/shared/effects/translators/webgl3d-translator";
import { QualityTier } from "$lib/shared/3d/effects/types";
import {
  createChronoFrostMaterial,
  resolveGhostAgeVisual,
  resolveGhostPoolSize,
  resolveGhostPoseFrostSeed,
} from "$lib/shared/3d/effects/motion/ghost-chrono-frost-3d";
import { createGhostPropPoseKey3D } from "$lib/shared/3d/effects/motion/ghost-prop-pose-3d";

const GHOST_INTENT = {
  blueColor: "#27b7ff",
  redColor: "#ff3f72",
  intensity: 0.85,
  decay: 8,
  interval: 0.5,
};

function propState(rotation = new Quaternion()): PropState3D {
  return {
    centerPathAngle: 0,
    staffRotationAngle: 0,
    plane: Plane.WALL,
    worldPosition: new Vector3(),
    worldRotation: rotation,
  };
}

describe("Ghost Chrono-Frost 3D", () => {
  it("resolves time, density, rim, and Ghost-owned prop colors", () => {
    const resolved = resolveGhost3D(GHOST_INTENT);

    expect(resolved.blueColor).toBe("#27b7ff");
    expect(resolved.redColor).toBe("#ff3f72");
    expect(resolved.lifetimeSeconds).toBeCloseTo(1.64);
    expect(resolved.positionQuantization).toBeGreaterThan(0);
    expect(resolved.angleQuantization).toBeGreaterThan(0);
    expect(resolved.rimPower).toBeGreaterThan(1);
  });

  it("caps stable prop slots by quality tier", () => {
    expect(resolveGhostPoolSize(QualityTier.HIGH)).toBe(10);
    expect(resolveGhostPoolSize(QualityTier.MEDIUM)).toBe(6);
    expect(resolveGhostPoolSize(QualityTier.LOW)).toBe(4);
  });

  it("renders a filled fresh body, a shedding middle, and a cold old rim", () => {
    const fresh = resolveGhostAgeVisual(0, 2, 1);
    const middle = resolveGhostAgeVisual(1, 2, 1);
    const coldOutline = resolveGhostAgeVisual(1.4, 2, 1);
    const old = resolveGhostAgeVisual(1.8, 2, 1);

    expect(fresh.fillAlpha).toBeGreaterThan(fresh.rimAlpha);
    expect(fresh.fillAlpha).toBeGreaterThan(middle.fillAlpha);
    expect(middle.fillAlpha).toBeGreaterThan(0);
    expect(old.fillAlpha).toBe(0);
    expect(middle.rimAlpha).toBeGreaterThan(middle.fillAlpha);
    expect(fresh.rimAlpha).toBeGreaterThan(middle.rimAlpha);
    expect(middle.rimAlpha).toBeGreaterThan(old.rimAlpha);
    expect(coldOutline.saturation).toBe(0);
    expect(coldOutline.rimAlpha).toBeGreaterThan(0.08);
    expect(old.saturation).toBe(0);
  });

  it("normalizes mixed body and rim radiance before the union-alpha clamp", () => {
    const material = createChronoFrostMaterial(0);

    expect(material.fragmentShader).toContain("combinedAlpha");
    expect(material.fragmentShader).toContain("/ combinedAlpha");
    expect(material.fragmentShader).not.toContain("/ alpha;");
    material.dispose();
  });

  it("builds a transparent, double-sided, non-depth-writing shader material", () => {
    const material = createChronoFrostMaterial(0);
    expect(material.transparent).toBe(true);
    expect(material.depthTest).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(DoubleSide);
    expect(material.forceSinglePass).toBe(true);
    expect(material.name).toBe("GhostChronoFrost:0");
    material.dispose();
  });

  it("binds frozen breakup to the pose key instead of the reusable slot", () => {
    expect(resolveGhostPoseFrostSeed("pose-a")).toBe(
      resolveGhostPoseFrostSeed("pose-a")
    );
    expect(resolveGhostPoseFrostSeed("pose-a")).not.toBe(
      resolveGhostPoseFrostSeed("pose-b")
    );
  });

  it("canonicalizes equivalent quaternion signs in pose keys", () => {
    const center = new Vector3(0.2, 0.5, -0.1);
    const rotation = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      0.9
    );
    const inverseSign = new Quaternion(
      -rotation.x,
      -rotation.y,
      -rotation.z,
      -rotation.w
    );

    expect(
      createGhostPropPoseKey3D(center, propState(rotation), 0.02, 0.1)
    ).toBe(createGhostPropPoseKey3D(center, propState(inverseSign), 0.02, 0.1));
  });

  it("composes the canonical Prop3D owner with no generic cylinder path", () => {
    const phantomSource = readFileSync(
      "src/lib/shared/3d/effects/motion/GhostPropPhantom3D.svelte",
      "utf8"
    );
    const layerSource = readFileSync(
      "src/lib/shared/3d/effects/EffectsLayer.svelte",
      "utf8"
    );

    expect(phantomSource).toContain("Prop3D");
    expect(phantomSource).not.toContain("CylinderGeometry");
    expect(layerSource).toContain("GhostPropHistory3D");
    expect(layerSource).not.toContain('shape="staff"');
  });
});
