import { describe, it, expect } from "vitest";
import {
  resolveAccessTier,
  getMaxBeats,
  ACCESS_TIER_LABELS,
  type AccessTier,
} from "$lib/shared/auth/domain/AccessTier";

describe("resolveAccessTier", () => {
  it("returns guest when not authenticated", () => {
    expect(resolveAccessTier(false, false)).toBe("guest");
  });

  it("returns user when authenticated but not premium", () => {
    expect(resolveAccessTier(true, false)).toBe("user");
  });

  it("returns premium when authenticated and premium", () => {
    expect(resolveAccessTier(true, true)).toBe("premium");
  });
});

describe("getMaxBeats", () => {
  it("returns 8 for guest", () => {
    expect(getMaxBeats("guest")).toBe(8);
  });

  it("returns 16 for user", () => {
    expect(getMaxBeats("user")).toBe(16);
  });

  it("returns 64 for premium", () => {
    expect(getMaxBeats("premium")).toBe(64);
  });
});

describe("ACCESS_TIER_LABELS", () => {
  it("maps internal names to display names", () => {
    expect(ACCESS_TIER_LABELS.guest).toBe("Guest");
    expect(ACCESS_TIER_LABELS.user).toBe("Composer");
    expect(ACCESS_TIER_LABELS.premium).toBe("Scribe");
  });
});
