import { describe, it, expect } from "vitest";
import { scoreSession, resolveModule } from "$lib/server/analytics/session-friction-score";
import type { TriageSessionRow } from "$lib/server/analytics/session-triage-queries";

function row(over: Partial<TriageSessionRow> = {}): TriageSessionRow {
  return {
    sessionId: "s_test",
    uid: "u_test",
    startedAt: "2026-08-01 10:00:00",
    endedAt: "2026-08-01 10:05:00",
    durationMs: 300_000,
    eventCount: 20,
    exceptionCount: 0,
    rageClickCount: 0,
    deadClickCount: 0,
    pageviewCount: 3,
    contentActionCount: 2,
    topSegments: ["app"],
    subSegments: ["compose"],
    entryPath: "/app/compose",
    exitPath: "/app/compose",
    browser: "Chrome",
    operatingSystem: "Windows",
    deviceType: "Desktop",
    ...over,
  };
}

describe("resolveModule", () => {
  it("uses the second segment for in-app routes", () => {
    expect(resolveModule(["app"], ["compose"])).toBe("compose");
  });

  it("uses the first segment for public routes", () => {
    expect(resolveModule(["q"], [])).toBe("q");
  });

  it("returns null when there are no pageviews", () => {
    expect(resolveModule([], [])).toBeNull();
  });
});

describe("scoreSession", () => {
  it("scores a clean productive session at zero", () => {
    const s = scoreSession(row(), { isNewUser: false });
    expect(s.total).toBe(0);
    expect(s.reasons).toHaveLength(0);
  });

  it("scores exceptions", () => {
    const s = scoreSession(row({ exceptionCount: 2 }), { isNewUser: false });
    expect(s.total).toBeGreaterThan(0);
    expect(s.reasons.map((r) => r.signal)).toContain("exception");
  });

  it("scores rage clicks even with zero exceptions", () => {
    const s = scoreSession(row({ rageClickCount: 5 }), { isNewUser: false });
    expect(s.total).toBeGreaterThan(0);
    expect(s.reasons.map((r) => r.signal)).toContain("rage-click");
  });

  it("flags a module entered with no content actions", () => {
    const s = scoreSession(
      row({ contentActionCount: 0, durationMs: 120_000 }),
      { isNewUser: false }
    );
    expect(s.reasons.map((r) => r.signal)).toContain("silent-abandon");
  });

  it("does not flag silent abandon for a very short visit", () => {
    const s = scoreSession(
      row({ contentActionCount: 0, durationMs: 5_000, pageviewCount: 1 }),
      { isNewUser: false }
    );
    expect(s.reasons.map((r) => r.signal)).not.toContain("silent-abandon");
  });

  it("flags a short single-page bounce", () => {
    const s = scoreSession(
      row({ durationMs: 11_000, pageviewCount: 1, contentActionCount: 0 }),
      { isNewUser: false }
    );
    expect(s.reasons.map((r) => r.signal)).toContain("bounce");
  });

  it("weights new users up", () => {
    const base = scoreSession(row({ rageClickCount: 3 }), { isNewUser: false });
    const fresh = scoreSession(row({ rageClickCount: 3 }), { isNewUser: true });
    expect(fresh.total).toBeGreaterThan(base.total);
  });

  it("does not weight up a new user who had a good session", () => {
    const s = scoreSession(row(), { isNewUser: true });
    expect(s.total).toBe(0);
  });

  it("caps any single signal so one noisy session cannot dominate", () => {
    const many = scoreSession(row({ rageClickCount: 500 }), { isNewUser: false });
    const some = scoreSession(row({ rageClickCount: 4 }), { isNewUser: false });
    expect(many.total).toBeLessThan(some.total + 100);
  });

  it("ranks a Nina-shaped session above an ordinary one", () => {
    const nina = scoreSession(
      row({
        exceptionCount: 3,
        rageClickCount: 6,
        contentActionCount: 0,
        durationMs: 134_000,
        subSegments: ["tunnel"],
      }),
      { isNewUser: true }
    );
    const ordinary = scoreSession(row({ exceptionCount: 1 }), { isNewUser: false });
    expect(nina.total).toBeGreaterThan(ordinary.total);
  });

  it("explains itself — every scored signal has a human-readable reason", () => {
    const s = scoreSession(row({ exceptionCount: 1, rageClickCount: 2 }), { isNewUser: true });
    for (const r of s.reasons) {
      expect(r.detail.length).toBeGreaterThan(0);
      expect(r.points).toBeGreaterThan(0);
    }
  });
});
