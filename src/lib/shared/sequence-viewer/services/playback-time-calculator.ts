/**
 * Utility for converting between playback steps and time.
 */

export function stepToTimeMs(step: number, bpm: number): number {
  const msPerBeat = 60000 / bpm;
  return Math.round(step * msPerBeat);
}

export function timeMsToStep(timeMs: number, bpm: number): number {
  const msPerBeat = 60000 / bpm;
  return timeMs / msPerBeat;
}

export function bpmToSpeed(bpm: number): number {
  return bpm / 60;
}

export function speedToBpm(speed: number): number {
  return Math.round(speed * 60);
}
