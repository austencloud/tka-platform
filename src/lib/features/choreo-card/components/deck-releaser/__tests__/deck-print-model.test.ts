import { describe, expect, it } from "vitest";
import {
  buildDeckPrintMetadata,
  buildHandPathDeckPrintMetadata,
  normalizeDeckFooters,
  orderDeckForPrint,
  usesSerializedCardIdentity,
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
      includeHowToRead: true,
    });

    expect(metadata.title).toBe("Deck 042: 3 cards");
    expect(metadata.keywords).toEqual(["AB", "C"]);
    expect(metadata.deckSummary).toContain("Fire Deck  ·  Rotated");
    expect(metadata.subject).toContain("2 sequence cards + How to Read insert");
  });

  it("describes only sequence cards when the insert is disabled", () => {
    const metadata = buildDeckPrintMetadata({
      deckLabel: "Home Deck",
      deckRefPadded: "043",
      sequences: [{ word: "ABAB" }, { word: "C" }],
      loopType: "rotated",
      level: 2,
      period: "quartered",
      selectedLength: 8,
      turnIntensity: 1,
      gridMode: "diamond",
      propType: "double_staff",
      includeHowToRead: false,
    });

    expect(metadata.title).toBe("Deck 043: 2 cards");
    expect(metadata.subject).toContain("2 sequence cards. Words:");
    expect(metadata.subject).not.toContain("How to Read");
  });

  it("describes the six-card hand-path deck without sequence language", () => {
    const metadata = buildHandPathDeckPrintMetadata({
      deckLabel: "Timing & Direction Hand Paths",
      deckRefPadded: "044",
      cardNames: [
        "Split-Same",
        "Tog-Same",
        "Split-Opp",
        "Tog-Opp",
        "Quarter-Opp",
        "Quarter-Same",
      ],
      includeHowToRead: false,
    });

    expect(metadata.title).toBe("Deck 044: 6 cards");
    expect(metadata.subject).toContain("6 Timing & Direction hand-path");
    expect(metadata.subject).not.toContain("sequence");
    expect(metadata.deckSummary).toContain("Hand Path References");
  });

  it("never allocates QR identities for hand-path reference cards", () => {
    expect(usesSerializedCardIdentity("hand-path")).toBe(false);
    expect(usesSerializedCardIdentity("sequence")).toBe(true);
  });
});
