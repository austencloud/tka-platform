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
  start(stream: MediaStream, handlers: SpeechBoundaryHandlers): Promise<void>;
  stop(): Promise<void>;
}
