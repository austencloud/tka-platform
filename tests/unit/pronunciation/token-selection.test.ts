import { describe, expect, it } from "vitest";

import { parsePronunciationManifest } from "$lib/shared/pronunciation/pronunciation-manifest";
import { selectTokenPath } from "$lib/shared/pronunciation/domain/token-selection";
import { createPronunciationPlan } from "$lib/shared/pronunciation/pronunciation-plan";
import type {
  PronunciationToken,
  PronunciationTokenBank,
} from "$lib/shared/pronunciation/pronunciation-plan";

/**
 * Build a token whose recorded context is coherent by default: an initial
 * token has no predecessor, a final token has no successor. The parser
 * enforces exactly this, so a fixture that ignored it could never come from a
 * bank that actually loaded. Explicit overrides still win, and the assertion
 * below catches any override that breaks the rule.
 */
function token(
  overrides: Partial<PronunciationToken> & Pick<PronunciationToken, "path">
): PronunciationToken {
  const position = overrides.position ?? "initial";
  const atStart = position === "initial" || position === "isolated";
  const atEnd = position === "final" || position === "isolated";

  const built: PronunciationToken = {
    position,
    previousLetter: atStart ? null : "A",
    nextLetter: atEnd ? null : "B",
    sourceWord: "AB",
    indexInWord: 0,
    groupLength: 2,
    durationMs: 300,
    rmsDb: -18,
    f0StartHz: 120,
    f0EndHz: 120,
    ...overrides,
  };

  if (
    parsePronunciationManifest({ version: 2, tokens: { a: [built] } }) === null
  ) {
    throw new Error(`Test fixture is not a valid token: ${built.path}`);
  }
  return built;
}

function cuesFor(word: string) {
  const plan = createPronunciationPlan(word);
  if (!plan) throw new Error(`Invalid test word: ${word}`);
  return plan.cues;
}

function bankFrom(
  entries: Record<string, PronunciationToken[]>
): PronunciationTokenBank {
  return { version: 2, tokens: entries };
}

describe("selectTokenPath", () => {
  it("rejects the word when a letter has no tokens", () => {
    const bank = bankFrom({
      a: [token({ path: "a/1.wav", position: "initial" })],
    });

    const result = selectTokenPath(cuesFor("AB"), bank);

    expect(result?.map((entry) => entry.path) ?? null).toBeNull();
  });

  it("rejects the word when tokens exist but never in the needed position", () => {
    const bank = bankFrom({
      a: [token({ path: "a/1.wav", position: "initial" })],
      b: [token({ path: "b/1.wav", position: "initial" })],
    });

    // "AB" needs b in `final` position; only an `initial` b exists.
    const result = selectTokenPath(cuesFor("AB"), bank);

    expect(result?.map((entry) => entry.path) ?? null).toBeNull();
  });

  it("prefers the token whose real neighbours match the target", () => {
    const bank = bankFrom({
      a: [
        token({ path: "a/wrong.wav", position: "initial", nextLetter: "C" }),
        token({ path: "a/right.wav", position: "initial", nextLetter: "B" }),
      ],
      b: [token({ path: "b/1.wav", position: "final" })],
    });

    const result = selectTokenPath(cuesFor("AB"), bank);

    expect(result?.map((entry) => entry.path)).toEqual([
      "a/right.wav",
      "b/1.wav",
    ]);
  });

  it("breaks a tie toward pitch continuity at the join", () => {
    const bank = bankFrom({
      a: [
        token({
          path: "a/only.wav",
          position: "initial",
          nextLetter: "B",
          f0EndHz: 130,
        }),
      ],
      b: [
        token({
          path: "b/jumpy.wav",
          position: "final",
          f0StartHz: 180,
        }),
        token({
          path: "b/smooth.wav",
          position: "final",
          f0StartHz: 132,
        }),
      ],
    });

    const result = selectTokenPath(cuesFor("AB"), bank);

    expect(result?.map((entry) => entry.path)).toEqual([
      "a/only.wav",
      "b/smooth.wav",
    ]);
  });

  it("breaks a tie toward matching loudness at the join", () => {
    const bank = bankFrom({
      a: [
        token({
          path: "a/only.wav",
          position: "initial",
          nextLetter: "B",
          rmsDb: -18,
        }),
      ],
      b: [
        token({
          path: "b/loud.wav",
          position: "final",
          rmsDb: -6,
        }),
        token({
          path: "b/level.wav",
          position: "final",
          rmsDb: -18.5,
        }),
      ],
    });

    const result = selectTokenPath(cuesFor("AB"), bank);

    expect(result?.map((entry) => entry.path)).toEqual([
      "a/only.wav",
      "b/level.wav",
    ]);
  });

  it("resolves an isolated group against isolated tokens", () => {
    const bank = bankFrom({
      a: [
        token({
          path: "a/solo.wav",
          position: "isolated",
          sourceWord: "A",
          groupLength: 1,
        }),
      ],
    });

    const result = selectTokenPath(cuesFor("A"), bank);

    expect(result?.map((entry) => entry.path)).toEqual(["a/solo.wav"]);
  });

  it("accepts a worse token mid-word to buy a cheaper join after it", () => {
    // Every other case here is one or two letters long, where a global search
    // and a greedy one cannot disagree. This is the case that separates them:
    // at B the greedy pick is free on target cost but strands C 130 Hz away,
    // while the sacrifice costs a full neighbour mismatch and lands on C's
    // pitch exactly. Totals are 1.3 greedy against 1.0 sacrificing, so only a
    // search that looks past the current letter picks the right one.
    const bank = bankFrom({
      a: [
        token({
          path: "a.wav",
          position: "initial",
          nextLetter: "B",
          sourceWord: "ABC",
          groupLength: 3,
          f0EndHz: 120,
        }),
      ],
      b: [
        token({
          path: "b/greedy.wav",
          position: "medial",
          previousLetter: "A",
          nextLetter: "C",
          sourceWord: "ABC",
          groupLength: 3,
          f0StartHz: 120,
          f0EndHz: 250,
        }),
        token({
          path: "b/sacrifice.wav",
          position: "medial",
          previousLetter: "A",
          nextLetter: "X",
          sourceWord: "ABX",
          groupLength: 3,
          f0StartHz: 120,
          f0EndHz: 120,
        }),
      ],
      c: [
        token({
          path: "c.wav",
          position: "final",
          previousLetter: "B",
          sourceWord: "ABC",
          groupLength: 3,
          f0StartHz: 120,
        }),
      ],
    });

    const result = selectTokenPath(cuesFor("ABC"), bank);

    expect(result?.map((entry) => entry.path)).toEqual([
      "a.wav",
      "b/sacrifice.wav",
      "c.wav",
    ]);
  });
});
