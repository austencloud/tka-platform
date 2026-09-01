import { describe, expect, it } from "vitest";
import groundLayout from "../../../../../../../../../scripts/autumn-ground-layout.json";
import { AUTUMN_CABIN_LANE_GLSL } from "./autumn-ground-detail";

describe("Autumn ground-detail route source", () => {
  it("generates every cabin-lane segment from the Blender layout", () => {
    const lane = groundLayout.paths.find((path) => path.id === "cabin_lane")!;
    const generatedSegments =
      AUTUMN_CABIN_LANE_GLSL.match(/autumnGroundSegment/g);

    expect(generatedSegments).toHaveLength(lane.points.length - 1);
    expect(AUTUMN_CABIN_LANE_GLSL).toContain("vec2(-9.6, 53.0)");
    expect(AUTUMN_CABIN_LANE_GLSL).toContain("vec2(-10.0, 54.5)");
  });
});
