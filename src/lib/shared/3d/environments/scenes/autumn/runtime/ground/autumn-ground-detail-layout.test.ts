import { MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import groundLayout from "../../../../../../../../../scripts/autumn-ground-layout.json";
import {
  AUTUMN_CABIN_LANE_GLSL,
  AUTUMN_HORIZON_FOG_FRAGMENT,
  isAutumnGroundMaterial,
} from "./autumn-ground-detail";

describe("Autumn ground-detail route source", () => {
  it("generates every cabin-lane segment from the Blender layout", () => {
    const lane = groundLayout.paths.find((path) => path.id === "cabin_lane")!;
    const generatedSegments =
      AUTUMN_CABIN_LANE_GLSL.match(/autumnGroundSegment/g);

    expect(generatedSegments).toHaveLength(lane.points.length - 1);
    expect(AUTUMN_CABIN_LANE_GLSL).toContain("vec2(-9.6, 53.0)");
    expect(AUTUMN_CABIN_LANE_GLSL).toContain("vec2(-10.0, 54.5)");
  });

  it("carries repeated surface treatment onto the fog horizon", () => {
    const livingFloor = new MeshStandardMaterial({
      name: "Autumn Living Forest Floor",
    });
    const fogApron = new MeshStandardMaterial({ name: "Autumn Fog Apron" });
    const unrelated = new MeshStandardMaterial({ name: "Autumn Bark" });

    expect(isAutumnGroundMaterial(livingFloor)).toBe(true);
    expect(isAutumnGroundMaterial(fogApron)).toBe(true);
    expect(isAutumnGroundMaterial(unrelated)).toBe(false);
  });

  it("retains a floor signal under the tree belt and hides the mesh edge", () => {
    expect(AUTUMN_HORIZON_FOG_FRAGMENT).toContain("0.88");
    expect(AUTUMN_HORIZON_FOG_FRAGMENT).toContain("smoothstep(");
    expect(AUTUMN_HORIZON_FOG_FRAGMENT).toContain("180.0");
    expect(AUTUMN_HORIZON_FOG_FRAGMENT).toContain("650.0");
    expect(AUTUMN_HORIZON_FOG_FRAGMENT).toContain(
      "min(fogFactor, autumnGroundFogCeiling)"
    );
  });
});
