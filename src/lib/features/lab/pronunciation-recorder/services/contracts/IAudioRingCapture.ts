export interface CapturedSpan {
  samples: Float32Array;
  sampleRate: number;
}

export interface IAudioRingCapture {
  readonly sampleRate: number;
  /** Absolute samples written since capture started — the session clock. */
  readonly clock: number;
  /** Current input level in dBFS, for the meter. */
  readonly levelDb: number;
  start(stream: MediaStream): Promise<void>;
  /** Samples between two absolute times in seconds, or null if not fully held. */
  readSeconds(fromSeconds: number, toSeconds: number): CapturedSpan | null;
  stop(): Promise<void>;
}
