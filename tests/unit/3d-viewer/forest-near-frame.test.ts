import { describe, expect, it } from "vitest";
import {
  createDefaultForestFireflyConfig,
  shouldShowForestNearFrame,
} from "$lib/shared/3d/environments/domain/models/scene-configs/forest-scene-config";

describe("Forest close-frame visibility", () => {
  it("shows the production composition in Scene Lab and omits it for widened callers", () => {
    expect(shouldShowForestNearFrame(undefined)).toBe(true);
    expect(shouldShowForestNearFrame(14)).toBe(false);
    expect(shouldShowForestNearFrame(28)).toBe(false);
    expect(createDefaultForestFireflyConfig()).not.toHaveProperty("treeRings");
  });
});
