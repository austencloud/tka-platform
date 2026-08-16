import { describe, expect, it } from "vitest";

import { segmentWordByEnergy } from "$lib/features/lab/pronunciation-recorder/domain/voice-activity-trimmer";

const SAMPLE_RATE = 48_000;

/**
 * Build speech-like audio: `count` tone bursts separated by silence. The gap
 * exceeds the trimmer's 200 ms merge window so the bursts stay distinct, and
 * each burst clears its 80 ms minimum-speech floor.
 */
function burstAudio(
  count: number,
  burstSeconds = 0.3,
  gapSeconds = 0.25
): Float32Array {
  const burstLength = Math.round(SAMPLE_RATE * burstSeconds);
  const gapLength = Math.round(SAMPLE_RATE * gapSeconds);
  const total = count * burstLength + (count - 1) * gapLength;
  const samples = new Float32Array(total);

  let cursor = 0;
  for (let burst = 0; burst < count; burst++) {
    for (let index = 0; index < burstLength; index++) {
      samples[cursor + index] =
        0.5 * Math.sin((2 * Math.PI * 200 * index) / SAMPLE_RATE);
    }
    cursor += burstLength + gapLength;
  }
  return samples;
}

describe("segmentWordByEnergy", () => {
  it("returns one range per spoken letter", () => {
    const result = segmentWordByEnergy(burstAudio(4), SAMPLE_RATE, 4);

    expect(result.detectedSegments).toBe(4);
    expect(result.matchesExpected).toBe(true);
    expect(result.segments).toHaveLength(4);
  });

  it("orders ranges by time and keeps them inside the buffer", () => {
    const result = segmentWordByEnergy(burstAudio(3), SAMPLE_RATE, 3);

    const [first, second, third] = result.segments;
    expect(first!.startSeconds).toBeGreaterThanOrEqual(0);
    expect(first!.startSeconds).toBeLessThan(second!.startSeconds);
    expect(second!.startSeconds).toBeLessThan(third!.startSeconds);
    expect(third!.endSeconds).toBeLessThanOrEqual(3 * 0.3 + 2 * 0.25);
  });

  it("reports a mismatch when islands do not match the expected letter count", () => {
    const result = segmentWordByEnergy(burstAudio(2), SAMPLE_RATE, 4);

    expect(result.detectedSegments).toBe(2);
    expect(result.matchesExpected).toBe(false);
  });

  it("reports no segments for silence", () => {
    const result = segmentWordByEnergy(
      new Float32Array(SAMPLE_RATE),
      SAMPLE_RATE,
      3
    );

    expect(result.detectedSegments).toBe(0);
    expect(result.matchesExpected).toBe(false);
  });
});
