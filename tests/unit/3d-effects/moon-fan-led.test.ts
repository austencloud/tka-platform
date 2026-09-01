import { describe, expect, it } from "vitest";
import { Box3, Mesh, Object3D, Quaternion } from "three";
import { PropType } from "@austencloud/scene-3d";

import {
  MOON_FAN_LED_COUNT,
  MoonFanDiffuserRenderer3D,
  createMoonFanDiffuserGeometry,
  moonFanZoneSampleIndices,
} from "$lib/shared/3d/effects/led/moon-fan-diffuser-renderer-3d";
import {
  FAN_MOON_RIM_POINTS_M,
  resolveBuildTipAnchors3D,
} from "$lib/shared/3d/effects/prop-build-tip-geometry-3d";

describe("Moon fan LED surface", () => {
  it("samples the center of both 39-emitter control zones", () => {
    expect(MOON_FAN_LED_COUNT).toBe(78);
    expect(moonFanZoneSampleIndices()).toEqual([19, 58]);
    expect(moonFanZoneSampleIndices(40)).toEqual([10, 30]);
  });

  it("matches the measured diffuser envelope and grip notch", () => {
    const geometry = createMoonFanDiffuserGeometry();
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;

    expect(bounds.min.x).toBeCloseTo(-0.3, 5);
    expect(bounds.max.x).toBeCloseTo(0.3, 5);
    expect(bounds.min.y).toBeCloseTo(0.03, 5);
    expect(bounds.max.y).toBeCloseTo(0.318, 5);
    geometry.dispose();
  });

  it("places five live heads across the physical rim", () => {
    const anchors = resolveBuildTipAnchors3D(PropType.FAN, 0.5, {
      fanBuild: "moon",
      finish: "day",
    });

    expect(anchors).toHaveLength(5);
    expect(anchors?.every((anchor) => anchor.effectTipIndex === 1)).toBe(true);
    expect(anchors?.map((anchor) => anchor.offset)).toEqual(
      FAN_MOON_RIM_POINTS_M
    );
  });

  it("tracks the prop pose and releases its GPU resources", () => {
    const parent = new Object3D();
    const renderer = new MoonFanDiffuserRenderer3D();
    renderer.initialize(parent);
    expect(parent.children).toHaveLength(1);

    renderer.update({
      propState: {
        worldPosition: { x: 0, y: 0, z: 0 },
        worldRotation: new Quaternion(),
      },
      rigLocalCenter: { x: 1, y: 2, z: 3 },
      zoneA: { r: 1, g: 0.25, b: 0.1 },
      zoneB: { r: 0.1, g: 0.25, b: 1 },
      brightness: 0.8,
      scale: 1.4,
      elapsedSeconds: 2,
    });

    const mesh = parent.children[0] as Mesh;
    expect(mesh.visible).toBe(true);
    expect(mesh.position.toArray()).toEqual([1, 2, 3]);
    expect(mesh.scale.toArray()).toEqual([1.4, 1.4, 1.4]);
    const worldBounds = new Box3().setFromObject(mesh);
    expect(worldBounds.isEmpty()).toBe(false);

    renderer.reset();
    expect(mesh.visible).toBe(false);
    renderer.dispose();
    expect(parent.children).toHaveLength(0);
  });
});
