import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
import type { AnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";

export interface AnimationLoadResult {
  success: boolean;
  sequenceData?: SequenceData;
  error?: string;
}

export interface AnimationLoadOptions {
  /** Initial BPM to restore */
  initialBpm?: number;
  /** Initial playback time in ms to restore */
  initialPlaybackTimeMs?: number;
  /** Whether to auto-start playback */
  autoStart?: boolean;
  /** Delay before auto-start in ms */
  autoStartDelay?: number;
}

/**
 * Handles loading and initializing sequence animation data.
 */
export interface ISequenceAnimationLoader {
  /** Whether animation is currently loading */
  readonly isLoading: boolean;

  /**
   * Load and initialize animation for a sequence.
   * @param sequence The sequence to load
   * @param playbackController The playback controller to initialize
   * @param panelState The animation panel state
   * @param options Load options
   */
  load(
    sequence: SequenceData,
    playbackController: IAnimationPlaybackController,
    panelState: AnimationPanelState,
    options?: AnimationLoadOptions
  ): Promise<AnimationLoadResult>;

  /**
   * Check if a sequence has already been loaded.
   */
  isSequenceLoaded(sequenceId: string): boolean;

  /**
   * Reset loader state.
   */
  reset(): void;
}
