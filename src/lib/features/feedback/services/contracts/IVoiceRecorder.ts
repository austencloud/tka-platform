/**
 * Records audio from the user's microphone via MediaRecorder.
 *
 * Returns the raw MediaStream on start so callers can feed it to an
 * AudioAnalyzer for real-time waveform visualization. On stop, returns
 * the recorded audio as a Blob ready for transcription.
 */
export interface VoiceRecordingResult {
	blob: Blob;
	mimeType: string;
	durationMs: number;
}

export interface IVoiceRecorder {
	/** Request mic access and begin recording. Returns the live MediaStream. */
	start(): Promise<MediaStream>;

	/** Stop recording and return the captured audio. */
	stop(): Promise<VoiceRecordingResult>;

	/** Cancel recording without producing a result. Releases the mic. */
	cancel(): void;

	/** Whether the recorder is currently capturing audio. */
	readonly isRecording: boolean;

	/** Milliseconds elapsed since recording started, or 0 if idle. */
	readonly elapsedMs: number;
}
