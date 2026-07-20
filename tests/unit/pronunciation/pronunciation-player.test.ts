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
