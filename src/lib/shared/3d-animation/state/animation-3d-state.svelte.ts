/**
 * Animation 3D State
 *
 * Composes playback state with motion configuration and prop state calculation.
 * Designed for sequence-based animation - load sequences from the library.
 */

import type { MotionConfig3D } from "../domain/models/MotionData3D";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { Plane } from "../domain/enums/Plane";
import { createPlaybackState } from "./playback-state.svelte";
import type { IPropStateInterpolator } from "../services/contracts/IPropStateInterpolator";
import type {
  ISequenceConverter,
  StepMotionConfigs,
} from "../services/contracts/ISequenceConverter";

/**
 * Dependencies for Animation 3D State
 */
export interface Animation3DStateDeps {
  propInterpolator: IPropStateInterpolator;
  sequenceConverter: ISequenceConverter;
}

/**
 * Create Animation 3D State
 */
export function createAnimation3DState(deps: Animation3DStateDeps) {
  const { propInterpolator, sequenceConverter } = deps;

  // Visibility - start hidden until a sequence is loaded
  let showBlue = $state(false);
  let showRed = $state(false);

  // Sequence mode state
  let loadedSequence = $state<SequenceData | null>(null);
  let stepConfigs = $state<StepMotionConfigs[]>([]);
  let currentStepIndex = $state(0);

  // Create playback first so we can reference it
  const playback = createPlaybackState({
    onCycleComplete: () => handleCycleComplete(),
  });

  /**
   * Update visibility based on a beat's motion configs
   */
  function updateVisibilityFromStep(beat: StepMotionConfigs | undefined) {
    if (beat) {
      showBlue = beat.blue !== null;
      showRed = beat.red !== null;
    }
  }

  /**
   * Handle beat cycle completion - advances to next beat or loops
   * Returns true to continue playing, false to pause
   */
  function handleCycleComplete(): boolean {
    // No sequence loaded - nothing to do
    if (!loadedSequence || stepConfigs.length === 0) {
      return false;
    }

    // Check if there are more steps
    if (currentStepIndex < stepConfigs.length - 1) {
      // Advance to next beat
      currentStepIndex++;
      updateVisibilityFromStep(stepConfigs[currentStepIndex]);
      return true; // Continue playing
    } else if (playback.loop) {
      // Loop back to first beat
      currentStepIndex = 0;
      updateVisibilityFromStep(stepConfigs[0]);
      return true; // Continue playing
    } else {
      // Stop at end of sequence
      return false;
    }
  }

  // Whether a sequence is loaded
  const hasSequence = $derived(loadedSequence !== null);

  // Current beat info for display
  const currentStep = $derived<StepMotionConfigs | null>(
    stepConfigs.length > 0 ? (stepConfigs[currentStepIndex] ?? null) : null
  );
  const totalSteps = $derived(stepConfigs.length);

  // Active configs from current beat (null if no sequence)
  const activeBlueConfig = $derived<MotionConfig3D | null>(
    currentStep?.blue ?? null
  );

  const activeRedConfig = $derived<MotionConfig3D | null>(
    currentStep?.red ?? null
  );

  // Computed prop states (only valid when config exists)
  const bluePropState = $derived(
    activeBlueConfig
      ? propInterpolator.calculatePropState(activeBlueConfig, playback.progress)
      : null
  );
  const redPropState = $derived(
    activeRedConfig
      ? propInterpolator.calculatePropState(activeRedConfig, playback.progress)
      : null
  );

  /**
   * Load a sequence for animation
   */
  function loadSequence(sequence: SequenceData) {
    loadedSequence = sequence;
    stepConfigs = sequenceConverter.sequenceToMotionConfigs(
      sequence,
      Plane.WALL
    );
    currentStepIndex = 0;
    playback.reset();
    updateVisibilityFromStep(stepConfigs[0]);
  }

  /**
   * Clear loaded sequence - hides props and resets state
   */
  function clearSequence() {
    loadedSequence = null;
    stepConfigs = [];
    currentStepIndex = 0;
    showBlue = false;
    showRed = false;
    playback.reset();
  }

  /**
   * Navigate to next beat
   */
  function nextStep() {
    if (stepConfigs.length === 0) return;
    currentStepIndex = Math.min(currentStepIndex + 1, stepConfigs.length - 1);
    playback.reset();
    updateVisibilityFromStep(stepConfigs[currentStepIndex]);
  }

  /**
   * Navigate to previous beat
   */
  function prevStep() {
    if (stepConfigs.length === 0) return;
    currentStepIndex = Math.max(currentStepIndex - 1, 0);
    playback.reset();
    updateVisibilityFromStep(stepConfigs[currentStepIndex]);
  }

  /**
   * Jump to specific beat
   */
  function goToStep(index: number) {
    if (stepConfigs.length === 0) return;
    currentStepIndex = Math.max(0, Math.min(index, stepConfigs.length - 1));
    playback.reset();
    updateVisibilityFromStep(stepConfigs[currentStepIndex]);
  }

  return {
    // Sequence loaded state
    get hasSequence() {
      return hasSequence;
    },

    // Playback (delegate to playback state)
    get isPlaying() {
      return playback.isPlaying;
    },
    get progress() {
      return playback.progress;
    },
    get speed() {
      return playback.speed;
    },
    set speed(value: number) {
      playback.speed = value;
    },
    get loop() {
      return playback.loop;
    },
    set loop(value: boolean) {
      playback.loop = value;
    },

    // Active configs (read-only, from current beat)
    get activeBlueConfig() {
      return activeBlueConfig;
    },
    get activeRedConfig() {
      return activeRedConfig;
    },

    // Visibility
    get showBlue() {
      return showBlue;
    },
    get showRed() {
      return showRed;
    },

    // Computed states (null when no sequence)
    get bluePropState() {
      return bluePropState;
    },
    get redPropState() {
      return redPropState;
    },

    // Sequence state
    get loadedSequence() {
      return loadedSequence;
    },
    get currentStepIndex() {
      return currentStepIndex;
    },
    get currentStep() {
      return currentStep;
    },
    get totalSteps() {
      return totalSteps;
    },

    // Playback methods
    play: playback.play,
    pause: playback.pause,
    togglePlay: playback.togglePlay,
    reset: playback.reset,
    setProgress: playback.setProgress,
    destroy: playback.destroy,

    // Sequence methods
    loadSequence,
    clearSequence,
    nextStep,
    prevStep,
    goToStep,

    // Initialization
    autoStartIfNeeded: playback.autoStartIfNeeded,
  };
}

export type Animation3DState = ReturnType<typeof createAnimation3DState>;
