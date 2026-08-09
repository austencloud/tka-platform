import { describe, expect, it } from "vitest";
import {
  buildDeckPrintMetadata,
  normalizeDeckFooters,
  orderDeckForPrint,
} from "../deck-print-model";

describe("deck print model", () => {
  it("keeps original order when both grouping axes are disabled", () => {
    const sequences = [{ word: "B" }, { word: "A" }, { word: "B" }];
    const footers = [
      { center: "first" },
      { center: "second" },
      { center: "third" },
    ];

    const ordered = orderDeckForPrint(sequences, footers, {
      groupByElement: false,
      groupByLetter: false,
    });

    expect(ordered.sequences.map((sequence) => sequence.word)).toEqual([
      "B",
      "A",
      "B",
    ]);
    expect(ordered.footers.map((footer) => footer.center)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("clusters repeated words by their first appearance", () => {
    const ordered = orderDeckForPrint(
      [
        { word: "B" },
        { word: "A" },
        { word: "B" },
        { word: "C" },
        { word: "A" },
      ],
      Array.from({ length: 5 }, () => ({ center: "deck" })),
      { groupByElement: false, groupByLetter: true }
    );

    expect(ordered.sequences.map((sequence) => sequence.word)).toEqual([
      "B",
      "B",
      "A",
      "A",
      "C",
    ]);
  });

  it("upgrades the legacy sun footer without mutating the source card", () => {
    const cards = [
      {
        sequenceId: "A",
        sourceCatalogId: "catalog",
        stepCount: 4,
        word: "A",
        position: 1,
        footer: { center: "deck", iconPath: "/images/elements/sun-v2.png" },
      },
    ];

    const normalized = normalizeDeckFooters(cards);

    expect(normalized[0]?.iconPath).toBe("/images/elements/sun-v4.png");
    expect(cards[0]?.footer.iconPath).toBe("/images/elements/sun-v2.png");
  });

  it("builds searchable metadata from the printed order", () => {
    const metadata = buildDeckPrintMetadata({
      deckLabel: "Fire Deck",
      deckRefPadded: "042",
      sequences: [{ word: "ABAB" }, { word: "C" }],
      loopType: "rotated",
      level: 2,
      period: "quartered",
      selectedLength: 8,
      turnIntensity: 1,
      gridMode: "diamond",
      propType: "double_staff",
    });

    expect(metadata.title).toBe("Deck 042: 3 cards");
    expect(metadata.keywords).toEqual(["AB", "C"]);
    expect(metadata.deckSummary).toContain("Fire Deck  ·  Rotated");
    expect(metadata.subject).toContain("2 sequence cards + How to Read insert");
  });
});
