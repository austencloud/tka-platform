/**
 * Utility for converting between playback steps and time.
 */
export class PlaybackTimeCalculator {
  stepToTimeMs(step: number, bpm: number): number {
    const msPerBeat = 60000 / bpm;
    return Math.round(step * msPerBeat);
  }

  timeMsToStep(timeMs: number, bpm: number): number {
    const msPerBeat = 60000 / bpm;
    return timeMs / msPerBeat;
  }

  bpmToSpeed(bpm: number): number {
    return bpm / 60;
  }

  speedToBpm(speed: number): number {
    return Math.round(speed * 60);
  }
}

// Singleton instance for direct import
export const playbackTimeCalculator = new PlaybackTimeCalculator();
