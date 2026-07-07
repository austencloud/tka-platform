import { describe, it, expect } from "vitest";
import {
  FOUNDING_SMART_COLLECTIONS,
  toSyntheticCollection,
  isFoundingId,
  getFoundingCollection,
} from "$lib/features/browse/collections/config/founding-collections";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { deriveSpecMembers } from "$lib/shared/browse/services/smart-filter-spec";
import { CANONICAL_TND_AUTHOR } from "$lib/features/browse/gallery-home/canonical-tnd-pool";

describe("founding collections config", () => {
  it("declares exactly three founding collections with underscore ids", () => {
    expect(FOUNDING_SMART_COLLECTIONS.map((c) => c.id)).toEqual([
      "founding_tka-1",
      "founding_tka-2",
      "founding_tka-3",
    ]);
    for (const c of FOUNDING_SMART_COLLECTIONS) {
      expect(isFoundingId(c.id)).toBe(true);
      expect(c.id.includes(":")).toBe(false);
      expect(c.filterSpec.source).toBe("community");
      expect(c.filterSpec.filters.length).toBeGreaterThan(0);
    }
  });

  it("declares the expected cached counts", () => {
    expect(FOUNDING_SMART_COLLECTIONS.map((c) => c.sequenceCount)).toEqual([19, 57, 95]);
  });

  it("adapts to a read-only smart LibraryCollection", () => {
    const syn = toSyntheticCollection(FOUNDING_SMART_COLLECTIONS[1]!);
    expect(syn.kind).toBe("smart");
    expect(syn.systemType).toBe("founding");
    expect(syn.sequenceCount).toBe(57);
    expect(syn.filterSpec).toBe(FOUNDING_SMART_COLLECTIONS[1]!.filterSpec);
  });

  it("resolves a founding id back to its config", () => {
    expect(getFoundingCollection("founding_tka-3")?.name).toContain("TKA 3");
    expect(getFoundingCollection("nope")).toBeUndefined();
  });
});

// Minimal SequenceData carrying only the fields the founding rules read:
// author (fence), level (difficulty), and per-step motion turns (max-turn ceiling).
function seq(
  id: string,
  author: string,
  level: number,
  blueTurns: number,
  redTurns: number,
): SequenceData {
  return {
    id,
    author,
    level,
    steps: [
      {
        isBlank: false,
        motions: { blue: { turns: blueTurns }, red: { turns: redTurns } },
      },
    ],
  } as unknown as SequenceData;
}

const idsOf = (m: SequenceData[]) => m.map((s) => s.id).sort();
const A = CANONICAL_TND_AUTHOR;
const [tka1, tka2, tka3] = FOUNDING_SMART_COLLECTIONS;

describe("founding rules — mechanics over a synthetic pool", () => {
  // Real 19/57/95 over the live alphabet is a runtime acceptance check; this
  // proves the author-fence + difficulty + ceiling compose to select exactly
  // the intended subset and reject everything else.
  const pool: SequenceData[] = [
    seq("a-l1", A, 1, 0, 0), // alphabet base (level 1) → TKA 1
    seq("a-l2-t1", A, 2, 1, 1), // alphabet whole-turn max 1 → TKA 2
    seq("a-l2-t2", A, 2, 2, 2), // alphabet whole-turn max 2 → excluded by ceiling
    seq("a-l3-h", A, 3, 0.5, 0.5), // alphabet half-turn max 0.5 → TKA 3
    seq("a-l3-t15", A, 3, 1.5, 0.5), // alphabet half-turn max 1.5 → excluded by ceiling
    seq("u-l2-t1", "Someone", 2, 1, 1), // user content, matches level+turns → fenced out
    seq("u-l1", "Someone", 1, 0, 0), // user content → fenced out
  ];

  it("TKA 1 selects only the alphabet base (level 1) card", () => {
    expect(idsOf(deriveSpecMembers(pool, tka1!.filterSpec))).toEqual(["a-l1"]);
  });

  it("TKA 2 selects only the alphabet whole-turn (level 2, ≤1) card", () => {
    expect(idsOf(deriveSpecMembers(pool, tka2!.filterSpec))).toEqual(["a-l2-t1"]);
  });

  it("TKA 3 selects only the alphabet half-turn (level 3, ≤1) card", () => {
    expect(idsOf(deriveSpecMembers(pool, tka3!.filterSpec))).toEqual(["a-l3-h"]);
  });

  it("fences user-authored sequences out even when level + turns match", () => {
    expect(deriveSpecMembers(pool, tka2!.filterSpec).some((s) => s.id === "u-l2-t1")).toBe(false);
    expect(deriveSpecMembers(pool, tka1!.filterSpec).some((s) => s.id === "u-l1")).toBe(false);
  });
});
