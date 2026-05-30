import { describe, it, expect } from "vitest";
import {
  getTnDFamilyOptions,
  getTnDTurnPatternOptions,
  buildTnDCards,
} from "../deck-composer";
import type { Catalog } from "../../domain/models/Catalog";

function baseCatalog(): Catalog {
  return {
    id: "l1-vtg-motions",
    name: "VTG Motions (1:1)",
    canonicalName: "vtg",
    description: "",
    families: [
      { id: "tog-same", label: "Tog-Same", typeCombo: "", sequenceIds: ["AA", "BB", "CC"] },
      { id: "split-same", label: "Split-Same", typeCombo: "", sequenceIds: ["DD", "EE"] },
      { id: "unknown", label: "Unknown", typeCombo: "", sequenceIds: ["ZZ"] },
    ],
    totalSequences: 6,
    gridMode: "diamond" as Catalog["gridMode"],
    level: 1,
    collection: "TnD",
    loopType: "",
    sliceType: "quartered",
    stepCount: 4,
    turnPattern: "uniform-0t",
    reversalPattern: "",
  };
}

describe("getTnDFamilyOptions (base-only)", () => {
  it("reads families from l1-vtg-motions, skips 'unknown', counts base seqs", () => {
    const opts = getTnDFamilyOptions([baseCatalog()]);
    expect(opts.map((o) => o.familyId).sort()).toEqual(["split-same", "tog-same"]);
    const tog = opts.find((o) => o.familyId === "tog-same")!;
    expect(tog.sequenceCount).toBe(3);
    expect(tog.entries).toHaveLength(3);
    expect(tog.entries[0]).toMatchObject({ sequenceId: "AA", sourceCatalogId: "l1-vtg-motions" });
  });

  it("returns empty when the base catalog is absent", () => {
    expect(getTnDFamilyOptions([])).toEqual([]);
  });
});

describe("getTnDTurnPatternOptions (TURN_VALUES²)", () => {
  it("produces all 49 cells with canonical b|r patterns", () => {
    const opts = getTnDTurnPatternOptions(10);
    expect(opts).toHaveLength(49);
    expect(opts.map((o) => o.turnPattern)).toContain("0|0");
    expect(opts.map((o) => o.turnPattern)).toContain("3|3");
    expect(opts.map((o) => o.turnPattern)).toContain("0.5|1");
    expect(opts.every((o) => o.sequenceCount === 10)).toBe(true);
  });
});

describe("buildTnDCards (cartesian)", () => {
  it("emits family × pattern × baseSeq cards, each with variation.turnPattern", () => {
    const families = getTnDFamilyOptions([baseCatalog()]); // tog-same:3, split-same:2
    const selected = new Set(["tog-same"]);
    const patterns = new Set(["0|0", "1|1"]);
    const cards = buildTnDCards(families, selected, patterns);
    expect(cards).toHaveLength(3 * 2); // 3 base × 2 patterns
    expect(cards.every((c) => c.variation?.turnPattern != null)).toBe(true);
    expect(cards.filter((c) => c.variation!.turnPattern === "1|1")).toHaveLength(3);
    expect(cards[0]!.sourceCatalogId).toBe("l1-vtg-motions");
  });

  it("returns no cards when no pattern is selected", () => {
    const families = getTnDFamilyOptions([baseCatalog()]);
    expect(buildTnDCards(families, new Set(["tog-same"]), new Set())).toEqual([]);
  });
});

describe("buildTnDCards — startOriMode", () => {
  it("stamps a single selected register onto every card's variation", () => {
    const families = getTnDFamilyOptions([baseCatalog()]);
    const cards = buildTnDCards(families, new Set(["tog-same"]), new Set(["1|1"]), ["nonradial"]);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.variation?.startOriMode === "nonradial")).toBe(true);
    expect(cards.every((c) => c.variation?.turnPattern === "1|1")).toBe(true);
  });

  it("omits startOriMode when register is radial (default)", () => {
    const families = getTnDFamilyOptions([baseCatalog()]);
    const cards = buildTnDCards(families, new Set(["tog-same"]), new Set(["1|1"]), ["radial"]);
    expect(cards.every((c) => c.variation?.startOriMode === undefined)).toBe(true);
  });

  it("full enumeration: multiplies every base by each selected register", () => {
    const families = getTnDFamilyOptions([baseCatalog()]); // tog-same: 3 base seqs
    const cards = buildTnDCards(
      families,
      new Set(["tog-same"]),
      new Set(["1|1"]),
      ["radial", "nonradial", "split"],
    );
    // 3 base × 1 pattern × 3 registers
    expect(cards).toHaveLength(3 * 3);
    expect(cards.filter((c) => c.variation?.startOriMode === "nonradial")).toHaveLength(3);
    expect(cards.filter((c) => c.variation?.startOriMode === "split")).toHaveLength(3);
    // radial copies carry no startOriMode tag
    expect(cards.filter((c) => c.variation?.startOriMode === undefined)).toHaveLength(3);
  });

  it("defaults to a single radial enumeration when no register is passed", () => {
    const families = getTnDFamilyOptions([baseCatalog()]);
    const cards = buildTnDCards(families, new Set(["tog-same"]), new Set(["1|1"]));
    expect(cards).toHaveLength(3); // 3 base × 1 pattern × 1 (radial) register
  });
});
