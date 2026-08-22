import { describe, expect, it, vi } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

const { resolveFamily } = vi.hoisted(() => ({
  resolveFamily: vi.fn(),
}));

vi.mock("$lib/features/lab/vtg-lab/services/resolve-tnd-family-cards", () => ({
  resolveTnDFamilyCards: resolveFamily,
}));
vi.mock("$lib/shared/browse/services/sequence-difficulty-calculator", () => ({
  calculateDifficultyLevel: () => 1,
}));
vi.mock("$lib/shared/create/services/reversal-detector", () => ({
  processReversals: (sequence: SequenceData) => sequence,
}));
vi.mock("$lib/features/choreo-card/services/reversal-seed-service", () => ({
  transformSequence: (sequence: SequenceData) => sequence,
}));
vi.mock("$lib/features/choreo-card/services/pictograph-letter-lookup", () => ({
  loadDiamondEdges: vi.fn(),
}));
vi.mock("$lib/features/choreo-card/domain/reversal-patterns", () => ({
  getReversalPattern: () => ({
    id: "book",
    label: "Book",
    sequence: ["P", "P", "P", "P"],
  }),
}));

import { loadCanonicalLearningLettersSequences } from "$lib/features/browse/gallery-home/canonical-tnd-pool";

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
    steps: [],
    thumbnails: [],
    isFavorite: false,
    isCircular: true,
    tags: ["tnd-deck", familyId],
    metadata: { familyId },
  };
}

describe("Learning Letters canonical loader", () => {
  it("resolves the exact 19 zero-turn deck cards in family order", async () => {
    resolveFamily.mockImplementation(
      async (familyId: string, options: { patterns?: readonly string[] }) => {
        expect(options).toEqual({ patterns: ["0|0"] });
        return (WORDS_BY_FAMILY[familyId] ?? []).map((word) => ({
          seedId: `tnd-${familyId}-${word.toLowerCase()}`,
          byTurn: new Map([["0|0", sequence(word, familyId)]]),
        }));
      }
    );

    const cards = await loadCanonicalLearningLettersSequences();

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
    expect(resolveFamily).toHaveBeenCalledTimes(6);
  });
});
