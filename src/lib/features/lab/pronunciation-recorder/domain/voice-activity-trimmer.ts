import type { TargetSegment } from "./recording-jobs";

export interface TrimRange {
  startSeconds: number;
  endSeconds: number;
}

export interface TrimSuggestion extends TrimRange {
  confidence: "strong" | "review";
  detectedSegments: number;
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

  let peak = 0;
  for (const energy of energies) if (energy > peak) peak = energy;
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
 * Turn a detected island into a playable range, padded on both sides so the
 * quiet attack and release either side of the detector's threshold survive.
 */
function toPaddedRange(
  segment: SampleRange,
  sampleRate: number,
  totalSamples: number
): TrimRange {
  const padding = Math.round(sampleRate * EDGE_PADDING_SECONDS);
  return {
    startSeconds: Math.max(0, segment.start - padding) / sampleRate,
    endSeconds: Math.min(totalSamples, segment.end + padding) / sampleRate,
  };
}

/**
 * Select the speech island the carrier phrase's target occupies, padded for
 * playback. Falls back to the whole take when nothing is found, so the
 * operator always has something to drag.
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

  const expectedSegments = targetSegment === "only" ? 1 : 3;
  return {
    ...toPaddedRange(selected, sampleRate, samples.length),
    confidence:
      speechSegments.length === expectedSegments ? "strong" : "review",
    detectedSegments: speechSegments.length,
  };
}

/**
 * Split one spoken word into one range per letter. Each range gets the same
 * edge padding as the single-take trimmer, because the detector only marks a
 * letter from the frame where it clears the noise threshold: the breathy
 * attack and the release either side of that sit below it and would be
 * clipped off. The padding cannot merge two letters together — islands only
 * survive as separate ranges when more than MERGE_GAP_SECONDS of quiet
 * divides them, so EDGE_PADDING_SECONDS a side still leaves well over 100 ms
 * of silence between neighbours. The audio of the transition between two
 * letters is therefore never captured in either range.
 */
export function segmentWordByEnergy(
  samples: Float32Array,
  sampleRate: number
): TrimRange[] {
  return findSpeechSegments(samples, sampleRate).map((segment) =>
    toPaddedRange(segment, sampleRate, samples.length)
  );
}
