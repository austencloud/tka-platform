import { describe, expect, it } from "vitest";

import { parsePronunciationManifest } from "$lib/shared/pronunciation/pronunciation-manifest";
import type { PronunciationToken } from "$lib/shared/pronunciation/pronunciation-plan";

const token: PronunciationToken = {
  path: "a/0f3a.wav",
  position: "medial",
  previousLetter: "B",
  nextLetter: "C",
  sourceWord: "BAC",
  indexInWord: 1,
  wordLength: 3,
  durationMs: 412,
  rmsDb: -19.4,
  f0StartHz: 118.2,
  f0EndHz: 121.7,
};

describe("parsePronunciationManifest", () => {
  it("accepts a version 1 manifest", () => {
    const parsed = parsePronunciationManifest({
      version: 1,
      recordings: { a: { initial: "a/initial.wav" } },
    });

    expect(parsed).toEqual({
      version: 1,
      recordings: { a: { initial: "a/initial.wav" } },
    });
  });

  it("accepts a version 2 token bank", () => {
    const parsed = parsePronunciationManifest({
      version: 2,
      tokens: { a: [token] },
    });

    expect(parsed?.version).toBe(2);
  });

  it("accepts an empty token bank", () => {
    expect(parsePronunciationManifest({ version: 2, tokens: {} })).toEqual({
      version: 2,
      tokens: {},
    });
  });

  it("rejects a token with an unknown position", () => {
    expect(
      parsePronunciationManifest({
        version: 2,
        tokens: { a: [{ ...token, position: "middle" }] },
      })
    ).toBeNull();
  });

  it("rejects a token with a non-finite measurement", () => {
    expect(
      parsePronunciationManifest({
        version: 2,
        tokens: { a: [{ ...token, f0StartHz: Number.NaN }] },
      })
    ).toBeNull();
  });

  it("rejects an unknown version and non-objects", () => {
    expect(parsePronunciationManifest({ version: 3, tokens: {} })).toBeNull();
    expect(parsePronunciationManifest("nope")).toBeNull();
    expect(parsePronunciationManifest(null)).toBeNull();
  });
});
