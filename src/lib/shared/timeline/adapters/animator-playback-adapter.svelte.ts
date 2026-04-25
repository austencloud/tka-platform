import type { UnifiedPlaybackContext } from "../unified-playback-context";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

// ── Pure computation functions (exported for testing) ──────────────────

export function computeOverallProgress(
  currentStep: number,
  totalSteps: number,
): number {
  if (totalSteps <= 0) return 0;
  if (currentStep < 1) return 0;
  return Math.min(1, (currentStep - 1) / totalSteps);
}

export function computeCurrentBeat(currentStep: number): number {
  if (currentStep < 1) return 0;
  return Math.floor(currentStep);
}

export function computeElapsed(
  currentStep: number,
  durations: number[],
): number {
  if (currentStep < 1 || durations.length === 0) return 0;
  const beatIndex = Math.floor(currentStep) - 1;
  const frac = currentStep - Math.floor(currentStep);
  let elapsed = 0;
  for (let i = 0; i < Math.min(beatIndex, durations.length); i++) {
    elapsed += durations[i]!;
  }
  if (beatIndex < durations.length) {
    elapsed += frac * durations[beatIndex]!;
  }
  return elapsed;
}

export function computeSeekTarget(progress: number, totalSteps: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  return 1 + clamped * totalSteps;
}

// ── Adapter factory ────────────────────────────────────────────────────

export interface AnimatorPlaybackParams {
  getCurrentStep: () => number;
  getSteps: () => readonly StepData[];
  getIsPlaying: () => boolean;
  onSeek: (targetStep: number) => void;
  onTogglePlay: () => void;
}

export function createAnimatorPlaybackAdapter(
  params: AnimatorPlaybackParams,
): UnifiedPlaybackContext {
  return {
    get overallProgress() {
      return computeOverallProgress(
        params.getCurrentStep(),
        params.getSteps().length,
      );
    },
    get currentBeat() {
      return computeCurrentBeat(params.getCurrentStep());
    },
    get totalBeats() {
      return params.getSteps().length;
    },
    get isPlaying() {
      return params.getIsPlaying();
    },
    get isLooping() {
      return undefined;
    },
    get duration() {
      const steps = params.getSteps();
      return steps.reduce((sum, s) => sum + (s.duration ?? 1), 0);
    },
    get elapsed() {
      const steps = params.getSteps();
      const durations = steps.map((s) => s.duration ?? 1);
      return computeElapsed(params.getCurrentStep(), durations);
    },
    seek(progress: number) {
      const target = computeSeekTarget(progress, params.getSteps().length);
      params.onSeek(target);
    },
    togglePlay() {
      params.onTogglePlay();
    },
    toggleLoop() {
      // 2D engine doesn't expose loop toggle yet — no-op
    },
  };
}
