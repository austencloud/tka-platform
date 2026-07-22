import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "../../src/lib/server/security/rate-limiter";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("checkRateLimit", () => {
  it("allows requests up to the limit and blocks the next one", () => {
    const identifier = "rate-limit-count-" + crypto.randomUUID();
    const config = { maxRequests: 2, windowMs: 60_000 };

    expect(checkRateLimit(identifier, config)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(checkRateLimit(identifier, config)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(checkRateLimit(identifier, config)).toMatchObject({
      allowed: false,
      remaining: 0,
    });
  });

  it("starts a fresh window after the previous window expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T12:00:00.000Z"));
    const identifier = "rate-limit-reset-" + crypto.randomUUID();
    const config = { maxRequests: 1, windowMs: 1_000 };

    expect(checkRateLimit(identifier, config).allowed).toBe(true);
    expect(checkRateLimit(identifier, config).allowed).toBe(false);

    vi.advanceTimersByTime(1_001);

    expect(checkRateLimit(identifier, config)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });

  it("does not start a timer while the module is loading", async () => {
    vi.resetModules();
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    await import("../../src/lib/server/security/rate-limiter");

    expect(setIntervalSpy).not.toHaveBeenCalled();
  });
});
