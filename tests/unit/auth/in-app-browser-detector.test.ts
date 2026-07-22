import { describe, it, expect, afterEach, vi } from "vitest";
import { InAppBrowserDetector } from "$lib/shared/auth/services/in-app-browser-detector";

// Capacitor.isNativePlatform() is called first in detect(); force it false so
// these UA cases exercise the web-detection path, not the native carve-out.
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));

function withUA(ua: string) {
  vi.stubGlobal("navigator", { userAgent: ua, vendor: "" });
}
afterEach(() => vi.unstubAllGlobals());

const IG_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Instagram 300.0";
const OPERA_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 OPT/3.3.3 Mobile/15E148";
const IOS26_IG =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 Instagram 300.0";

describe("InAppBrowserDetector", () => {
  it("flags Instagram iOS", () => {
    withUA(IG_IOS);
    expect(new InAppBrowserDetector().isInAppBrowser()).toBe(true);
  });

  it("does NOT flag Opera for iOS (the deleted generic heuristic's false positive)", () => {
    withUA(OPERA_IOS);
    expect(new InAppBrowserDetector().isInAppBrowser()).toBe(false);
  });

  it("parses iOS major version from the UA", () => {
    withUA(IG_IOS);
    expect(new InAppBrowserDetector().getIosMajorVersion()).toBe(18);
    withUA(IOS26_IG);
    expect(new InAppBrowserDetector().getIosMajorVersion()).toBe(26);
  });

  it("returns null iOS version on a non-iOS UA", () => {
    withUA("Mozilla/5.0 (Linux; Android 13) Instagram 300.0");
    expect(new InAppBrowserDetector().getIosMajorVersion()).toBeNull();
  });
});
