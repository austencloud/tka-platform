import { describe, it, expect } from "vitest";
import { PhraseInterpolator } from "../../src/lib/features/phrase-effort-lab/services/implementations/PhraseInterpolator";
import type { EffortPhrase } from "../../src/lib/features/phrase-effort-lab/domain/effort-timeline-types";
import { findPhraseAtBeat, createEffortTimeline, insertPhrase, createEffortPhrase } from "../../src/lib/features/phrase-effort-lab/domain/effort-timeline-types";

describe("PhraseInterpolator", () => {
  const interpolator = new PhraseInterpolator();

  it("returns step 0, progress 0 at phrase start", () => {
    const phrase: EffortPhrase = {
      id: "test", effortId: "linear", startBeat: 1, endBeat: 4,
    };
    const result = interpolator.interpolate(phrase, 1.0, 8);
    expect(result.stepIndex).toBe(0); // beat 1 = step index 0
    expect(result.localProgress).toBeCloseTo(0, 2);
  });

  it("returns last step at phrase end", () => {
    const phrase: EffortPhrase = {
      id: "test", effortId: "linear", startBeat: 1, endBeat: 4,
    };
    const result = interpolator.interpolate(phrase, 4.99, 8);
    expect(result.stepIndex).toBe(3); // beat 4 = step index 3
    expect(result.localProgress).toBeGreaterThan(0.9);
  });

  it("linear effort maps 50% phrase progress to middle of phrase", () => {
    const phrase: EffortPhrase = {
      id: "test", effortId: "linear", startBeat: 1, endBeat: 4,
    };
    const result = interpolator.interpolate(phrase, 3.0, 8);
    expect(result.stepIndex).toBe(2);
    expect(result.localProgress).toBeCloseTo(0, 2);
  });

  it("press effort causes lingering at early positions", () => {
    const phrase: EffortPhrase = {
      id: "test", effortId: "press", startBeat: 1, endBeat: 4,
    };
    const result = interpolator.interpolate(phrase, 3.0, 8);
    expect(result.stepIndex).toBeLessThanOrEqual(1);
  });

  it("clamps to phrase boundaries", () => {
    const phrase: EffortPhrase = {
      id: "test", effortId: "linear", startBeat: 3, endBeat: 6,
    };
    const before = interpolator.interpolate(phrase, 2.5, 8);
    expect(before.stepIndex).toBe(2); // clamped to phrase start (beat 3 = index 2)
    expect(before.localProgress).toBeCloseTo(0, 2);
  });

  it("handles single-beat phrase", () => {
    const phrase: EffortPhrase = {
      id: "test", effortId: "linear", startBeat: 3, endBeat: 3,
    };
    const result = interpolator.interpolate(phrase, 3.5, 8);
    expect(result.stepIndex).toBe(2); // beat 3 = index 2
    expect(result.localProgress).toBeCloseTo(0.5, 1);
  });

  it("adjacent phrases are continuous at boundary", () => {
    // Phrase A: beats 1-4, Phrase B: beats 5-8
    // At the boundary, end of A should be near start of B
    const phraseA: EffortPhrase = {
      id: "a", effortId: "press", startBeat: 1, endBeat: 4,
    };
    const phraseB: EffortPhrase = {
      id: "b", effortId: "glide", startBeat: 5, endBeat: 8,
    };

    // Just before boundary (beat 4.999 — still in phrase A per fractional coverage)
    const endA = interpolator.interpolate(phraseA, 4.999, 12);
    // At boundary (beat 5.0 — start of phrase B)
    const startB = interpolator.interpolate(phraseB, 5.0, 12);

    // End of A should be near step 3 (beat 4 = step 3), close to progress 1.0
    // Start of B should be step 4 (beat 5 = step 4), progress 0.0
    // Step 3 at progress ~1.0 ≈ step 4 at progress 0.0 (same position)
    const endPosition = endA.stepIndex + endA.localProgress;
    const startPosition = startB.stepIndex + startB.localProgress;
    expect(Math.abs(endPosition - startPosition)).toBeLessThan(0.1);
  });
});

describe("findPhraseAtBeat", () => {
  it("covers fractional beats within the last integer beat", () => {
    let timeline = createEffortTimeline();
    const phrase = createEffortPhrase("press", 1, 5);
    timeline = insertPhrase(timeline, phrase);

    // Beat 5.5 should be INSIDE the phrase (between beat 5 and beat 6)
    expect(findPhraseAtBeat(timeline, 5.5)).not.toBeNull();
    // Beat 6.0 should be OUTSIDE (start of next beat)
    expect(findPhraseAtBeat(timeline, 6.0)).toBeNull();
  });

  it("adjacent phrases have no gap", () => {
    let timeline = createEffortTimeline();
    const phraseA = createEffortPhrase("press", 1, 4);
    const phraseB = createEffortPhrase("glide", 5, 8);
    timeline = insertPhrase(timeline, phraseA);
    timeline = insertPhrase(timeline, phraseB);

    // Every fractional beat should be covered — no gaps
    for (let beat = 1.0; beat < 9.0; beat += 0.1) {
      expect(findPhraseAtBeat(timeline, beat)).not.toBeNull();
    }
  });
});
