import { describe, expect, it } from "vitest";
import type { DeckRelease } from "../../../domain/models/DeckRelease";
import {
  extractReleasedSequenceIds,
  findDuplicateRelease,
  isGalleryRelease,
  isHandPathRelease,
  isLoopRelease,
  isTnDRelease,
} from "../deck-release-model";

function release(
  deckNumber: number,
  mode?: "loop" | "tnd" | "gallery",
  sequenceIds: string[] = []
): DeckRelease {
  return {
    deckNumber,
    createdAt: "2026-08-09T00:00:00.000Z",
    theme: "rainbow",
    cardCount: sequenceIds.length,
    stepCountDistribution: {},
    notes: "test",
    sequences: sequenceIds.map((sequenceId, index) => ({
      sequenceId,
      sourceCatalogId: "catalog",
      stepCount: 4,
      word: sequenceId,
      position: index + 1,
      footer: { center: "test" },
    })),
    recipe: mode
      ? {
          deckMode: mode,
          startOriModes: ["radial"],
          gridModes: ["diamond"],
          reversalPattern: null,
        }
      : undefined,
  };
}

describe("deck release model", () => {
  it("classifies legacy releases as Timing and Direction", () => {
    const legacy = release(1);
    expect(isTnDRelease(legacy)).toBe(true);
    expect(isLoopRelease(legacy)).toBe(false);
    expect(isGalleryRelease(legacy)).toBe(false);
  });

  it("classifies explicit gallery and LOOP releases", () => {
    expect(isGalleryRelease(release(1, "gallery"))).toBe(true);
    expect(isLoopRelease(release(2, "loop"))).toBe(true);
  });

  it("keeps reference-only hand-path releases out of the TnD sequence list", () => {
    const handPaths: DeckRelease = {
      ...release(3),
      cardCount: 6,
      handPathCards: {
        version: 1,
        cardIds: ["ss", "ts", "so", "to", "qo", "qs"],
      },
    };

    expect(isHandPathRelease(handPaths)).toBe(true);
    expect(isTnDRelease(handPaths)).toBe(false);
  });

  it("collects released sequence ids without duplicates", () => {
    expect([
      ...extractReleasedSequenceIds([
        release(1, "loop", ["A", "B"]),
        release(2, "tnd", ["B", "C"]),
      ]),
    ]).toEqual(["A", "B", "C"]);
  });

  it("finds a duplicate deck regardless of card order", () => {
    const existing = release(7, "loop", ["A", "B"]);
    const reversed = [...existing.sequences].reverse().map((card, index) => ({
      ...card,
      position: index + 1,
    }));

    expect(findDuplicateRelease(reversed, [existing])?.deckNumber).toBe(7);
  });
});
