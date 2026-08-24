import type {
  UnifiedPlaybackContext,
  PlaybackMode,
} from "../unified-playback-context";

// ── Pure computation functions (exported for testing) ──────────────────

export function computeOverallProgress3D(
  currentStepIndex: number,
  beatProgress: number,
  totalSteps: number
): number {
  if (totalSteps <= 0) return 0;
  return (currentStepIndex + beatProgress) / totalSteps;
}

export function computeSeek3D(
  progress: number,
  totalSteps: number
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

// ── Orchestrator bridge (optional) ────────────────────────────────────
// When provided, seek/play/pause route through the parent orchestrator
// so the useTask frame loop in Viewer3DScene reads the correct
// currentStep prop instead of fighting the adapter.

export interface OrchestratorCallbacks {
  onPlaybackToggle: () => void;
  onProgressBarSeek: (targetStep: number) => void;
  getIsPlaying: () => boolean;
  /** Sequence-owned fallback while the first 3D avatar is still hydrating. */
  getCurrentStep?: () => number;
  getTotalSteps?: () => number;
}

export interface TempoCallbacks {
  getBpm: () => number;
  onBpmChange: (bpm: number) => void;
  getPlaybackMode: () => PlaybackMode;
  onPlaybackModeChange: (mode: PlaybackMode) => void;
}

// ── Adapter factory ────────────────────────────────────────────────────

export function createAvatarPlaybackAdapter(
  getAvatar: () => AvatarPlaybackHandle | null,
  orchestrator?: OrchestratorCallbacks,
  tempo?: TempoCallbacks
): UnifiedPlaybackContext {
  function totalSteps(): number {
    const avatarSteps = getAvatar()?.totalSteps ?? 0;
    return avatarSteps > 0
      ? avatarSteps
      : (orchestrator?.getTotalSteps?.() ?? 0);
  }

  function currentStep(): number {
    const avatar = getAvatar();
    return avatar && avatar.totalSteps > 0
      ? avatar.currentStepIndex + avatar.progress
      : (orchestrator?.getCurrentStep?.() ?? 0);
  }

  return {
    get overallProgress() {
      const av = getAvatar();
      const steps = totalSteps();
      if (steps <= 0) return 0;
      if (!av || av.totalSteps <= 0) return currentStep() / steps;
      return computeOverallProgress3D(
        av.currentStepIndex,
        av.progress,
        av.totalSteps
      );
    },
    get currentStep() {
      return totalSteps() > 0 ? Math.floor(currentStep()) + 1 : 0;
    },
    get totalSteps() {
      return totalSteps();
    },
    get isPlaying() {
      if (orchestrator) return orchestrator.getIsPlaying();
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
    get beatMarkerPositions() {
      const steps = totalSteps();
      if (steps <= 1) return [];
      return Array.from({ length: steps - 1 }, (_, i) => (i + 1) / steps);
    },
    get bpm() {
      return tempo?.getBpm();
    },
    get playbackMode() {
      return tempo?.getPlaybackMode();
    },
    onBpmChange: tempo?.onBpmChange,
    onPlaybackModeChange: tempo?.onPlaybackModeChange,
    seek(progress: number) {
      const av = getAvatar();
      if (orchestrator) {
        const clamped = Math.max(0, Math.min(1, progress));
        orchestrator.onProgressBarSeek(clamped * totalSteps());
        return;
      }
      if (!av) return;
      const { stepIndex, stepProgress } = computeSeek3D(
        progress,
        av.totalSteps
      );
      av.goToStep(stepIndex);
      av.setProgress(stepProgress);
    },
    togglePlay() {
      if (orchestrator) {
        orchestrator.onPlaybackToggle();
        return;
      }
      getAvatar()?.togglePlay();
    },
    toggleLoop() {
      const av = getAvatar();
      if (av) av.loop = !av.loop;
    },
  };
}
