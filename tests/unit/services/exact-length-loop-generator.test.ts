import { describe, expect, it, vi } from "vitest";
import {
  generateCircularExactLength,
  ORIENTATION_SEED_PROBABILITY,
  MAX_REROLLS,
} from "$lib/features/create/generate/circular/services/exact-length-loop-generator";
import { GenerationMode } from "$lib/features/create/generate/shared/domain/models/generate-models";
import type { GenerationOptions } from "$lib/features/create/generate/shared/domain/models/generate-models";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { DifficultyLevel } from "$lib/features/create/generate/shared/domain/models/generate-models";
import { LOOPType, Period } from "$lib/shared/foundation/domain/models/generation/circular-models";

function baseOptions(overrides: Partial<GenerationOptions> = {}): GenerationOptions {
  return {
    mode: GenerationMode.CIRCULAR,
    length: 8,
    gridMode: "diamond" as GenerationOptions["gridMode"],
    propType: PropType.STAFF,
    difficulty: DifficultyLevel.INTERMEDIATE,
    loopType: LOOPType.ROTATED,
    period: Period.HALVED,
    ...overrides,
  };
}

function seq(overrides: Partial<SequenceData> = {}): SequenceData {
  return {
    steps: [],
    word: "",
    ...overrides,
  } as SequenceData;
}

