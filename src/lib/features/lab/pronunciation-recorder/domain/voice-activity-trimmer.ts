import type { TargetSegment } from "./recording-jobs";

export interface TrimRange {
  startSeconds: number;
  endSeconds: number;
}

export interface TrimSuggestion extends TrimRange {
  confidence: "strong" | "review";
  detectedSegments: number;
}

export interface WordSegmentation {
  segments: TrimRange[];
  detectedSegments: number;
  matchesExpected: boolean;
}

interface SampleRange {
  start: number;
  end: number;
}

const FRAME_SECONDS = 0.01;
const MERGE_GAP_SECONDS = 0.2;
const MIN_SPEECH_SECONDS = 0.08;
const EDGE_PADDING_SECONDS = 0.035;

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * fraction))
  );
  return sorted[index] ?? 0;
}

function chooseSegment(
  segments: readonly SampleRange[],
  targetSegment: TargetSegment
): SampleRange | null {
  if (segments.length === 0) return null;
  if (targetSegment === "first") return segments[0] ?? null;
  if (targetSegment === "last") return segments.at(-1) ?? null;
  if (targetSegment === "middle") {
    return segments[Math.floor(segments.length / 2)] ?? null;
  }
  return segments.reduce((longest, segment) =>
    segment.end - segment.start > longest.end - longest.start
      ? segment
      : longest
  );
}

/**
 * Find speech islands by frame energy. Short internal gaps stay joined so a
 * two-word name such as "Sigma dash" remains one island.
 */
function findSpeechSegments(
  samples: Float32Array,
  sampleRate: number
): SampleRange[] {
  if (samples.length === 0 || sampleRate <= 0) return [];

  const frameSize = Math.max(1, Math.round(sampleRate * FRAME_SECONDS));
  const energies: number[] = [];
  for (let start = 0; start < samples.length; start += frameSize) {
    const end = Math.min(samples.length, start + frameSize);
    let sumSquares = 0;
    for (let index = start; index < end; index++) {
      const sample = samples[index] ?? 0;
      sumSquares += sample * sample;
    }
    energies.push(Math.sqrt(sumSquares / Math.max(1, end - start)));
  }

  const peak = Math.max(...energies);
  const noiseFloor = percentile(energies, 0.2);
  const threshold = Math.max(0.0015, noiseFloor * 3.2, peak * 0.055);
  const activeFrames = energies.map((energy) => energy >= threshold);

  const rawSegments: SampleRange[] = [];
  let activeStart = -1;
  for (let frame = 0; frame <= activeFrames.length; frame++) {
    const active = activeFrames[frame] ?? false;
    if (active && activeStart < 0) activeStart = frame;
    if (!active && activeStart >= 0) {
      rawSegments.push({
        start: activeStart * frameSize,
        end: Math.min(samples.length, frame * frameSize),
      });
      activeStart = -1;
    }
  }

  const mergeGap = Math.round(sampleRate * MERGE_GAP_SECONDS);
  const minSpeech = Math.round(sampleRate * MIN_SPEECH_SECONDS);
  const merged: SampleRange[] = [];
  for (const segment of rawSegments) {
    const previous = merged.at(-1);
    if (previous && segment.start - previous.end <= mergeGap) {
      previous.end = segment.end;
    } else {
      merged.push({ ...segment });
    }
  }

  return merged.filter((segment) => segment.end - segment.start >= minSpeech);
}

/**
 * Find speech islands in a carrier phrase and select the island containing the
 * requested target. Short internal gaps stay joined so names such as
 * "Sigma dash" remain one editable region.
 */
export function suggestPronunciationTrim(
  samples: Float32Array,
  sampleRate: number,
  targetSegment: TargetSegment
): TrimSuggestion {
  const duration = samples.length / sampleRate;
  if (samples.length === 0 || sampleRate <= 0) {
    return {
      startSeconds: 0,
      endSeconds: Math.max(0, duration),
      confidence: "review",
      detectedSegments: 0,
    };
  }

  const speechSegments = findSpeechSegments(samples, sampleRate);
  const selected = chooseSegment(speechSegments, targetSegment);
  if (!selected) {
    return {
      startSeconds: 0,
      endSeconds: duration,
      confidence: "review",
      detectedSegments: 0,
    };
  }

  const padding = Math.round(sampleRate * EDGE_PADDING_SECONDS);
  const expectedSegments = targetSegment === "only" ? 1 : 3;
  return {
    startSeconds: Math.max(0, selected.start - padding) / sampleRate,
    endSeconds: Math.min(samples.length, selected.end + padding) / sampleRate,
    confidence:
      speechSegments.length === expectedSegments ? "strong" : "review",
    detectedSegments: speechSegments.length,
  };
}

/**
 * Split one spoken word into one range per letter. Edge padding matches the
 * single-take trimmer, so ranges of adjacent letters may overlap slightly;
 * that overlap preserves the natural release of the preceding letter.
 */
export function segmentWordByEnergy(
  samples: Float32Array,
  sampleRate: number,
  expectedSegments: number
): WordSegmentation {
  const found = findSpeechSegments(samples, sampleRate);
  const padding = Math.round(sampleRate * EDGE_PADDING_SECONDS);

  const segments = found.map((segment) => ({
    startSeconds: Math.max(0, segment.start - padding) / sampleRate,
    endSeconds: Math.min(samples.length, segment.end + padding) / sampleRate,
  }));

  return {
    segments,
    detectedSegments: segments.length,
    matchesExpected: segments.length === expectedSegments,
  };
}
