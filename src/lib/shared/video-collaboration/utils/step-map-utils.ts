/**
 * Beat Map Utilities
 *
 * Pure functions for working with beat-to-timestamp mappings.
 * Used to sync video playback position with sequence notation highlights.
 */

/**
 * Given a video's current playback time and a beat map,
 * returns the 0-based index of the current beat.
 * Returns -1 if before the first beat (start position).
 */
export function getHighlightedBeatFromVideo(
  currentTime: number,
  beatTimestamps: number[]
): number {
  // Walk backwards from the last beat to find the most recent one
  // that has already started at the current playback time
  for (let i = beatTimestamps.length - 1; i >= 0; i--) {
    if (currentTime >= beatTimestamps[i]!) return i;
  }
  return -1;
}

/**
 * Generate evenly-spaced beat timestamps based on BPM.
 * Used as a starting point for manual beat mapping — the user
 * can then nudge individual timestamps to match the actual performance.
 */
export function generateEvenBeatTimestamps(
  videoDuration: number,
  beatCount: number,
  bpm: number,
  startOffset: number = 0
): number[] {
  const beatInterval = 60 / bpm;
  const timestamps: number[] = [];

  for (let i = 0; i < beatCount; i++) {
    const timestamp = startOffset + i * beatInterval;

    if (timestamp < videoDuration) {
      timestamps.push(timestamp);
    } else {
      // If BPM-based spacing runs past the video end, distribute
      // the remaining beats evenly in whatever time is left
      const remaining = beatCount - i;
      const lastTimestamp = timestamps[timestamps.length - 1] ?? 0;
      const remainingDuration = videoDuration - lastTimestamp;
      const remainingInterval = remainingDuration / (remaining + 1);

      for (let j = 0; j < remaining; j++) {
        timestamps.push(
          (timestamps[timestamps.length - 1] ?? 0) + remainingInterval
        );
      }
      break;
    }
  }

  return timestamps;
}
