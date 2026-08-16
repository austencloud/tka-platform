/**
 * Step Map Utilities
 *
 * Pure functions for working with step-to-timestamp mappings.
 * Used to sync video playback position with sequence notation highlights.
 */

/**
 * Given a video's current playback time and a step map,
 * returns the 0-based index of the current step.
 * Returns -1 if before the first step (start position).
 */
export function getHighlightedBeatFromVideo(
  currentTime: number,
  beatTimestamps: number[]
): number {
  // Walk backwards from the last step to find the most recent one
  // that has already started at the current playback time
  for (let i = beatTimestamps.length - 1; i >= 0; i--) {
    if (currentTime >= beatTimestamps[i]!) return i;
  }
  return -1;
}

/**
 * Generate evenly-spaced step timestamps across a video, seeded from BPM.
 * Used as a starting point for manual step mapping - the user can then nudge
 * individual timestamps to match the actual performance.
 *
 * BPM describes the sequence's own tempo, not the video's. When the BPM run
 * would overrun the clip, or leaves most of it unused (a 16-step run at 120 BPM
 * is 8 seconds - meaningless in a 60-second clip), the markers spread across
 * the clip instead so every one of them lands somewhere the user can reach.
 */
export function generateEvenBeatTimestamps(
  videoDuration: number,
  stepCount: number,
  bpm: number,
  startOffset: number = 0
): number[] {
  if (stepCount <= 0) return [];

  const usable = Math.max(0, videoDuration - startOffset);
  const bpmInterval = bpm > 0 ? 60 / bpm : 0;
  const bpmSpan = stepCount * bpmInterval;
  const spreadInterval = usable / stepCount;

  const interval =
    usable > 0 && (bpmSpan > usable || bpmSpan < usable * 0.6)
      ? spreadInterval
      : bpmInterval;

  const timestamps: number[] = [];
  for (let i = 0; i < stepCount; i++) {
    timestamps.push(
      Math.min(startOffset + i * interval, Math.max(0, videoDuration - 0.01))
    );
  }
  return timestamps;
}
