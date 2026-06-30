import { describe, it, expect } from "vitest";
import {
  MIN_SAVE_STEPS,
  MIN_COMMUNITY_STEPS,
  getPersistedStepCount,
  isEmptySequence,
  meetsCommunityMinimum,
} from "$lib/shared/library/domain/sequence-min-length";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

function seq(overrides: Record<string, unknown>) {
  return createSequenceData(overrides as never);
}

describe("sequence-min-length", () => {
  it("exposes the save floor and community minimum", () => {
    expect(MIN_SAVE_STEPS).toBe(1);
    expect(MIN_COMMUNITY_STEPS).toBe(4);
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

  it("flags only empty sequences (0 steps) as too short to save", () => {
    expect(isEmptySequence(seq({ stepPairings: [] }))).toBe(true);
    // A 1-count is savable to a personal library — not empty.
    expect(isEmptySequence(seq({ stepPairings: [{}] }))).toBe(false);
    expect(isEmptySequence(seq({ stepPairings: [{}, {}, {}, {}] }))).toBe(false);
  });

  it("requires 4+ steps to meet the community minimum", () => {
    expect(meetsCommunityMinimum(seq({ stepPairings: [{}] }))).toBe(false);
    expect(meetsCommunityMinimum(seq({ stepPairings: [{}, {}, {}] }))).toBe(false);
    expect(meetsCommunityMinimum(seq({ stepPairings: [{}, {}, {}, {}] }))).toBe(true);
    expect(meetsCommunityMinimum(seq({ stepPairings: [{}, {}, {}, {}, {}] }))).toBe(true);
  });
});
