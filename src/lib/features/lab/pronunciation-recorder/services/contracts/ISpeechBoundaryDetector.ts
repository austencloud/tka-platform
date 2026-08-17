export interface SpeechSpan {
  /** Seconds on the capture clock. */
  startSeconds: number;
  endSeconds: number;
}

export interface SpeechBoundaryHandlers {
  onSpeechStart(): void;
  /** One utterance finished: `redemptionMs` of non-speech has held. */
  onSpeechEnd(span: SpeechSpan): void;
}

export interface SpeechBoundaryStart {
  stream: MediaStream;
  /**
   * The capture's context, so both halves of the pipe share one audio graph.
   *
   * A detector that builds its own gets a second context on the same
   * microphone, and a context nobody resumes is silent while the meter driven
   * by the other one moves normally — a session that looks like it is listening
   * and hears nothing.
   */
  context: AudioContext | null;
  handlers: SpeechBoundaryHandlers;
  /**
   * Must read the capture's clock, not the page's.
   *
   * The spans this reports are cut out of the ring by absolute sample index,
   * and the ring counts from zero at `capture.start()`. Timing them against
   * `performance.now()` — seconds since the page loaded — asks the ring for
   * samples minutes past anything it holds, and every read comes back null.
   */
  clockSeconds(): number;
}

export interface ISpeechBoundaryDetector {
  /** Rejects when the detector cannot listen, rather than failing silently. */
  start(options: SpeechBoundaryStart): Promise<void>;
  stop(): Promise<void>;
}
