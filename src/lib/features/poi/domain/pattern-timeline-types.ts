/**
 * Pattern timeline — places StripPattern "clips" onto a beat grid so
 * different patterns play at different moments. A clip is a frozen
 * snapshot of a pattern (taken at paint time), so later edits to the
 * active pattern don't retroactively change already-placed clips.
 *
 * Mirrors the architecture of `effort-timeline-types.ts` from the
 * phrase-effort-lab so the two can graduate to a shared abstraction
 * later if the UX stabilizes.
 */

import type { StripPattern } from "./StripPattern";

export interface PatternClip {
  readonly id: string;
  /** 1-based, inclusive */
  readonly startBeat: number;
  /** Inclusive — a clip [3,5] covers the musical range [3.0, 6.0) */
  readonly endBeat: number;
  /** Snapshot of the pattern at the moment the clip was painted */
  readonly pattern: StripPattern;
  /** Preset the clip was painted from, for display/tooltip */
  readonly presetId?: string;
  /** Friendly label (preset name, image filename, etc.) */
  readonly label?: string;
}

export interface PatternTimeline {
  /** Sorted by startBeat, non-overlapping */
  readonly clips: readonly PatternClip[];
  /** Hard switch or crossfade blend between adjacent clips */
  readonly transition: "hard" | "blend";
  /** Crossfade duration in beats (only honored when transition === "blend") */
  readonly blendBeats?: number;
}

function makeClipId(): string {
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createPatternClip(
  startBeat: number,
  endBeat: number,
  pattern: StripPattern,
  presetId?: string,
  label?: string,
): PatternClip {
  return {
    id: makeClipId(),
    startBeat,
    endBeat,
    pattern,
    presetId,
    label,
  };
}

export function createEmptyPatternTimeline(): PatternTimeline {
  // Blend is the default because the whole point of the timeline is
  // smooth transitions between clips — a hard cut is the special-case
  // stylistic choice, not the baseline. 2-beat fade ≈ 1 second at
  // 120bpm, wide enough to actually see the crossfade. Users who want
  // hard cuts can flip the transition toggle in the lane controls.
  return { clips: [], transition: "blend", blendBeats: 2.0 };
}

/**
 * Find the clip covering a given fractional beat, or null if the beat
 * falls in a gap. Assumes clips are sorted and non-overlapping.
 *
 * A clip [3,5] is considered active for beats in [3.0, 6.0) — the clip
 * "owns" the full duration of its last beat.
 */
export function findClipAtBeat(
  timeline: PatternTimeline,
  beat: number,
): PatternClip | null {
  for (const clip of timeline.clips) {
    if (beat >= clip.startBeat && beat < clip.endBeat + 1) return clip;
    if (clip.startBeat > beat) break;
  }
  return null;
}

/**
 * Insert a clip into the timeline, trimming or removing any overlapping
 * clips to make room. Returns a new timeline (immutable).
 */
export function insertClip(
  timeline: PatternTimeline,
  newClip: PatternClip,
): PatternTimeline {
  const updated: PatternClip[] = [];

  for (const existing of timeline.clips) {
    // Completely covered by new clip — remove
    if (
      existing.startBeat >= newClip.startBeat &&
      existing.endBeat <= newClip.endBeat
    ) {
      continue;
    }
    // Existing wraps around new clip — split into two pieces
    if (
      existing.startBeat < newClip.startBeat &&
      existing.endBeat > newClip.endBeat
    ) {
      updated.push({ ...existing, endBeat: newClip.startBeat - 1 });
      updated.push({
        ...existing,
        id: makeClipId(),
        startBeat: newClip.endBeat + 1,
      });
      continue;
    }
    // Overlaps the left side of new clip — trim existing's right edge
    if (
      existing.startBeat < newClip.startBeat &&
      existing.endBeat >= newClip.startBeat
    ) {
      updated.push({ ...existing, endBeat: newClip.startBeat - 1 });
      continue;
    }
    // Overlaps the right side of new clip — trim existing's left edge
    if (
      existing.startBeat <= newClip.endBeat &&
      existing.endBeat > newClip.endBeat
    ) {
      updated.push({ ...existing, startBeat: newClip.endBeat + 1 });
      continue;
    }
    // No overlap
    updated.push(existing);
  }

  updated.push(newClip);
  updated.sort((a, b) => a.startBeat - b.startBeat);
  return { ...timeline, clips: updated };
}

export function removePatternClip(
  timeline: PatternTimeline,
  clipId: string,
): PatternTimeline {
  return {
    ...timeline,
    clips: timeline.clips.filter((c) => c.id !== clipId),
  };
}
