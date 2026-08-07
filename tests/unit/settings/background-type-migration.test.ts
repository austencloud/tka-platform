import { BackgroundType } from "@austencloud/backgrounds";
import { describe, expect, it } from "vitest";

import { normalizeBackgroundType } from "$lib/shared/settings/domain/background-type-migration";

describe("background type migration", () => {
  it("migrates the former Rainbow identifier to Pride", () => {
    expect(normalizeBackgroundType("rainbow")).toBe(BackgroundType.PRIDE);
  });

  it("preserves current package identifiers", () => {
    for (const backgroundType of Object.values(BackgroundType)) {
      expect(normalizeBackgroundType(backgroundType)).toBe(backgroundType);
    }
  });

  it("rejects unknown persisted identifiers", () => {
    expect(normalizeBackgroundType("not-a-background")).toBeUndefined();
    expect(normalizeBackgroundType(null)).toBeUndefined();
  });
});
