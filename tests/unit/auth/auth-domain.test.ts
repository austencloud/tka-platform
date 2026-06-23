// Unit coverage for resolveAuthDomain — the per-environment Firebase auth
// handler domain picker that fixes iOS Safari OAuth (auth/popup-closed-by-user)
// by serving /__/auth/ first-party on tkaflowarts hosts.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cap = vi.hoisted(() => ({ isNative: false }));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => cap.isNative },
}));

import { resolveAuthDomain, DEFAULT_AUTH_DOMAIN } from "../../../src/lib/shared/auth/auth-domain";

function setHostname(hostname: string | null) {
  if (hostname === null) {
    vi.stubGlobal("window", undefined);
    return;
  }
  vi.stubGlobal("window", { location: { hostname } });
}

beforeEach(() => {
  cap.isNative = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveAuthDomain", () => {
  it("returns the app host on production tkaflowarts.com", () => {
    setHostname("tkaflowarts.com");
    expect(resolveAuthDomain()).toBe("tkaflowarts.com");
  });

  it("returns the app host on the dev subdomain", () => {
    setHostname("dev.tkaflowarts.com");
    expect(resolveAuthDomain()).toBe("dev.tkaflowarts.com");
  });

  it("falls back to the default handler on localhost", () => {
    setHostname("localhost");
    expect(resolveAuthDomain()).toBe(DEFAULT_AUTH_DOMAIN);
  });

  it("falls back to the default handler on pages.dev previews", () => {
    setHostname("abc123.tka-platform.pages.dev");
    expect(resolveAuthDomain()).toBe(DEFAULT_AUTH_DOMAIN);
  });

  it("does NOT match a look-alike suffix host", () => {
    setHostname("eviltkaflowarts.com");
    expect(resolveAuthDomain()).toBe(DEFAULT_AUTH_DOMAIN);
  });

  it("uses the default handler under native (Capacitor), even on a tkaflowarts host", () => {
    cap.isNative = true;
    setHostname("tkaflowarts.com");
    expect(resolveAuthDomain()).toBe(DEFAULT_AUTH_DOMAIN);
  });

  it("uses the default handler during SSR (no window)", () => {
    setHostname(null);
    expect(resolveAuthDomain()).toBe(DEFAULT_AUTH_DOMAIN);
  });
});
