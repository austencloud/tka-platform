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

export interface ISpeechBoundaryDetector {
  /**
   * `clockSeconds` must read the capture's clock, not the page's.
   *
   * The spans this reports are cut out of the ring by absolute sample index,
   * and the ring counts from zero at `capture.start()`. Timing them against
   * `performance.now()` — seconds since the page loaded — asks the ring for
   * samples minutes past anything it holds, and every read comes back null.
   */
  start(
    stream: MediaStream,
    handlers: SpeechBoundaryHandlers,
    clockSeconds: () => number
  ): Promise<void>;
  stop(): Promise<void>;
}
