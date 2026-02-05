/**
 * Provides real-time frequency data for waveform visualization during
 * voice recording. Uses Web Audio API with a real AnalyserNode fed
 * from the microphone's MediaStream.
 */
export interface IAudioAnalyzer {
	/** Start analyzing audio from the given microphone stream. */
	startWithStream(stream: MediaStream): void;

	/** Stop analyzing and release audio resources. */
	stop(): void;

	/** Get current frequency amplitude data (0-255 per bin). */
	getFrequencyData(): Uint8Array<ArrayBuffer>;

	/** Whether the analyzer is currently active. */
	readonly active: boolean;
}
