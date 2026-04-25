export interface UnifiedPlaybackContext {
	readonly overallProgress: number;
	readonly currentStep: number;
	readonly totalSteps: number;
	readonly isPlaying: boolean;
	readonly isLooping: boolean | undefined;
	readonly duration: number;
	readonly elapsed: number;

	seek(progress: number): void;
	togglePlay(): void;
	toggleLoop(): void;
}
