import { describe, expect, it } from "vitest";
import {
  createDefaultForestFireflyConfig,
  shouldShowForestNearFrame,
} from "$lib/shared/3d/environments/domain/models/scene-configs/forest-scene-config";

describe("Forest close-frame visibility", () => {
  it("shows only in the authored default Forest composition", () => {
    expect(shouldShowForestNearFrame(undefined, undefined)).toBe(true);
    expect(
      shouldShowForestNearFrame(createDefaultForestFireflyConfig(), undefined)
    ).toBe(false);
    expect(shouldShowForestNearFrame(undefined, 14)).toBe(false);
    expect(shouldShowForestNearFrame(undefined, 28)).toBe(false);
  });
});
