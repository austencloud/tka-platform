// tests/unit/pronunciation/corpus-session-store.test.ts
import { describe, expect, it } from "vitest";

import { buildWordFiles, nextWordId } from "$lib/features/lab/pronunciation-recorder/services/implementations/CorpusSessionStore";

describe("buildWordFiles", () => {
  it("writes the TKA letters to words.json and the spoken names to the .lab", () => {
    // Two consumers, two formats: measure-word-segmentation.ts tokenizes the
    // TKA word, and the aligner needs English the dictionary can look up.
    const files = buildWordFiles("01", ["Σ-", "α"]);

    expect(files.wavName).toBe("01.wav");
    expect(files.labName).toBe("01.lab");
    expect(files.labText).toBe("Sigma dash Alpha");
    expect(files.entry).toEqual({ file: "01.wav", word: "Σ-α" });
  });

  it("handles a solo read", () => {
    const files = buildWordFiles("07", ["Ω"]);

    expect(files.labText).toBe("Omega");
    expect(files.entry).toEqual({ file: "07.wav", word: "Ω" });
  });
});

describe("nextWordId", () => {
  it("zero-pads so the directory sorts in reading order", () => {
    expect(nextWordId(0)).toBe("001");
    expect(nextWordId(41)).toBe("042");
    expect(nextWordId(999)).toBe("1000");
  });
});
