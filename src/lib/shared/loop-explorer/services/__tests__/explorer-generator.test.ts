import { describe, it, expect, vi } from "vitest";
import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
import { LOOPType, Period } from "$lib/shared/foundation/domain/models/generation/circular-models";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { generateVerifiedExample, MAX_ATTEMPTS } from "../explorer-generator";

// generateVerifiedExample falls back to the real curated-seeds.json pool
// (findCuratedSeed) on retry exhaustion — not injectable via
// ExplorerGeneratorDeps. Stub it to null so the retry-exhaustion test below
// exercises the "no fallback available" branch deterministically, regardless
// of which (loopType, slice) pairs the harness has since populated real
// seeds for (curated-seeds.json is regenerated data, not test fixture data).
vi.mock("$lib/shared/loop-explorer/domain/curated-seeds", () => ({
  findCuratedSeed: () => null,
}));

function fakeSequence(length: number): SequenceData {
  const steps = Array.from({ length }, (_, i) => ({
    id: `step-${i}`,
    letter: "A",
    startPosition: "alpha1",
    endPosition: "alpha3",
    motions: {
      blue: { motionType: "pro", startLocation: "n", endLocation: "e" },
      red: { motionType: "pro", startLocation: "s", endLocation: "w" },
    },
  }));
  return {
    id: "seq-1",
    name: "test",
    word: "A".repeat(length),
    steps,
    orientationCycleCount: 1,
  } as unknown as SequenceData;
}

describe("generateVerifiedExample", () => {
  it("returns null for an illegal selection without calling generate", async () => {
    const generate = vi.fn();
    const result = await generateVerifiedExample(
      new Set([LOOPComponent.FLIPPED, LOOPComponent.ROTATED]),
      "halved",
      {
        generate,
        extend: (s) => s,
        detect: () => ({ isCircular: true, loopType: null, period: null, confidence: "strict" }),
      }
    );
    expect(result).toBeNull();
    expect(generate).not.toHaveBeenCalled();
  });

  it("accepts on the first attempt when the detector confirms an exact match", async () => {
    const generate = vi.fn(async (options) => fakeSequence(options.length));
    const result = await generateVerifiedExample(new Set([LOOPComponent.ROTATED]), "halved", {
      generate,
      extend: (s) => s,
      detect: () => ({
        isCircular: true,
        loopType: LOOPType.ROTATED,
        period: Period.HALVED,
        confidence: "strict",
      }),
    });

    expect(result).not.toBeNull();
    expect(result?.source).toBe("generated");
    expect(result?.loopType).toBe(LOOPType.ROTATED);
    // generateCircularExactLength may probe an orientation-seed half-length
    // attempt before the full-length call that actually succeeds.
    expect(generate.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("retries up to MAX_ATTEMPTS on a component mismatch, then falls back to null (empty curated pool)", async () => {
    const generate = vi.fn(async (options) => fakeSequence(options.length));
    const detect = vi.fn(() => ({
      isCircular: true,
      // Detected as MIRRORED when the selection was ROTATED — mismatch.
      loopType: LOOPType.MIRRORED,
      period: Period.HALVED,
      confidence: "strict" as const,
    }));

    const result = await generateVerifiedExample(new Set([LOOPComponent.ROTATED]), "halved", {
      generate,
      extend: (s) => s,
      detect,
    });

    expect(result).toBeNull();
    // detect() runs exactly once per outer attempt; generate() may run 1-2
    // times per attempt internally (generateCircularExactLength's own
    // probabilistic orientation-seed path), so only detect's count is exact.
    expect(detect).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(generate.mock.calls.length).toBeGreaterThanOrEqual(MAX_ATTEMPTS);
  });

  it("coerces a quartered request to halved for a non-rotation type before generating", async () => {
    const generate = vi.fn(async (options) => fakeSequence(options.length));
    const result = await generateVerifiedExample(new Set([LOOPComponent.MIRRORED]), "quartered", {
      generate,
      extend: (s) => s,
      detect: () => ({
        isCircular: true,
        loopType: LOOPType.MIRRORED,
        period: Period.HALVED,
        confidence: "strict",
      }),
    });

    expect(result?.slice).toBe("halved");
    const calledOptions = generate.mock.calls[0]![0];
    expect(calledOptions.period).toBe("halved");
  });
});
