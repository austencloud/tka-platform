import { describe, expect, it } from "vitest";

import { Letter } from "$lib/shared/foundation/domain/models/letter";
import { PRONUNCIATION_POSITIONS } from "$lib/shared/pronunciation/pronunciation-plan";
import { buildPronunciationRecordingManifest } from "$lib/features/lab/pronunciation-recorder/domain/recording-manifest";
import {
  buildPronunciationRecordingJobs,
  groupPronunciationRecordingJobs,
} from "$lib/features/lab/pronunciation-recorder/domain/recording-jobs";
import { suggestPronunciationTrim } from "$lib/features/lab/pronunciation-recorder/domain/voice-activity-trimmer";

function carrierSamples(): Float32Array {
  const samples = new Float32Array(2_600);
  samples.fill(0.2, 300, 650);
  samples.fill(0.2, 1_050, 1_400);
  samples.fill(0.2, 1_800, 2_250);
  return samples;
}

describe("pronunciation recording jobs", () => {
  it("creates one slot per runtime letter and context, ordered by contour", () => {
    const jobs = buildPronunciationRecordingJobs();
    const letterCount = Object.values(Letter).length;

    expect(jobs).toHaveLength(letterCount * PRONUNCIATION_POSITIONS.length);
    expect(
      jobs.slice(0, letterCount).every((job) => job.position === "isolated")
    ).toBe(true);
    expect(
      jobs
        .slice(letterCount, letterCount * 2)
        .every((job) => job.position === "initial")
    ).toBe(true);
    expect(new Set(jobs.map((job) => job.id)).size).toBe(jobs.length);
  });

  it("keeps a dash name whole and places it at the end of the final carrier", () => {
    const job = buildPronunciationRecordingJobs().find(
      (candidate) =>
        candidate.letter === Letter.SIGMA_DASH && candidate.position === "final"
    );

    expect(job?.spokenName).toBe("Sigma dash");
    expect(job?.targetSegment).toBe("last");
    expect(job?.promptParts.map((part) => part.text)).toEqual([
      "Alpha",
      "Beta",
      "Sigma dash",
    ]);
    expect(job?.promptParts.filter((part) => part.target)).toHaveLength(1);
  });

  it("groups each letter into the four canonical context columns", () => {
    const rows = groupPronunciationRecordingJobs(
      buildPronunciationRecordingJobs()
    );

    expect(rows).toHaveLength(Object.values(Letter).length);
    expect(rows.every((row) => row.jobs.length === 4)).toBe(true);
    expect(rows[0]?.jobs.map((job) => job.position)).toEqual(
      PRONUNCIATION_POSITIONS
    );
  });
});

describe("pronunciation carrier trimming", () => {
  it.each([
    ["first", 0.265, 0.685],
    ["middle", 1.015, 1.435],
    ["last", 1.765, 2.285],
  ] as const)("selects the %s speech group", (target, start, end) => {
    const suggestion = suggestPronunciationTrim(
      carrierSamples(),
      1_000,
      target
    );

    expect(suggestion.confidence).toBe("strong");
    expect(suggestion.detectedSegments).toBe(3);
    expect(suggestion.startSeconds).toBeCloseTo(start, 3);
    expect(suggestion.endSeconds).toBeCloseTo(end, 3);
  });

  it("keeps a short pause inside a multiword target joined", () => {
    const samples = new Float32Array(1_500);
    samples.fill(0.2, 250, 550);
    samples.fill(0.2, 680, 1_050);

    const suggestion = suggestPronunciationTrim(samples, 1_000, "only");

    expect(suggestion.detectedSegments).toBe(1);
    expect(suggestion.confidence).toBe("strong");
    expect(suggestion.startSeconds).toBeCloseTo(0.215, 3);
    expect(suggestion.endSeconds).toBeCloseTo(1.085, 3);
  });

  it("returns an editable full-range fallback for silence", () => {
    const suggestion = suggestPronunciationTrim(
      new Float32Array(800),
      1_000,
      "middle"
    );

    expect(suggestion).toEqual({
      startSeconds: 0,
      endSeconds: 0.8,
      confidence: "review",
      detectedSegments: 0,
    });
  });
});

describe("pronunciation recording manifest", () => {
  it("contains only approved slots and uses runtime-relative paths", () => {
    const jobs = buildPronunciationRecordingJobs();
    const aInitial = jobs.find(
      (job) => job.letter === Letter.A && job.position === "initial"
    )!;
    const sigmaFinal = jobs.find(
      (job) => job.letter === Letter.SIGMA_DASH && job.position === "final"
    )!;

    const manifest = buildPronunciationRecordingManifest(
      new Set([aInitial.id, sigmaFinal.id]),
      jobs
    );

    expect(manifest).toEqual({
      version: 1,
      recordings: {
        a: { initial: "a/initial.wav" },
        "sigma-dash": { final: "sigma-dash/final.wav" },
      },
    });
  });
});
