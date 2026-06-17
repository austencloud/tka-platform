import { describe, it, expect } from "vitest";
import { resolveAccessTier, getMaxBeats } from "$lib/shared/auth/domain/access-tier";

describe("resolveAccessTier", () => {
  it("unauthenticated → guest", () => {
    expect(resolveAccessTier(false, false, false)).toBe("guest");
  });
  it("anonymous (authenticated but anon) → guest", () => {
    expect(resolveAccessTier(true, true, false)).toBe("guest");
  });
  it("anonymous never escalates to premium", () => {
    expect(resolveAccessTier(true, true, true)).toBe("guest");
  });
  it("full non-premium → user", () => {
    expect(resolveAccessTier(true, false, false)).toBe("user");
  });
  it("full premium → premium", () => {
    expect(resolveAccessTier(true, false, true)).toBe("premium");
  });
  it("guest cap stays 8 for anonymous", () => {
    expect(getMaxBeats(resolveAccessTier(true, true, false))).toBe(8);
  });
});
