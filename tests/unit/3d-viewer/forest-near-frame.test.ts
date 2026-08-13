import { describe, expect, it } from "vitest";
import {
  createDefaultForestFireflyConfig,
  shouldShowForestNearFrame,
} from "$lib/shared/3d/environments/domain/models/scene-configs/forest-scene-config";
import { QualityTier } from "$lib/shared/3d/effects/types";
import {
  getForestGrassTierFromName,
  isForestGrassTierVisible,
} from "$lib/shared/3d/environments/scenes/forest/forest-grass-tier";

describe("Forest close-frame visibility", () => {
  it("shows the production composition in Scene Lab and omits it for widened callers", () => {
    expect(shouldShowForestNearFrame(undefined)).toBe(true);
    expect(shouldShowForestNearFrame(14)).toBe(false);
    expect(shouldShowForestNearFrame(28)).toBe(false);
    expect(createDefaultForestFireflyConfig()).not.toHaveProperty("treeRings");
  });

  it("reveals the summer meadow tiers cumulatively", () => {
    expect(
      isForestGrassTierVisible("Forest_Grass_Base_Lush", QualityTier.LOW)
    ).toBe(true);
    expect(
      isForestGrassTierVisible("Forest_Grass_Medium_Base", QualityTier.LOW)
    ).toBe(false);
    expect(
      isForestGrassTierVisible(
        "Forest_Grass_Medium_Shade",
        QualityTier.MEDIUM
      )
    ).toBe(true);
    expect(
      isForestGrassTierVisible("Forest_Grass_High_Lush", QualityTier.HIGH)
    ).toBe(true);
    expect(getForestGrassTierFromName("ForestNearFrameMushroom_Cap")).toBeNull();
  });
});
