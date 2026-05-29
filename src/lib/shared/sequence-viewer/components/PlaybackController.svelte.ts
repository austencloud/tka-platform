/**
 * PlaybackController.svelte.ts
 *
 * Reactive module that owns all playback state and logic:
 * - Play/pause toggle, BPM changes, mode switching
 * - Step clicks, half/full beat stepping, restart
 * - isPlayingLocal, currentStepLocal, bpmLocal, playback modes, arrivedViaStepping
 * - Practice training system: TempoPracticeOrchestrator, practiceState, BPM escalation
 *
 * Extracted from SequenceViewerOrchestrator.
 */

import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/implementations/AnimationPlaybackController";
import type { AnimationPanelState, AnimationStateKey, PlaybackMode } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { lanSyncState } from "$lib/shared/lan-sync/state/lan-sync-state.svelte";
import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
import { TempoPracticeOrchestrator } from "$lib/shared/sequence-viewer/services/implementations/TempoPracticeOrchestrator";
import { createTempoPracticeState } from "$lib/shared/sequence-viewer/state/tempo-practice-state.svelte";

export interface PlaybackControllerDeps {
  modalAnimationState: AnimationPanelState;
  initialBpm: number;
  initialStep: number;
}

export function createPlaybackController(deps: PlaybackControllerDeps) {
  const { modalAnimationState } = deps;

  // ── Reactive state ──
  let isPlayingLocal = $state(false);
  let currentStepLocal = $state(deps.initialStep);
  let bpmLocal = $state(deps.initialBpm);
  let arrivedViaStepping = $state(false);

  // External dependencies (set by orchestrator after service load)
  let _playbackController: AnimationPlaybackController | null = null;
  let _hapticService: HapticFeedback | null = null;
  let _onUrlParamChange: ((key: string, value: string) => void) | undefined;
  let _isAnimationVisible: (() => boolean) | null = null;

  // ── Animation state subscription ──
  let lastStepNumber = 0;

  const cleanupSubscription = modalAnimationState.subscribe(
    (key: AnimationStateKey, value: unknown) => {
      switch (key) {
        case "isPlaying":
          isPlayingLocal = value as boolean;
          lanSyncState.updatePlayback({ isPlaying: value as boolean });
          break;
        case "currentStep": {
          const rawStep = value as number;
          const newBeat = Math.floor(rawStep);
          if (isPlayingLocal && newBeat !== lastStepNumber && newBeat >= 1 && (_isAnimationVisible?.() !== false)) {
            _hapticService?.trigger("selection");
          }
          lastStepNumber = newBeat;
          currentStepLocal = rawStep;
          lanSyncState.updatePlayback({ currentStep: rawStep });
          break;
        }
        case "speed":
          bpmLocal = Math.round((value as number) * 60);
          lanSyncState.updatePlayback({ speed: value as number });
          break;
      }
    }
  );

  // ── Playback mode sync from visibility manager ──
  const animationVisibility = getAnimationVisibilityManager();
  let visibilityObserver: (() => void) | undefined;

  function registerVisibilityObserver() {
    const visObs = () => {
      const newMode = animationVisibility.getPlaybackMode();
      if (modalAnimationState.playbackMode !== newMode) {
        const wasPlaying = modalAnimationState.isPlaying;
        if (wasPlaying && _playbackController) {
          _playbackController.togglePlayback();
        }
        modalAnimationState.setPlaybackMode(newMode);
        if (wasPlaying && _playbackController) {
          _playbackController.togglePlayback();
        }
      }
    };
    animationVisibility.registerObserver(visObs);
    visibilityObserver = visObs;
  }

  function unregisterVisibilityObserver() {
    if (visibilityObserver) {
      animationVisibility.unregisterObserver(visibilityObserver);
    }
  }

  // ── Practice training ──
  const practiceOrchestrator = new TempoPracticeOrchestrator();
  const practiceState = createTempoPracticeState();

  // ── Scrub gesture ──
  let wasPlayingBeforeScrub = false;

  // ── Handlers ──

  function handlePlaybackToggle() {
    arrivedViaStepping = false;
    _playbackController?.togglePlayback();
  }

  function handleProgressBarSeek(targetStep: number) {
    arrivedViaStepping = false;
    modalAnimationState.setCurrentStep(targetStep);
    _playbackController?.seekToStep(targetStep);
  }

  function handleProgressBarScrubStart() {
    wasPlayingBeforeScrub = isPlayingLocal;
    if (wasPlayingBeforeScrub) _playbackController?.togglePlayback();
  }

  function handleProgressBarScrubEnd() {
    if (wasPlayingBeforeScrub) _playbackController?.togglePlayback();
    wasPlayingBeforeScrub = false;
  }

  function handleBpmChange(newBpm: number) {
    _hapticService?.trigger("selection");
    const speedMultiplier = newBpm / 60;
    _playbackController?.setSpeed(speedMultiplier);
    _onUrlParamChange?.("bpm", String(newBpm));
    if (practiceOrchestrator.isActive()) {
      practiceOrchestrator.adjustBpm(newBpm);
      practiceState.updateProgress(practiceOrchestrator.getProgress());
    }
  }

  function handlePlaybackModeChange(mode: PlaybackMode) {
    const wasPlaying = isPlayingLocal;
    if (wasPlaying && _playbackController) {
      _playbackController.togglePlayback();
    }
    modalAnimationState.setPlaybackMode(mode);
    animationVisibility.setPlaybackMode(mode);
    if (wasPlaying && _playbackController) {
      setTimeout(() => _playbackController?.togglePlayback(), 0);
    }
  }

  function handleStepClick(stepIndex: number, blockClicks: boolean, editingPane: string | null) {
    if (blockClicks) return;
    if (editingPane !== 'image' || isPlayingLocal) return;

    if (_playbackController) {
      _hapticService?.trigger("selection");
      const targetStep = stepIndex + 1;
      arrivedViaStepping = false;
      modalAnimationState.setCurrentStep(targetStep);
      _playbackController.seekToStep(targetStep);
    }
  }

  function handlePracticeStart(sequence: SequenceData | null) {
    if (!_playbackController) {
      showToast("Animation not ready yet. Wait for it to load.", "info");
      return;
    }

    _hapticService?.trigger("selection");
    practiceState.clearCompletion();

    const startBpm = practiceOrchestrator.start(practiceState.userConfig);
    practiceState.updateProgress(practiceOrchestrator.getProgress());

    handleBpmChange(startBpm);

    _playbackController.onLoopComplete(() => {
      const newBpm = practiceOrchestrator.onLoopComplete();
      practiceState.updateProgress(practiceOrchestrator.getProgress());

      if (newBpm !== null) {
        handleBpmChange(newBpm);
        _hapticService?.trigger("selection");
      }

      if (!practiceOrchestrator.isActive()) {
        handlePracticeStop(sequence);
      }
    });

    modalAnimationState.setShouldLoop(true);
    if (!isPlayingLocal) {
      _playbackController.togglePlayback();
    }
  }

  function handlePracticeStop(sequence: SequenceData | null) {
    if (!_playbackController) return;

    const finalBpm = practiceOrchestrator.stop();
    practiceState.updateProgress(practiceOrchestrator.getProgress());

    _playbackController.offLoopComplete();

    const seqId = sequence?.id || sequence?.word || "unknown";
    practiceState.recordPersonalBest(seqId, finalBpm);

    practiceState.showCompletion(finalBpm);
    _hapticService?.trigger("success");

    const personalBest = practiceState.getPersonalBest(seqId);
    const isNewBest = personalBest !== null && finalBpm >= personalBest;
    const message = isNewBest
      ? `Practice complete: ${finalBpm} BPM (new best!)`
      : `Practice complete: ${finalBpm} BPM`;
    showToast(message, "success");
  }

  // ── Stepping ──
  function stepHalfBeatBackward() { arrivedViaStepping = true; _playbackController?.stepHalfBeatBackward(); }
  function stepHalfBeatForward() { arrivedViaStepping = true; _playbackController?.stepHalfBeatForward(); }
  function stepFullBeatBackward() { arrivedViaStepping = true; _playbackController?.stepFullBeatBackward(); }
  function stepFullBeatForward() { arrivedViaStepping = true; _playbackController?.stepFullBeatForward(); }
  function restartToStart() { arrivedViaStepping = true; _playbackController?.seekToStep(0); }

  // ── Practice cleanup ──
  function stopPracticeIfActive() {
    if (practiceOrchestrator.isActive()) {
      practiceOrchestrator.stop();
      _playbackController?.offLoopComplete();
      practiceState.updateProgress(practiceOrchestrator.getProgress());
    }
  }

  function dispose() {
    stopPracticeIfActive();
    cleanupSubscription?.();
    unregisterVisibilityObserver();
    if (_playbackController) {
      _playbackController.dispose();
    }
  }

  return {
    // Reactive state (read via getters for reactivity)
    get isPlayingLocal() { return isPlayingLocal; },
    set isPlayingLocal(v: boolean) { isPlayingLocal = v; },
    get currentStepLocal() { return currentStepLocal; },
    set currentStepLocal(v: number) { currentStepLocal = v; },
    get bpmLocal() { return bpmLocal; },
    set bpmLocal(v: number) { bpmLocal = v; },
    get arrivedViaStepping() { return arrivedViaStepping; },
    set arrivedViaStepping(v: boolean) { arrivedViaStepping = v; },
    get practiceActive() { return practiceState.progress.active; },
    practiceState,

    // Dependency injection (set after service load)
    setPlaybackController(pc: AnimationPlaybackController) { _playbackController = pc; },
    getPlaybackController() { return _playbackController; },
    setHapticService(hs: HapticFeedback) { _hapticService = hs; },
    setAnimationVisible(fn: () => boolean) { _isAnimationVisible = fn; },
    setOnUrlParamChange(cb: ((key: string, value: string) => void) | undefined) { _onUrlParamChange = cb; },

    // Handlers
    handlePlaybackToggle,
    handleProgressBarSeek,
    handleProgressBarScrubStart,
    handleProgressBarScrubEnd,
    handleBpmChange,
    handlePlaybackModeChange,
    handleStepClick,
    handlePracticeStart,
    handlePracticeStop,
    stepHalfBeatBackward,
    stepHalfBeatForward,
    stepFullBeatBackward,
    stepFullBeatForward,
    restartToStart,
    stopPracticeIfActive,
    registerVisibilityObserver,
    dispose,
  };
}

export type PlaybackControllerState = ReturnType<typeof createPlaybackController>;