describe("generateCircularExactLength", () => {
  it("non-circular mode passes options straight through with a single generate call", async () => {
    const options = baseOptions({ mode: GenerationMode.FREEFORM, loopType: undefined });
    const generate = vi.fn().mockResolvedValue(seq({ orientationCycleCount: 1 }));
    const extend = vi.fn();

    const result = await generateCircularExactLength(options, { generate, extend });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(extend).not.toHaveBeenCalled();
    expect(result.extendedPastRequest).toBe(false);
  });

  it("word mode passes straight through, extending is expected (not past-request)", async () => {
    const options = baseOptions({ word: "BOOK" });
    const generate = vi.fn().mockResolvedValue(seq({ orientationCycleCount: 2 }));
    const extendedSeq = seq({ orientationCycleCount: 2, steps: [{} as never, {} as never] });
    const extend = vi.fn().mockReturnValue(extendedSeq);

    const result = await generateCircularExactLength(options, { generate, extend });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(extend).toHaveBeenCalledTimes(1);
    expect(result.extendedPastRequest).toBe(false);
    expect(result.sequence).toBe(extendedSeq);
  });

  it("circular, closed on first try: returned as-is, one call, extendedPastRequest false", async () => {
    const options = baseOptions();
    const closedSeq = seq({ orientationCycleCount: 1, steps: new Array(8).fill({}) });
    const generate = vi.fn().mockResolvedValue(closedSeq);
    const extend = vi.fn();
    const rng = () => 0.9; // skip orientation-seeded path

    const result = await generateCircularExactLength(options, { generate, extend, rng });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(extend).not.toHaveBeenCalled();
    expect(result.sequence).toBe(closedSeq);
    expect(result.extendedPastRequest).toBe(false);
  });

  it("circular, open then closed: two generate calls, closed sequence returned", async () => {
    const options = baseOptions();
    const openSeq = seq({ orientationCycleCount: 2 });
    const closedSeq = seq({ orientationCycleCount: 1, steps: new Array(8).fill({}) });
    const generate = vi
      .fn()
      .mockResolvedValueOnce(openSeq)
      .mockResolvedValueOnce(closedSeq);
    const extend = vi.fn();
    const rng = () => 0.9; // skip orientation-seeded path

    const result = await generateCircularExactLength(options, { generate, extend, rng });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(extend).not.toHaveBeenCalled();
    expect(result.sequence).toBe(closedSeq);
    expect(result.extendedPastRequest).toBe(false);
  });

  it("circular, always open: extends the last one, extendedPastRequest true", async () => {
    const options = baseOptions();
    const openSeq = seq({ orientationCycleCount: 2 });
    const generate = vi.fn().mockResolvedValue(openSeq);
    const extendedSeq = seq({ orientationCycleCount: 2, steps: new Array(16).fill({}) });
    const extend = vi.fn().mockReturnValue(extendedSeq);
    const rng = () => 0.9; // skip orientation-seeded path

    const result = await generateCircularExactLength(options, { generate, extend, rng });

    expect(generate).toHaveBeenCalledTimes(MAX_REROLLS);
    expect(extend).toHaveBeenCalledTimes(1);
    expect(extend).toHaveBeenCalledWith(openSeq);
    expect(result.sequence).toBe(extendedSeq);
    expect(result.extendedPastRequest).toBe(true);
  });

  it("orientation-seeded path: rng below threshold, half-generate returns cycleCount 2 -> extend called, extendedPastRequest false", async () => {
    // length 8, no wire, period halved -> multiplier 2; half = 4; 4 % 2 === 0
    const options = baseOptions({ length: 8, period: Period.HALVED });
    const halfSeed = seq({ orientationCycleCount: 2 });
    const generate = vi.fn().mockResolvedValue(halfSeed);
    const extendedSeq = seq({ orientationCycleCount: 2, steps: new Array(8).fill({}) });
    const extend = vi.fn().mockReturnValue(extendedSeq);
    const rng = () => 0; // below ORIENTATION_SEED_PROBABILITY

    expect(ORIENTATION_SEED_PROBABILITY).toBeGreaterThan(0);

    const result = await generateCircularExactLength(options, { generate, extend, rng });

    expect(generate).toHaveBeenCalledTimes(1);
    const calledWith = generate.mock.calls[0]![0] as GenerationOptions;
    expect(calledWith.length).toBe(4);
    expect(extend).toHaveBeenCalledWith(halfSeed);
    expect(result.sequence).toBe(extendedSeq);
    expect(result.extendedPastRequest).toBe(false);
  });

  it("orientation-seeded attempt returns cycleCount 1 (discarded), falls through to normal path at full length", async () => {
    const options = baseOptions({ length: 8, period: Period.HALVED });
    const halfSeedClosed = seq({ orientationCycleCount: 1 });
    const fullClosed = seq({ orientationCycleCount: 1, steps: new Array(8).fill({}) });
    const generate = vi
      .fn()
      .mockResolvedValueOnce(halfSeedClosed) // seed attempt 1
      .mockResolvedValueOnce(halfSeedClosed) // seed attempt 2
      .mockResolvedValueOnce(halfSeedClosed) // seed attempt 3 (MAX_SEED_ATTEMPTS exhausted)
      .mockResolvedValueOnce(fullClosed); // normal path, full length
    const extend = vi.fn();
    const rng = () => 0; // below threshold, enters seeded path

    const result = await generateCircularExactLength(options, { generate, extend, rng });

    expect(generate).toHaveBeenCalledTimes(4);
    const lastCall = generate.mock.calls[3]![0] as GenerationOptions;
    expect(lastCall.length).toBe(8);
    expect(result.sequence).toBe(fullClosed);
    expect(result.extendedPastRequest).toBe(false);
  });

  it("rng at/above threshold skips the seeded path entirely - all generate calls at full length", async () => {
    const options = baseOptions({ length: 8, period: Period.HALVED });
    const closedSeq = seq({ orientationCycleCount: 1, steps: new Array(8).fill({}) });
    const generate = vi.fn().mockResolvedValue(closedSeq);
    const extend = vi.fn();
    const rng = () => 0.9;

    await generateCircularExactLength(options, { generate, extend, rng });

    for (const call of generate.mock.calls) {
      expect((call[0] as GenerationOptions).length).toBe(8);
    }
  });

  it("circular, closed but SHORT (reduced below request): re-rolls until a full-length card comes back", async () => {
    // The deck "asked for 16, got 8" bug: a degenerate seed's transform is a
    // literal repeat, so reduceToMinimalLoop collapses it. It comes back closed
    // (cycleCount 1) but half length — must re-roll, not accept.
    const options = baseOptions({ length: 8, period: Period.HALVED });
    const collapsed = seq({ orientationCycleCount: 1, steps: new Array(4).fill({}) });
    const full = seq({ orientationCycleCount: 1, steps: new Array(8).fill({}) });
    const generate = vi
      .fn()
      .mockResolvedValueOnce(collapsed)
      .mockResolvedValueOnce(collapsed)
      .mockResolvedValueOnce(full);
    const extend = vi.fn();
    const rng = () => 0.9; // skip orientation-seeded path

    const result = await generateCircularExactLength(options, { generate, extend, rng });

    expect(generate).toHaveBeenCalledTimes(3);
    expect(extend).not.toHaveBeenCalled();
    expect(result.sequence).toBe(full);
    expect(result.sequence.steps.length).toBe(8);
    expect(result.extendedPastRequest).toBe(false);
  });

  it("circular, every roll closed-but-short: exhausts re-rolls, returns best-effort last (no crash, no extend)", async () => {
    const options = baseOptions({ length: 8, period: Period.HALVED });
    const collapsed = seq({ orientationCycleCount: 1, steps: new Array(4).fill({}) });
    const generate = vi.fn().mockResolvedValue(collapsed);
    const extend = vi.fn();
    const rng = () => 0.9;

    const result = await generateCircularExactLength(options, { generate, extend, rng });

    expect(generate).toHaveBeenCalledTimes(MAX_REROLLS);
    expect(extend).not.toHaveBeenCalled(); // closed, not open — nothing to extend
    expect(result.sequence).toBe(collapsed);
    expect(result.extendedPastRequest).toBe(false);
  });

  it("half-generate throws: falls through to normal path without crashing", async () => {
    const options = baseOptions({ length: 8, period: Period.HALVED });
    const fullClosed = seq({ orientationCycleCount: 1, steps: new Array(8).fill({}) });
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error("seed too short"))
      .mockResolvedValueOnce(fullClosed);
    const extend = vi.fn();
    const rng = () => 0; // enters seeded path, first attempt throws

    const result = await generateCircularExactLength(options, { generate, extend, rng });

    expect(result.sequence).toBe(fullClosed);
    expect(result.extendedPastRequest).toBe(false);
  });
});
