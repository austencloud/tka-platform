import { describe, it, expect } from "vitest";
import { resolveEscapeTarget } from "$lib/shared/auth/services/escape-target";

const base = { currentUrl: "https://tkaflowarts.com/create/construct" };

describe("resolveEscapeTarget", () => {
  it("android pre-launch → browser intent, browser label", () => {
    const t = resolveEscapeTarget({
      ...base,
      platform: "android",
      iosMajorVersion: null,
      appLaunched: false,
    });
    expect(t.method).toBe("android_intent");
    expect(t.isAppTarget).toBe(false);
    expect(t.url).toContain("intent://");
    expect(t.url).toContain("scheme=https");
    expect(t.url).not.toContain("package=");
    expect(t.label).toBe("Open in Chrome");
  });

  it("android post-launch → app intent with package + play-store fallback", () => {
    const t = resolveEscapeTarget({
      ...base,
      platform: "android",
      iosMajorVersion: null,
      appLaunched: true,
    });
    expect(t.method).toBe("android_intent");
    expect(t.isAppTarget).toBe(true);
    expect(t.url).toContain("package=com.tkaflowarts.composer");
    expect(t.url).toContain("S.browser_fallback_url=");
    expect(t.label).toBe("Open in the app");
  });

  it("ios 17+ → x-safari-https scheme, Safari label", () => {
    const t = resolveEscapeTarget({
      ...base,
      platform: "ios",
      iosMajorVersion: 18,
      appLaunched: false,
    });
    expect(t.method).toBe("ios_scheme");
    expect(t.url).toBe("x-safari-https://tkaflowarts.com/create/construct");
    expect(t.label).toBe("Open in Safari");
  });

  it("ios 16 → instructions only, NO scheme fired (avoids invalid-page dialog)", () => {
    const t = resolveEscapeTarget({
      ...base,
      platform: "ios",
      iosMajorVersion: 16,
      appLaunched: false,
    });
    expect(t.method).toBe("ios_instructions");
    expect(t.url).toBeNull();
  });

  it("ios unknown version → instructions only", () => {
    const t = resolveEscapeTarget({
      ...base,
      platform: "ios",
      iosMajorVersion: null,
      appLaunched: false,
    });
    expect(t.method).toBe("ios_instructions");
    expect(t.url).toBeNull();
  });

  it("other platform → generic instructions, no scheme", () => {
    const t = resolveEscapeTarget({
      ...base,
      platform: "other",
      iosMajorVersion: null,
      appLaunched: false,
    });
    expect(t.method).toBe("generic_instructions");
    expect(t.url).toBeNull();
  });
});
