
const FFT_SIZE = 128; // 64 frequency bins (fftSize / 2)

/**
 * Real-time audio frequency analyzer using the Web Audio API.
 *
 * Creates an AudioContext and AnalyserNode from the provided MediaStream
 * (the same stream used by MediaRecorder for recording). This gives
 * accurate waveform visualization driven by actual microphone data.
 */
export class AudioAnalyzer {
	private audioContext: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private sourceNode: MediaStreamAudioSourceNode | null = null;
	private frequencyData: Uint8Array<ArrayBuffer> = new Uint8Array(
		FFT_SIZE / 2,
	);
	private isActive = false;

	get active(): boolean {
		return this.isActive;
	}

	startWithStream(stream: MediaStream): void {
		// Clean up any previous session
		this.stop();

		const audioContext = new AudioContext();
		const analyser = audioContext.createAnalyser();
		analyser.fftSize = FFT_SIZE;
		analyser.smoothingTimeConstant = 0.6;

		const source = audioContext.createMediaStreamSource(stream);
		source.connect(analyser);
		// Don't connect analyser to destination - we only want to read data,
		// not play the mic audio through speakers

		this.audioContext = audioContext;
		this.analyser = analyser;
		this.sourceNode = source;
		this.frequencyData = new Uint8Array(analyser.frequencyBinCount);
		this.isActive = true;
	}

	stop(): void {
		this.isActive = false;

		if (this.sourceNode) {
			this.sourceNode.disconnect();
			this.sourceNode = null;
		}

		if (this.analyser) {
			this.analyser.disconnect();
			this.analyser = null;
		}

		if (this.audioContext) {
			this.audioContext.close().catch(() => {
				// AudioContext.close() can throw if already closed
			});
			this.audioContext = null;
		}

		this.frequencyData.fill(0);
	}

	getFrequencyData(): Uint8Array<ArrayBuffer> {
		if (!this.isActive || !this.analyser) {
			this.frequencyData.fill(0);
			return this.frequencyData;
		}

		this.analyser.getByteFrequencyData(this.frequencyData);
		return this.frequencyData;
	}
}
