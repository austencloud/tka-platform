import { describe, expect, it, vi } from "vitest";

import { PronunciationPlayer } from "$lib/shared/pronunciation/services/pronunciation-player";

function manifestResponse(recordings: Record<string, Record<string, string>>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ version: 1, recordings }),
  } as Response;
}

describe("PronunciationPlayer speech fallback", () => {
  it("uses one natural-language utterance when recordings are incomplete", async () => {
    const speechFallback = {
      isSupported: () => true,
      speak: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn(),
    };
    const fetcher = vi.fn().mockResolvedValue(
      manifestResponse({
        a: { initial: "a/initial.wav" },
      })
    );
    const player = new PronunciationPlayer({ speechFallback, fetcher });

    await expect(player.speak("AΣ-")).resolves.toEqual({
      source: "synthetic",
    });
    expect(speechFallback.speak).toHaveBeenCalledWith("A, Sigma dash.");
    expect(speechFallback.speak).toHaveBeenCalledTimes(1);
  });

  it("caches the versioned manifest across words", async () => {
    const speechFallback = {
      isSupported: () => true,
      speak: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn(),
    };
    const fetcher = vi.fn().mockResolvedValue(manifestResponse({}));
    const player = new PronunciationPlayer({ speechFallback, fetcher });

    await player.speak("A");
    await player.speak("B");

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(speechFallback.speak).toHaveBeenNthCalledWith(1, "A.");
    expect(speechFallback.speak).toHaveBeenNthCalledWith(2, "B.");
  });

  it("rejects unknown notation before starting audio", async () => {
    const speechFallback = {
      isSupported: () => true,
      speak: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn(),
    };
    const fetcher = vi.fn().mockResolvedValue(manifestResponse({}));
    const player = new PronunciationPlayer({ speechFallback, fetcher });

    await expect(player.speak("A?B")).rejects.toThrow(
      "Cannot pronounce invalid TKA word"
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(speechFallback.speak).not.toHaveBeenCalled();
  });
});

describe("PronunciationPlayer manifest versions", () => {
  function tokenBankResponse(tokens: Record<string, unknown[]>) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ version: 2, tokens }),
    } as Response;
  }

  it("accepts a version 2 bank and still caches it across words", async () => {
    const speechFallback = {
      isSupported: () => true,
      speak: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn(),
    };
    const fetcher = vi.fn().mockResolvedValue(
      tokenBankResponse({
        a: [
          {
            path: "a/1.wav",
            position: "isolated",
            previousLetter: null,
            nextLetter: null,
            sourceWord: "A",
            indexInWord: 0,
            groupLength: 1,
            durationMs: 300,
            rmsDb: -18,
            f0StartHz: 120,
            f0EndHz: 120,
          },
        ],
      })
    );
    const player = new PronunciationPlayer({ speechFallback, fetcher });

    await player.speak("A");
    await player.speak("B");

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("falls back to speech when a version 2 bank cannot cover the word", async () => {
    const speechFallback = {
      isSupported: () => true,
      speak: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn(),
    };
    const fetcher = vi.fn().mockResolvedValue(tokenBankResponse({}));
    const player = new PronunciationPlayer({ speechFallback, fetcher });

    await expect(player.speak("AB")).resolves.toEqual({ source: "synthetic" });
    expect(speechFallback.speak).toHaveBeenCalledWith("A, B.");
  });

  it("falls back to speech when the manifest shape is unrecognised", async () => {
    const speechFallback = {
      isSupported: () => true,
      speak: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn(),
    };
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ version: 9, whatever: true }),
    } as Response);
    const player = new PronunciationPlayer({ speechFallback, fetcher });

    await expect(player.speak("A")).resolves.toEqual({ source: "synthetic" });
  });
});
