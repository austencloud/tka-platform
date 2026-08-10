import { getDefaultPositions } from "@austencloud/scene-3d";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { getPerformerStageBounds } from "$lib/shared/3d/environments/domain/performer-stage-bounds";

interface CloudbreakLayout {
  performanceTerrace: {
    centerXZ: [number, number];
    clearRadius: number;
  };
}

const layout = JSON.parse(
  readFileSync(resolve("scripts/seraphic-vault-cloudbreak-layout.json"), "utf8")
) as CloudbreakLayout;

describe("performer-aware stage bounds", () => {
  it("keeps the solo stage at its canonical six metre footprint", () => {
    expect(getPerformerStageBounds(getDefaultPositions(1))).toEqual({
      width: 6,
      depth: 6,
      zOffset: 0,
    });
  });

  it("expands the shared stage contract for the maximum eight-performer grid", () => {
    expect(getPerformerStageBounds(getDefaultPositions(8))).toEqual({
      width: 6,
      depth: 9,
      zOffset: -1.5,
    });
  });

  it("keeps all eight performers inside Cloudbreak's fixed dry terrace", () => {
    const positions = getDefaultPositions(8);
    const [centerX, centerZ] = layout.performanceTerrace.centerXZ;
    const performerBodyRadius = 0.75;

    for (const [index, position] of positions.entries()) {
      const distanceFromTerraceCenter = Math.hypot(
        position.x - centerX,
        position.z - centerZ
      );
      expect(
        distanceFromTerraceCenter + performerBodyRadius,
        `performer ${index + 1} must remain on the dry terrace`
      ).toBeLessThan(layout.performanceTerrace.clearRadius);
    }
  });
});
