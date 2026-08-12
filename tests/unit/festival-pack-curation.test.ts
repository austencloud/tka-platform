import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { buildCandidateNames, buildFestivalPackCuration } =
  require("../../scripts/festival-pack-curate.cjs") as {
    buildCandidateNames(): Array<Record<string, string>>;
    buildFestivalPackCuration(documents: unknown[]): {
      candidates: Array<{
        selected: boolean;
        cards: Array<Record<string, unknown>>;
      }>;
    };
  };
const { computeTrimGeometry } =
  require("../../scripts/festival-pack-9up.cjs") as {
    computeTrimGeometry(
      width: number,
      height: number
    ): {
      left: number;
      top: number;
      width: number;
      height: number;
    };
  };

describe("festival pack curation", () => {
  it("builds 50 distinct proposals with the approved control first", () => {
    const candidates = buildCandidateNames();
    expect(candidates).toHaveLength(50);
    expect(
      new Set(candidates.map((candidate) => JSON.stringify(candidate))).size
    ).toBe(50);
    expect(candidates[0]).toEqual({
      mirrored8: "DJII",
      rotated16: "NROT",
      rotated8: "MVNU",
      mirroredSwapped8: "FALG",
    });
  });

  it("keeps every proposal inside the approved eight-card slot contract", () => {
    const snapshot = JSON.parse(
      readFileSync("static/data/snapshots/public-sequences.json", "utf8")
    ) as { documents: unknown[] };
    const curation = buildFestivalPackCuration(snapshot.documents);

    expect(curation.candidates).toHaveLength(50);
    for (const candidate of curation.candidates) {
      expect(candidate.cards.map((card) => card.slot)).toEqual([
        "mirrored16",
        "mirrored8",
        "rotated16",
        "rotated8",
        "vtgSplitSame",
        "vtgTogetherSame",
        "mirroredSwapped8",
        "mirroredInverted8",
      ]);
      expect(candidate.cards).toHaveLength(8);
    }
    expect(
      curation.candidates.filter((candidate) => candidate.selected)
    ).toHaveLength(1);
  });

  it("crops the same physical bleed from 1x fronts and 2x backs", () => {
    expect(computeTrimGeometry(822, 1122)).toEqual({
      left: 36,
      top: 36,
      width: 750,
      height: 1050,
    });
    expect(computeTrimGeometry(1644, 2244)).toEqual({
      left: 72,
      top: 72,
      width: 1500,
      height: 2100,
    });
  });
});
