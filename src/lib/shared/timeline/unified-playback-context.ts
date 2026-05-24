export type PlaybackMode = "continuous" | "step";

export interface UnifiedPlaybackContext {
	readonly overallProgress: number;
	readonly currentStep: number;
	readonly totalSteps: number;
	readonly isPlaying: boolean;
	readonly isLooping: boolean | undefined;
	readonly duration: number;
	readonly elapsed: number;
	readonly beatMarkerPositions: readonly number[];

	readonly bpm: number | undefined;
	readonly playbackMode: PlaybackMode | undefined;

	seek(progress: number): void;
	togglePlay(): void;
	toggleLoop(): void;
	onBpmChange?(bpm: number): void;
	onPlaybackModeChange?(mode: PlaybackMode): void;
}
