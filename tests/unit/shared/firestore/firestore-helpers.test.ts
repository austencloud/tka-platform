import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
  authState: { effectiveUserId: null },
}));

import { stripUndefined, requireAuth, firestoreDate } from "../../../../src/lib/shared/firestore/firestore-helpers";
import { authState } from "$lib/shared/auth/state/auth-state.svelte";

describe("stripUndefined", () => {
  it("removes top-level undefined values", () => {
    const result = stripUndefined({ a: 1, b: undefined, c: "hello" });
    expect(result).toEqual({ a: 1, c: "hello" });
    expect("b" in result).toBe(false);
  });

  it("removes nested undefined values", () => {
    const result = stripUndefined({
      outer: { keep: "yes", drop: undefined },
    });
    expect(result).toEqual({ outer: { keep: "yes" } });
  });

  it("handles arrays — strips undefined from objects inside arrays", () => {
    const result = stripUndefined({
      items: [{ a: 1, b: undefined }, { c: 3 }],
    });
    expect(result).toEqual({ items: [{ a: 1 }, { c: 3 }] });
  });

  it("preserves null values", () => {
    const result = stripUndefined({ a: null, b: 1 });
    expect(result).toEqual({ a: null, b: 1 });
  });

  it("preserves Date instances", () => {
    const date = new Date("2026-01-01");
    const result = stripUndefined({ d: date });
    expect(result.d).toBe(date);
  });

  it("handles empty objects", () => {
    expect(stripUndefined({})).toEqual({});
  });

  it("handles deeply nested structures", () => {
    const result = stripUndefined({
      l1: { l2: { l3: { keep: true, drop: undefined } } },
    });
    expect(result).toEqual({ l1: { l2: { l3: { keep: true } } } });
  });
});

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when no user is authenticated", () => {
    (authState as { effectiveUserId: string | null }).effectiveUserId = null;
    expect(() => requireAuth()).toThrow("Authentication required");
  });

  it("returns userId when authenticated", () => {
    (authState as { effectiveUserId: string | null }).effectiveUserId = "user-123";
    expect(requireAuth()).toBe("user-123");
  });
});

describe("firestoreDate", () => {
  it("parses a Date instance", () => {
    const date = new Date("2026-05-03T12:00:00Z");
    const result = firestoreDate.parse(date);
    expect(result).toEqual(date);
  });

  it("parses an ISO string", () => {
    const result = firestoreDate.parse("2026-05-03T12:00:00Z");
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe("2026-05-03T12:00:00.000Z");
  });

  it("parses a Firestore Timestamp-like object with toDate()", () => {
    const fakeTimestamp = {
      seconds: 1777924800,
      nanoseconds: 0,
      toDate: () => new Date("2026-05-03T12:00:00Z"),
    };
    const result = firestoreDate.parse(fakeTimestamp);
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe("2026-05-03T12:00:00.000Z");
  });

  it("rejects non-date values", () => {
    const result = firestoreDate.safeParse("not-a-date");
    expect(result.success).toBe(false);
  });
});
