import { describe, it, expect } from "vitest";
import { allTurnPatterns, groupCardsBySeed } from "../tnd-turn-patterns";
import { VTG_MODE_TO_TND_FAMILY } from "../vtg-tnd-family-map";

describe("VTG_MODE_TO_TND_FAMILY", () => {
  it("maps all 6 modes to distinct families", () => {
    const families = Object.values(VTG_MODE_TO_TND_FAMILY);
    expect(families).toHaveLength(6);
    expect(new Set(families).size).toBe(6);
    expect(VTG_MODE_TO_TND_FAMILY.SO).toBe("split-opp");
    expect(VTG_MODE_TO_TND_FAMILY.TO).toBe("tog-opp");
  });
});

describe("allTurnPatterns", () => {
  it("returns the 49 blue|red combinations in TURN_VALUES order", () => {
    const p = allTurnPatterns();
    expect(p).toHaveLength(49);
    expect(p[0]).toBe("0|0");
    expect(p).toContain("0.5|1");
    expect(p).toContain("3|3");
    expect(new Set(p).size).toBe(49);
  });
});

describe("groupCardsBySeed", () => {
  it("zips cards to resolved sequences and buckets them by seed + turn pattern", () => {
    const cards = [
      { sequenceId: "MPMP", sourceCatalogId: "l1-tnd-motions", word: "MPMP", footer: { center: "Split-Same", iconPath: "/a.svg" }, variation: { turnPattern: "0|0" } },
      { sequenceId: "MPMP", sourceCatalogId: "l1-tnd-motions", word: "MPMP", footer: { center: "Split-Same", iconPath: "/a.svg" }, variation: { turnPattern: "1|1" } },
      { sequenceId: "DJDJ", sourceCatalogId: "l1-tnd-motions", word: "DJDJ", footer: { center: "Split-Same", iconPath: "/a.svg" }, variation: { turnPattern: "0|0" } },
    ] as any[];
    const resolved = [
      { sequence: { id: "s1" }, turnLoopClosed: true },
      { sequence: { id: "s2" }, turnLoopClosed: true },
      { sequence: { id: "s3" }, turnLoopClosed: true },
    ] as any[];

    const seeds = groupCardsBySeed(cards, resolved);
    expect(seeds).toHaveLength(2);
    expect(seeds[0]!.seedId).toBe("MPMP");
    expect(seeds[0]!.byTurn.get("0|0")?.id).toBe("s1");
    expect(seeds[0]!.byTurn.get("1|1")?.id).toBe("s2");
    expect(seeds[1]!.seedId).toBe("DJDJ");
    expect(seeds[1]!.byTurn.get("0|0")?.id).toBe("s3");
    expect(seeds[0]!.footer.center).toBe("Split-Same");
  });
});
