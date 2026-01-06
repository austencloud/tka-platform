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
  BeatMotionConfigs,
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
  let beatConfigs = $state<BeatMotionConfigs[]>([]);
  let currentBeatIndex = $state(0);

  // Create playback first so we can reference it
  const playback = createPlaybackState({
    onCycleComplete: () => handleCycleComplete(),
  });

  /**
   * Update visibility based on a beat's motion configs
   */
  function updateVisibilityFromBeat(beat: BeatMotionConfigs | undefined) {
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
    if (!loadedSequence || beatConfigs.length === 0) {
      return false;
    }

    // Check if there are more beats
    if (currentBeatIndex < beatConfigs.length - 1) {
      // Advance to next beat
      currentBeatIndex++;
      updateVisibilityFromBeat(beatConfigs[currentBeatIndex]);
      return true; // Continue playing
    } else if (playback.loop) {
      // Loop back to first beat
      currentBeatIndex = 0;
      updateVisibilityFromBeat(beatConfigs[0]);
      return true; // Continue playing
    } else {
      // Stop at end of sequence
      return false;
    }
  }

  // Whether a sequence is loaded
  const hasSequence = $derived(loadedSequence !== null);

  // Current beat info for display
  const currentBeat = $derived<BeatMotionConfigs | null>(
    beatConfigs.length > 0 ? (beatConfigs[currentBeatIndex] ?? null) : null
  );
  const totalBeats = $derived(beatConfigs.length);

  // Active configs from current beat (null if no sequence)
  const activeBlueConfig = $derived<MotionConfig3D | null>(
    currentBeat?.blue ?? null
  );

  const activeRedConfig = $derived<MotionConfig3D | null>(
    currentBeat?.red ?? null
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
    beatConfigs = sequenceConverter.sequenceToMotionConfigs(
      sequence,
      Plane.WALL
    );
    currentBeatIndex = 0;
    playback.reset();
    updateVisibilityFromBeat(beatConfigs[0]);
  }

  /**
   * Clear loaded sequence - hides props and resets state
   */
  function clearSequence() {
    loadedSequence = null;
    beatConfigs = [];
    currentBeatIndex = 0;
    showBlue = false;
    showRed = false;
    playback.reset();
  }

  /**
   * Navigate to next beat
   */
  function nextBeat() {
    if (beatConfigs.length === 0) return;
    currentBeatIndex = Math.min(currentBeatIndex + 1, beatConfigs.length - 1);
    playback.reset();
    updateVisibilityFromBeat(beatConfigs[currentBeatIndex]);
  }

  /**
   * Navigate to previous beat
   */
  function prevBeat() {
    if (beatConfigs.length === 0) return;
    currentBeatIndex = Math.max(currentBeatIndex - 1, 0);
    playback.reset();
    updateVisibilityFromBeat(beatConfigs[currentBeatIndex]);
  }

  /**
   * Jump to specific beat
   */
  function goToBeat(index: number) {
    if (beatConfigs.length === 0) return;
    currentBeatIndex = Math.max(0, Math.min(index, beatConfigs.length - 1));
    playback.reset();
    updateVisibilityFromBeat(beatConfigs[currentBeatIndex]);
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
    get currentBeatIndex() {
      return currentBeatIndex;
    },
    get currentBeat() {
      return currentBeat;
    },
    get totalBeats() {
      return totalBeats;
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
    nextBeat,
    prevBeat,
    goToBeat,

    // Initialization
    autoStartIfNeeded: playback.autoStartIfNeeded,
  };
}

export type Animation3DState = ReturnType<typeof createAnimation3DState>;
