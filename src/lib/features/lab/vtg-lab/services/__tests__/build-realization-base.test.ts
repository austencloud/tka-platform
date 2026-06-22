import { describe, it, expect } from "vitest";
import { buildBaseIndex, resolveBase } from "../build-realization-sequence";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

const seq = (word: string, blue: string, red: string): SequenceData =>
  ({
    id: `l1-tnd-${word}`,
    word,
    steps: [{ motions: { blue: { motionType: blue }, red: { motionType: red } } }],
  }) as unknown as SequenceData;

// A representative slice of the 22-word base catalog with real style pairs.
const bases = [
  seq("AAAA", "pro", "pro"), // SS pro/pro
  seq("CCCC", "pro", "anti"), // SS pro/anti
  seq("BBBB", "anti", "anti"), // SS anti/anti
  seq("JDJD", "pro", "pro"), // SO pro/pro
  seq("DJDJ", "pro", "pro"), // TO pro/pro
  seq("MPMP", "pro", "pro"), // QO pro/pro
  seq("UUUU", "pro", "anti"), // QS pro/anti
];

describe("buildBaseIndex / resolveBase", () => {
  it("indexes the opposite-direction 2-letter words that the old letter lookup dropped", () => {
    const idx = buildBaseIndex(bases);
    // SO/TO/QO now resolve — the bug was that "D" never matched the "DJDJ" key.
    expect(resolveBase(idx, "SO", "pro", "pro")?.word).toBe("JDJD");
    expect(resolveBase(idx, "TO", "pro", "pro")?.word).toBe("DJDJ");
    expect(resolveBase(idx, "QO", "pro", "pro")?.word).toBe("MPMP");
  });

  it("resolves same-direction words by mode + style pair", () => {
    const idx = buildBaseIndex(bases);
    expect(resolveBase(idx, "SS", "pro", "pro")?.word).toBe("AAAA");
    expect(resolveBase(idx, "SS", "pro", "anti")?.word).toBe("CCCC");
    expect(resolveBase(idx, "SS", "anti", "anti")?.word).toBe("BBBB");
    expect(resolveBase(idx, "QS", "pro", "anti")?.word).toBe("UUUU");
  });

  it("falls back to the hands-swapped mirror for anti×pro cells", () => {
    const idx = buildBaseIndex(bases);
    // No anti/pro SS word seeded → mirror of pro/anti (CCCC) realizes the same overlay.
    expect(resolveBase(idx, "SS", "anti", "pro")?.word).toBe("CCCC");
  });

  it("returns null when neither the pair nor its mirror has a base word", () => {
    const idx = buildBaseIndex(bases);
    expect(resolveBase(idx, "TS", "anti", "anti")).toBeNull(); // no TS word in this slice
  });

  it("ignores sequences whose word isn't a known base motion", () => {
    const idx = buildBaseIndex([seq("ZZZZ", "pro", "pro"), ...bases]);
    expect(idx.has("SS|pro|pro")).toBe(true);
    expect([...idx.values()].some((s) => s.word === "ZZZZ")).toBe(false);
  });
});
