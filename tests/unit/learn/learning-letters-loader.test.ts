import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  LEARNING_LETTERS_SCHEMA_VERSION,
  nextUnvisitedSequenceIndex,
  normalizeLearningLettersProgress,
} from "$lib/features/learn/components/interactive/words/learning-letters-progress";

const { canonicalPool, loadCanonicalTnDSequences } = vi.hoisted(() => ({
  canonicalPool: [] as SequenceData[],
  loadCanonicalTnDSequences: vi.fn(),
}));

vi.mock("$lib/features/browse/gallery-home/canonical-tnd-pool", () => ({
  CANONICAL_TND_AUTHOR: "T&D Alphabet",
  loadCanonicalTnDSequences,
  loadCanonicalBookVariations: vi.fn(async () => []),
}));

import { loadFoundingCollectionSequences } from "$lib/features/browse/collections/config/founding-collections";

const WORDS_BY_FAMILY: Readonly<Record<string, readonly string[]>> = {
  "split-same": ["AAAA", "BBBB", "CCCC"],
  "tog-same": ["GGGG", "HHHH", "IIII"],
  "quarter-same": ["SSSS", "TTTT", "UUUU", "VVVV"],
  "split-opp": ["JDJD", "KEKE", "LFLF"],
  "tog-opp": ["DJDJ", "EKEK", "FLFL"],
  "quarter-opp": ["MPMP", "NQNQ", "OROR"],
};

function sequence(word: string, familyId: string): SequenceData {
  return {
    id: `tnd-${familyId}-${word.toLowerCase()}`,
    name: word,
    word,
    author: "T&D Alphabet",
    level: 1,
    steps: [],
    thumbnails: [],
    isFavorite: false,
    isCircular: true,
    tags: ["tnd-deck", familyId],
    metadata: { familyId },
  } as SequenceData;
}

describe("Learning Letters founding deck loader", () => {
  beforeEach(() => {
    canonicalPool.splice(
      0,
      canonicalPool.length,
      ...Object.entries(WORDS_BY_FAMILY).flatMap(([familyId, words]) =>
        words.map((word) => sequence(word, familyId))
      )
    );
    loadCanonicalTnDSequences.mockResolvedValue(canonicalPool);
  });

  it("resolves TKA 1 through the founding collection rule", async () => {
    const cards = await loadFoundingCollectionSequences("founding_tka-1");

    expect(cards.map((card) => card.word)).toEqual([
      "AAAA",
      "BBBB",
      "CCCC",
      "GGGG",
      "HHHH",
      "IIII",
      "SSSS",
      "TTTT",
      "UUUU",
      "VVVV",
      "JDJD",
      "KEKE",
      "LFLF",
      "DJDJ",
      "EKEK",
      "FLFL",
      "MPMP",
      "NQNQ",
      "OROR",
    ]);
    expect(new Set(cards.map((card) => card.id)).size).toBe(19);
    expect(loadCanonicalTnDSequences).toHaveBeenCalledOnce();
  });

  it("rejects deck drift instead of presenting a partial lesson", async () => {
    canonicalPool.pop();
    await expect(
      loadFoundingCollectionSequences("founding_tka-1")
    ).rejects.toThrow("resolved 18 cards instead of 19");
  });
});

describe("Learning Letters progress migration", () => {
  const ids = ["a", "b", "c"];

  it("resets the rejected quiz-phase shape to the first live deck card", () => {
    const normalized = normalizeLearningLettersProgress(
      { step: 3, phaseData: { questionIndex: 2 } },
      ids
    );

    expect(normalized.migrated).toBe(true);
    expect(normalized.progress).toEqual({
      schemaVersion: LEARNING_LETTERS_SCHEMA_VERSION,
      selectedSequenceId: "a",
      visitedSequenceIds: ["a"],
    });
  });

  it("keeps current progress while removing stale ids", () => {
    const normalized = normalizeLearningLettersProgress(
      {
        step: 1,
        phaseData: {
          schemaVersion: LEARNING_LETTERS_SCHEMA_VERSION,
          selectedSequenceId: "b",
          visitedSequenceIds: ["a", "stale", "b", "a"],
        },
      },
      ids
    );

    expect(normalized.progress.selectedSequenceId).toBe("b");
    expect(normalized.progress.visitedSequenceIds).toEqual(["a", "b"]);
    expect(normalized.migrated).toBe(true);
  });

  it("walks to the next unvisited card and wraps after a family jump", () => {
    expect(nextUnvisitedSequenceIndex(2, ids, new Set(["a"]))).toBe(1);
    expect(nextUnvisitedSequenceIndex(1, ids, new Set(ids))).toBe(-1);
  });
});
