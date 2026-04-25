export interface UnifiedPlaybackContext {
	readonly overallProgress: number;
	readonly currentBeat: number;
	readonly totalBeats: number;
	readonly isPlaying: boolean;
	readonly isLooping: boolean | undefined;
	readonly duration: number;
	readonly elapsed: number;

	seek(progress: number): void;
	togglePlay(): void;
	toggleLoop(): void;
}
