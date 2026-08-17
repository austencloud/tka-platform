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

/**
 * A voiced sound, not a sine: real speech carries harmonics, and it is the
 * harmonics that make lag quantisation produce octave errors.
 */
function voiced(frequencyHz: number, seconds: number, amplitude = 0.3) {
  const samples = new Float32Array(Math.round(SAMPLE_RATE * seconds));
  for (let index = 0; index < samples.length; index++) {
    let value = 0;
    for (let harmonic = 1; harmonic <= 8; harmonic++) {
      if (frequencyHz * harmonic >= SAMPLE_RATE / 2) break;
      value +=
        (1 / harmonic) *
        Math.sin((2 * Math.PI * frequencyHz * harmonic * index) / SAMPLE_RATE);
    }
    samples[index] = amplitude * value;
  }
  return samples;
}

function noise(seconds: number, amplitude: number) {
  const samples = new Float32Array(Math.round(SAMPLE_RATE * seconds));
  let seed = 7;
  for (let index = 0; index < samples.length; index++) {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    samples[index] = amplitude * (seed / 1_073_741_824 - 1);
  }
  return samples;
}

function concat(...parts: Float32Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const joined = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
}

describe("measureRmsDb", () => {
  it("measures a known amplitude", () => {
    // RMS of a 0.5-amplitude sine is 0.3536, which is -9.03 dBFS.
    expect(measureRmsDb(sine(200, 0.5))).toBeCloseTo(-9.03, 1);
  });

  it("floors silence instead of returning negative infinity", () => {
    expect(measureRmsDb(new Float32Array(1000))).toBe(-100);
  });

  it("ignores DC offset, which is inaudible but reads as level", () => {
    const withOffset = sine(200, 0.5);
    for (let index = 0; index < withOffset.length; index++) {
      withOffset[index] = (withOffset[index] ?? 0) + 0.4;
    }

    expect(measureRmsDb(withOffset)).toBeCloseTo(-9.03, 1);
  });

  it("floors pure DC rather than reporting it as loudness", () => {
    expect(measureRmsDb(new Float32Array(4800).fill(0.3))).toBe(-100);
  });

  it("stays finite when a sample is corrupt", () => {
    // One NaN escaping into the manifest fails the parser's finite check, and
    // the parser rejects the whole bank — every word in the app would fall
    // back to synthetic speech because one WAV decoded badly.
    const corrupt = sine(200, 0.5);
    corrupt[100] = Number.NaN;
    corrupt[200] = Number.POSITIVE_INFINITY;

    expect(Number.isFinite(measureRmsDb(corrupt))).toBe(true);
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

  it("returns null for a nonsense sample rate instead of dividing by zero", () => {
    expect(estimateF0Hz(sine(120, 0.3), 0)).toBeNull();
    expect(estimateF0Hz(sine(120, 0.3), Number.NaN)).toBeNull();
  });

  // Bare argmax returns exactly half these values. The true period is a
  // fractional number of samples, so a doubled lag lands nearer a whole number
  // of periods and outscores it: at 170 Hz the true lag 282 scores 0.999836
  // while lag 565 scores 0.999886. Nothing about the reported value looks
  // wrong — 105 Hz is a perfectly ordinary male pitch — so this can only be
  // caught here.
  it.each([170, 190, 210, 230, 260, 330])(
    "does not report a subharmonic for %i Hz over one edge window",
    (frequencyHz) => {
      const estimate = estimateF0Hz(voiced(frequencyHz, 0.06), SAMPLE_RATE);

      expect(estimate).not.toBeNull();
      expect(estimate!).toBeGreaterThan(frequencyHz * 0.95);
      expect(estimate!).toBeLessThan(frequencyHz * 1.05);
    }
  );
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

  it("finds the pitch behind an unvoiced onset", () => {
    // What Sigma, Psi, Theta, Tau, Phi, Chi and Xi actually look like: the
    // segmenter's 35 ms of padding, then a fricative, then voicing. Reporting
    // 0 Hz here is not merely imprecise — the selector reads it as a 130 Hz
    // pitch gap and charges 1.3, more than a full coarticulation mismatch, so
    // every one of those letters would be mis-selected against.
    const token = concat(
      noise(0.035, 0.0005),
      noise(0.03, 0.05),
      voiced(150, 0.3)
    );

    const features = measureTokenFeatures(token, SAMPLE_RATE);

    expect(features.f0StartHz).toBeGreaterThan(140);
    expect(features.f0StartHz).toBeLessThan(160);
  });

  it("reports the unvoiced sentinel when nothing is voiced anywhere", () => {
    const features = measureTokenFeatures(noise(0.4, 0.2), SAMPLE_RATE);

    expect(features.f0StartHz).toBe(0);
    expect(features.f0EndHz).toBe(0);
  });

  it("measures level at each edge as well as across the token", () => {
    const token = concat(voiced(150, 0.2, 0.05), voiced(150, 0.2, 0.4));

    const features = measureTokenFeatures(token, SAMPLE_RATE);

    expect(features.rmsEndDb).toBeGreaterThan(features.rmsStartDb + 12);
    expect(features.rmsDb).toBeGreaterThan(features.rmsStartDb);
    expect(features.rmsDb).toBeLessThan(features.rmsEndDb);
  });
});
