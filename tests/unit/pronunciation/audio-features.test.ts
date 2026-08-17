import { describe, expect, it } from "vitest";

import {
  estimateF0Hz,
  measureRmsDb,
  measureTokenFeatures,
} from "$lib/shared/pronunciation/domain/audio-features";

const SAMPLE_RATE = 48_000;

function sine(frequencyHz: number, seconds: number, amplitude = 0.5) {
  const samples = new Float32Array(Math.round(SAMPLE_RATE * seconds));
  for (let index = 0; index < samples.length; index++) {
    samples[index] =
      amplitude * Math.sin((2 * Math.PI * frequencyHz * index) / SAMPLE_RATE);
  }
  return samples;
}

describe("measureRmsDb", () => {
  it("measures a known amplitude", () => {
    // RMS of a 0.5-amplitude sine is 0.3536, which is -9.03 dBFS.
    expect(measureRmsDb(sine(200, 0.5))).toBeCloseTo(-9.03, 1);
  });

  it("floors silence instead of returning negative infinity", () => {
    expect(measureRmsDb(new Float32Array(1000))).toBe(-100);
  });
});

describe("estimateF0Hz", () => {
  it("recovers a pitch inside the speech range", () => {
    const estimate = estimateF0Hz(sine(120, 0.3), SAMPLE_RATE);

    expect(estimate).not.toBeNull();
    expect(estimate!).toBeGreaterThan(117);
    expect(estimate!).toBeLessThan(123);
  });

  it("returns null for noise with no periodicity", () => {
    const samples = new Float32Array(SAMPLE_RATE * 0.3);
    let seed = 1;
    for (let index = 0; index < samples.length; index++) {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      samples[index] = seed / 1_073_741_824 - 1;
    }

    expect(estimateF0Hz(samples, SAMPLE_RATE)).toBeNull();
  });

  it("returns null when the buffer is too short to hold a period", () => {
    expect(estimateF0Hz(sine(120, 0.005), SAMPLE_RATE)).toBeNull();
  });
});

describe("measureTokenFeatures", () => {
  it("measures loudness once and pitch at both edges", () => {
    const features = measureTokenFeatures(sine(150, 0.4), SAMPLE_RATE);

    expect(features.rmsDb).toBeCloseTo(-9.03, 1);
    expect(features.f0StartHz).toBeGreaterThan(145);
    expect(features.f0EndHz).toBeGreaterThan(145);
    expect(features.durationMs).toBeCloseTo(400, 0);
  });

  it("falls back to zero pitch when no periodicity is found", () => {
    const features = measureTokenFeatures(new Float32Array(4800), SAMPLE_RATE);

    expect(features.f0StartHz).toBe(0);
    expect(features.f0EndHz).toBe(0);
  });
});
