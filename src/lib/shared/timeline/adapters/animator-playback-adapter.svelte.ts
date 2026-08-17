import type { UnifiedPlaybackContext } from "../unified-playback-context";
import type { Step } from "@tka/tka-types";

// ── Pure computation functions (exported for testing) ──────────────────

export function computeOverallProgress(
  currentStep: number,
  durations: number[],
): number {
  if (durations.length === 0) return 0;
  if (currentStep < 1) return 0;
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  if (totalDuration <= 0) return 0;
  return Math.min(1, computeElapsed(currentStep, durations) / totalDuration);
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
  const stepNumber = Math.floor(currentStep) - 1;
  const frac = currentStep - Math.floor(currentStep);
  let elapsed = 0;
  for (let i = 0; i < Math.min(stepNumber, durations.length); i++) {
    elapsed += durations[i]!;
  }
  if (stepNumber < durations.length) {
    elapsed += frac * durations[stepNumber]!;
  }
  return elapsed;
}

export function computeSeekTarget(
  progress: number,
  durations: number[],
): number {
  if (durations.length === 0) return 1;
  const clamped = Math.max(0, Math.min(1, progress));
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  if (totalDuration <= 0) return 1;
  const targetElapsed = clamped * totalDuration;

  let accumulated = 0;
  for (let i = 0; i < durations.length; i++) {
    const beatDuration = durations[i]!;
    if (accumulated + beatDuration >= targetElapsed) {
      const frac =
        beatDuration > 0 ? (targetElapsed - accumulated) / beatDuration : 0;
      return 1 + i + frac;
    }
    accumulated += beatDuration;
  }
  return 1 + durations.length;
}

export function computeBeatMarkerPositions(durations: number[]): number[] {
  if (durations.length <= 1) return [];
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  if (totalDuration <= 0) return [];

  const positions: number[] = [];
  let cumulative = 0;
  for (let i = 0; i < durations.length - 1; i++) {
    cumulative += durations[i]!;
    positions.push(cumulative / totalDuration);
  }
  return positions;
}

// ── Adapter factory ────────────────────────────────────────────────────

export interface AnimatorPlaybackParams {
  getCurrentStep: () => number;
  getSteps: () => readonly Step[];
  getIsPlaying: () => boolean;
  onSeek: (targetStep: number) => void;
  onTogglePlay: () => void;
  /**
   * Tempo and continuous/step, when the host owns them. UnifiedTimeline shows
   * each control only when its getter AND its callback are both present, so a
   * host that passes neither gets the bare scrubber it got before — which is
   * what the 3D canvas has always done through its own adapter.
   */
  getBpm?: () => number | undefined;
  onBpmChange?: (bpm: number) => void;
  getPlaybackMode?: () => "continuous" | "step";
  onPlaybackModeChange?: (mode: "continuous" | "step") => void;
}

function getDurations(steps: readonly Step[]): number[] {
  return steps.map((s) => s.duration ?? 1);
}

export function createAnimatorPlaybackAdapter(
  params: AnimatorPlaybackParams,
): UnifiedPlaybackContext {
  return {
    get overallProgress() {
      return computeOverallProgress(
        params.getCurrentStep(),
        getDurations(params.getSteps()),
      );
    },
    get currentStep() {
      return computeCurrentBeat(params.getCurrentStep());
    },
    get totalSteps() {
      return params.getSteps().length;
    },
    get isPlaying() {
      return params.getIsPlaying();
    },
    get isLooping() {
      return undefined;
    },
    get duration() {
      return getDurations(params.getSteps()).reduce((sum, d) => sum + d, 0);
    },
    get elapsed() {
      return computeElapsed(
        params.getCurrentStep(),
        getDurations(params.getSteps()),
      );
    },
    get beatMarkerPositions() {
      return computeBeatMarkerPositions(getDurations(params.getSteps()));
    },
    get bpm() {
      return params.getBpm?.();
    },
    get playbackMode() {
      return params.getPlaybackMode?.();
    },
    // Presence is the signal UnifiedTimeline reads to decide whether to render
    // the control at all, so a host that wired no callback must leave the key
    // genuinely absent rather than holding an undefined-returning wrapper.
    ...(params.onBpmChange
      ? { onBpmChange: (bpm: number) => params.onBpmChange!(bpm) }
      : {}),
    ...(params.onPlaybackModeChange
      ? {
          onPlaybackModeChange: (mode: "continuous" | "step") =>
            params.onPlaybackModeChange!(mode),
        }
      : {}),
    seek(progress: number) {
      const target = computeSeekTarget(
        progress,
        getDurations(params.getSteps()),
      );
      params.onSeek(target);
    },
    togglePlay() {
      params.onTogglePlay();
    },
    toggleLoop() {},
  };
}
