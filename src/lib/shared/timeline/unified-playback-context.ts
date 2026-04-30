export interface UnifiedPlaybackContext {
	readonly overallProgress: number;
	readonly currentStep: number;
	readonly totalSteps: number;
	readonly isPlaying: boolean;
	readonly isLooping: boolean | undefined;
	readonly duration: number;
	readonly elapsed: number;
	readonly beatMarkerPositions: readonly number[];

	seek(progress: number): void;
	togglePlay(): void;
	toggleLoop(): void;
}
