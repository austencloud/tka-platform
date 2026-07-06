import { describe, it, expect } from "vitest";
import { deriveSpecMembers } from "$lib/shared/browse/services/smart-filter-spec";
import type { SmartFilterSpec } from "$lib/shared/library/domain/models/collection";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

function seq(id: string, level: number): SequenceData {
  // Minimal shape the difficulty filter reads (level field + fallback).
  return { id, word: id, level } as unknown as SequenceData;
}

describe("deriveSpecMembers", () => {
  it("filters a pool by the spec's stored filters (difficulty)", () => {
    const pool = [seq("a", 1), seq("b", 2), seq("c", 2), seq("d", 3)];
    const spec: SmartFilterSpec = {
      source: "community",
      filters: [
        { key: "difficulty", type: "difficulty", value: 2, label: "Level 2", chipColor: "#fff" },
      ],
      sortMethod: "alphabetical",
      sortDirection: "asc",
    };
    const result = deriveSpecMembers(pool, spec).map((s) => s.id).sort();
    expect(result).toEqual(["b", "c"]);
  });

  it("empty filters returns the whole pool", () => {
    const pool = [seq("a", 1), seq("b", 2)];
    const spec: SmartFilterSpec = {
      source: "community", filters: [], sortMethod: "alphabetical", sortDirection: "asc",
    };
    expect(deriveSpecMembers(pool, spec)).toHaveLength(2);
  });
});
