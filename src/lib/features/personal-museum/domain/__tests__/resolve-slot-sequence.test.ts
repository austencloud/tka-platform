import { describe, it, expect } from "vitest";
import { resolveSlotSequence } from "../resolve-slot-sequence";
import type { PersonalMuseumPlacement } from "../personal-museum-types";

const p = (sequenceId: string): PersonalMuseumPlacement => ({ sequenceId, assignedAt: 0 });

describe("resolveSlotSequence", () => {
  const slots = ["s1", "s2", "s3"];

  it("uses an explicit placement when its sequence still exists", () => {
    const out = resolveSlotSequence(slots, { s2: p("seqB") }, [], new Set(["seqB"]));
    expect(out.s2).toBe("seqB");
  });

  it("auto-fills unassigned slots from favorites in slot order, newest-first", () => {
    const out = resolveSlotSequence(slots, {}, ["favA", "favB"], new Set(["favA", "favB"]));
    expect(out).toEqual({ s1: "favA", s2: "favB", s3: null });
  });

  it("explicit placements win over auto-fill and are not duplicated by favorites", () => {
    const out = resolveSlotSequence(
      slots,
      { s1: p("favB") },
      ["favA", "favB"],
      new Set(["favA", "favB"]),
    );
    expect(out).toEqual({ s1: "favB", s2: "favA", s3: null });
  });

  it("treats a placement referencing a deleted sequence as empty, then auto-fills it", () => {
    const out = resolveSlotSequence(
      slots,
      { s1: p("ghost") },
      ["favA"],
      new Set(["favA"]),
    );
    expect(out).toEqual({ s1: "favA", s2: null, s3: null });
  });

  it("returns null for every slot when there is nothing to show", () => {
    const out = resolveSlotSequence(slots, {}, [], new Set());
    expect(out).toEqual({ s1: null, s2: null, s3: null });
  });
});
