import { describe, expect, it } from "vitest";
import {
  getGridMarkerGeometry,
  getGridMaterial,
  getGridPlaneGeometry,
  getGridRenderResourceCounts,
  getGridRingGeometry,
} from "$lib/shared/3d/components/grid-render-resources";

describe("grid render resources", () => {
  it("shares identical geometry and material requests across performers", () => {
    expect(getGridPlaneGeometry(1.2)).toBe(getGridPlaneGeometry(1.2));
    expect(getGridRingGeometry(0.7, 0.015, 64)).toBe(
      getGridRingGeometry(0.7, 0.015, 64)
    );
    expect(getGridMarkerGeometry(0.025, 16)).toBe(
      getGridMarkerGeometry(0.025, 16)
    );
    expect(getGridMaterial("#abcdef", { opacity: 0.5 })).toBe(
      getGridMaterial("#abcdef", { opacity: 0.5 })
    );
  });

  it("keeps distinct resource variants separate", () => {
    expect(getGridPlaneGeometry(1.2)).not.toBe(getGridPlaneGeometry(1.3));
    expect(getGridMaterial("#abcdef")).not.toBe(
      getGridMaterial("#abcdef", { opacity: 0.5 })
    );

    const counts = getGridRenderResourceCounts();
    expect(counts.geometries).toBeGreaterThanOrEqual(4);
    expect(counts.materials).toBeGreaterThanOrEqual(2);
  });
});
