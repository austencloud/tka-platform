/** The scene fields the timeline needs, structural so tests need no fixture. */
export interface TimelineScene {
  id: string;
  title: string;
  startSeconds: number;
  durationSeconds: number;
}

export interface TimelineSegment extends TimelineScene {
  /** Position in `film.scenes`, which is what selectScene takes. */
  index: number;
  /** Distance from the track's left edge, 0..1. */
  offset: number;
  /** Share of the track, 0..1. */
  width: number;
}

export function buildTimelineSegments(
  scenes: readonly TimelineScene[],
  filmDurationSeconds: number
): TimelineSegment[] {
  if (filmDurationSeconds <= 0) return [];
  return scenes.map((scene, index) => ({
    ...scene,
    index,
    offset: scene.startSeconds / filmDurationSeconds,
    width: scene.durationSeconds / filmDurationSeconds,
  }));
}

/** Track position to film time. Clamped: a captured pointer keeps reporting
 *  past the element's edges. */
export function secondsAtFraction(
  fraction: number,
  filmDurationSeconds: number
): number {
  return Math.max(0, Math.min(1, fraction)) * filmDurationSeconds;
}

export function fractionAtSeconds(
  seconds: number,
  filmDurationSeconds: number
): number {
  if (filmDurationSeconds <= 0) return 0;
  return Math.max(0, Math.min(1, seconds / filmDurationSeconds));
}
