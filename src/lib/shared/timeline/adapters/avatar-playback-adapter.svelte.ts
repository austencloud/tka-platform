import type { UnifiedPlaybackContext } from "../unified-playback-context";

// ── Pure computation functions (exported for testing) ──────────────────

export function computeOverallProgress3D(
	currentStepIndex: number,
	beatProgress: number,
	totalSteps: number,
): number {
	if (totalSteps <= 0) return 0;
	return (currentStepIndex + beatProgress) / totalSteps;
}

export function computeSeek3D(
	progress: number,
	totalSteps: number,
): { stepIndex: number; stepProgress: number } {
	const clamped = Math.max(0, Math.min(1, progress));
	const raw = clamped * totalSteps;
	const stepIndex = Math.min(Math.floor(raw), totalSteps - 1);
	const stepProgress = raw - stepIndex;
	return { stepIndex, stepProgress };
}

// ── Avatar interface (subset of AvatarInstanceState we need) ──────────

export interface AvatarPlaybackHandle {
	readonly progress: number;
	readonly currentStepIndex: number;
	readonly totalSteps: number;
	readonly isPlaying: boolean;
	readonly speed: number;
	loop: boolean;
	togglePlay(): void;
	setProgress(value: number): void;
	goToStep(index: number): void;
}

// ── Adapter factory ────────────────────────────────────────────────────

export function createAvatarPlaybackAdapter(
	getAvatar: () => AvatarPlaybackHandle | null,
): UnifiedPlaybackContext {
	return {
		get overallProgress() {
			const av = getAvatar();
			if (!av) return 0;
			return computeOverallProgress3D(
				av.currentStepIndex,
				av.progress,
				av.totalSteps,
			);
		},
		get currentStep() {
			const av = getAvatar();
			if (!av) return 0;
			return av.currentStepIndex + 1;
		},
		get totalSteps() {
			return getAvatar()?.totalSteps ?? 0;
		},
		get isPlaying() {
			return getAvatar()?.isPlaying ?? false;
		},
		get isLooping() {
			return getAvatar()?.loop ?? false;
		},
		get duration() {
			const av = getAvatar();
			if (!av || av.speed <= 0) return 0;
			return 1 / av.speed;
		},
		get elapsed() {
			const av = getAvatar();
			if (!av || av.speed <= 0) return 0;
			const totalSec = 1 / av.speed;
			return totalSec * this.overallProgress;
		},
		seek(progress: number) {
			const av = getAvatar();
			if (!av) return;
			const { stepIndex, stepProgress } = computeSeek3D(progress, av.totalSteps);
			av.goToStep(stepIndex);
			av.setProgress(stepProgress);
		},
		togglePlay() {
			getAvatar()?.togglePlay();
		},
		toggleLoop() {
			const av = getAvatar();
			if (av) av.loop = !av.loop;
		},
	};
}
