import { describe, it, expect } from "vitest";
import {
  MIN_SEQUENCE_STEPS,
  getPersistedStepCount,
  isOneCountSequence,
} from "$lib/shared/library/domain/sequence-min-length";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

function seq(overrides: Record<string, unknown>) {
  return createSequenceData(overrides as never);
}

describe("sequence-min-length", () => {
  it("MIN is 2", () => {
    expect(MIN_SEQUENCE_STEPS).toBe(2);
  });

  it("counts stepPairings as the source of truth", () => {
    expect(getPersistedStepCount(seq({ stepPairings: [{}, {}, {}] }))).toBe(3);
  });

  it("treats empty stepPairings as zero", () => {
    expect(getPersistedStepCount(seq({ stepPairings: [] }))).toBe(0);
  });

  it("falls back to derived steps when stepPairings absent", () => {
    expect(getPersistedStepCount(seq({ steps: [{}, {}] }))).toBe(2);
  });

  it("falls back to stored sequenceLength when both absent", () => {
    expect(getPersistedStepCount(seq({ sequenceLength: 1 }))).toBe(1);
  });

  it("flags 0 and 1 step sequences as one-count", () => {
    expect(isOneCountSequence(seq({ stepPairings: [] }))).toBe(true);
    expect(isOneCountSequence(seq({ stepPairings: [{}] }))).toBe(true);
  });

  it("does not flag 2+ step sequences", () => {
    expect(isOneCountSequence(seq({ stepPairings: [{}, {}] }))).toBe(false);
  });
});
