import type { EffortId, EffortParams } from "$lib/features/effort-lab/domain/effort-types";

export interface EffortPhrase {
  readonly id: string;
  readonly effortId: EffortId;
  readonly startBeat: number;  // 1-based, inclusive
  readonly endBeat: number;    // inclusive
  readonly params?: EffortParams;
}

export interface EffortTimeline {
  readonly phrases: readonly EffortPhrase[];  // sorted by startBeat, no overlaps
  readonly transition: "hard" | "blend";
  readonly blendBeats?: number;  // crossfade duration in beats (only if blend)
}

export function createEffortPhrase(
  effortId: EffortId,
  startBeat: number,
  endBeat: number,
  params?: EffortParams,
): EffortPhrase {
  return {
    id: `phrase-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    effortId,
    startBeat,
    endBeat,
    params,
  };
}

export function createEffortTimeline(): EffortTimeline {
  return {
    phrases: [],
    transition: "hard",
  };
}

/**
 * Find the phrase covering a given beat, or null if the beat is in a gap.
 * Assumes phrases are sorted by startBeat and non-overlapping.
 */
export function findPhraseAtBeat(
  timeline: EffortTimeline,
  beat: number,
): EffortPhrase | null {
  for (const phrase of timeline.phrases) {
    // A phrase covering beats 3-6 owns the range [3.0, 7.0) —
    // it includes all fractional time within beat 6 up to (but not including) beat 7.
    if (beat >= phrase.startBeat && beat < phrase.endBeat + 1) {
      return phrase;
    }
    if (phrase.startBeat > beat) break;
  }
  return null;
}

/**
 * Insert a phrase into the timeline, removing/trimming any overlapping phrases.
 * Returns a new timeline (immutable).
 */
export function insertPhrase(
  timeline: EffortTimeline,
  newPhrase: EffortPhrase,
): EffortTimeline {
  const updated: EffortPhrase[] = [];

  for (const existing of timeline.phrases) {
    // Completely covered by new phrase — remove
    if (existing.startBeat >= newPhrase.startBeat && existing.endBeat <= newPhrase.endBeat) {
      continue;
    }
    // Split — existing phrase completely wraps new phrase (must check before partial overlaps)
    if (existing.startBeat < newPhrase.startBeat && existing.endBeat > newPhrase.endBeat) {
      updated.push({ ...existing, endBeat: newPhrase.startBeat - 1 });
      updated.push({
        ...existing,
        id: `phrase-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        startBeat: newPhrase.endBeat + 1,
      });
      continue;
    }
    // Overlaps left side — trim right
    if (existing.startBeat < newPhrase.startBeat && existing.endBeat >= newPhrase.startBeat) {
      updated.push({ ...existing, endBeat: newPhrase.startBeat - 1 });
      continue;
    }
    // Overlaps right side — trim left
    if (existing.startBeat <= newPhrase.endBeat && existing.endBeat > newPhrase.endBeat) {
      updated.push({ ...existing, startBeat: newPhrase.endBeat + 1 });
      continue;
    }
    // No overlap
    updated.push(existing);
  }

  updated.push(newPhrase);
  updated.sort((a, b) => a.startBeat - b.startBeat);

  return { ...timeline, phrases: updated };
}

/**
 * Remove a phrase by ID. Returns a new timeline.
 */
export function removePhrase(
  timeline: EffortTimeline,
  phraseId: string,
): EffortTimeline {
  return {
    ...timeline,
    phrases: timeline.phrases.filter((p) => p.id !== phraseId),
  };
}
