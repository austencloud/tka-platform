import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  mirrorFestivalSheetColumns,
  placeFestivalSignupAtCenter,
} from "$lib/features/choreo-card/services/festival-sampler-sheet";
import { festivalSamplerFingerprint } from "$lib/features/choreo-card/services/festival-sampler-manifest";
import uniquePackManifests from "$lib/features/choreo-card/data/festival-sampler-manifests.json";

const require = createRequire(import.meta.url);
const { buildCandidateNames, buildFestivalPackCuration, isClassicPosition } =
  require("../../scripts/festival-pack-curate.cjs") as {
    buildCandidateNames(): Array<Record<string, string>>;
    isClassicPosition(position: string | null | undefined): boolean;
    buildFestivalPackCuration(
      documents: unknown[],
      tndRecords?: unknown,
      localRecords?: unknown,
      count?: number
    ): {
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
      rotated16: "OVXΔ",
      rotated8: "MVNU",
      tndBase: "AAAA",
      tndTurn: "JDJD",
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
        "tndBase",
        "tndTurn",
        "mirroredSwapped8",
        "mirroredInverted8",
      ]);
      expect(candidate.cards).toHaveLength(8);
      for (const card of candidate.cards) {
        expect(isClassicPosition(card.startPosition as string)).toBe(true);
        expect(isClassicPosition(card.endPosition as string)).toBe(true);
      }
      expect(
        candidate.cards.find((card) => card.slot === "rotated16")?.period
      ).toBe(4);
      expect(
        candidate.cards.find((card) => card.slot === "rotated8")?.period
      ).toBe(2);
    }
    expect(
      curation.candidates.filter((candidate) => candidate.selected)
    ).toHaveLength(1);
  });

  it("provides 60 different tradeable pack assortments", () => {
    const packs = uniquePackManifests.candidates.slice(0, 60);
    const fingerprints = packs.map((pack) =>
      festivalSamplerFingerprint(pack.cards)
    );

    expect(packs).toHaveLength(60);
    expect(new Set(fingerprints).size).toBe(60);
    const tndPairs = packs.map((pack) =>
      pack.cards
        .filter((card) => card.slot === "tndBase" || card.slot === "tndTurn")
        .map((card) => card.docId)
        .join("|")
    );
    expect(new Set(tndPairs).size).toBe(60);
    expect(
      new Set(
        packs.map(
          (pack) => pack.cards.find((card) => card.slot === "tndBase")!.name
        )
      ).size
    ).toBe(10);
    expect(
      new Set(
        packs.map(
          (pack) => pack.cards.find((card) => card.slot === "tndTurn")!.name
        )
      ).size
    ).toBe(9);
    for (const pack of packs) {
      const base = pack.cards.find((card) => card.slot === "tndBase")!;
      const turn = pack.cards.find((card) => card.slot === "tndTurn")!;
      expect(base.ratio).toBe("1:1");
      expect(base.turnIntensity).toBe(0);
      expect(base.level).toBe(1);
      expect(base.familyId).toMatch(/-same$/);
      expect(turn.ratio).toBe("3:1");
      expect(turn.turnIntensity).toBe(1);
      expect(turn.level).toBe(2);
      expect(turn.familyId).toMatch(/-opp$/);
    }
    expect(
      new Set(
        packs.flatMap((pack) =>
          pack.cards
            .filter((card) => card.slot === "rotated16")
            .map((card) => card.name)
        )
      ).size
    ).toBe(15);
    expect(
      new Set(
        packs.flatMap((pack) =>
          pack.cards
            .filter((card) => card.slot === "rotated8")
            .map((card) => card.name)
        )
      ).size
    ).toBe(13);
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

  it("keeps signup centered and mirrors each back-page row", () => {
    const sheet = placeFestivalSignupAtCenter(
      ["A", "B", "C", "D", "E", "F", "G", "H"],
      "SIGNUP"
    );

    expect(sheet).toEqual(["A", "B", "C", "D", "SIGNUP", "E", "F", "G", "H"]);
    expect(mirrorFestivalSheetColumns(sheet)).toEqual([
      "C",
      "B",
      "A",
      "E",
      "SIGNUP",
      "D",
      "H",
      "G",
      "F",
    ]);
  });
});
