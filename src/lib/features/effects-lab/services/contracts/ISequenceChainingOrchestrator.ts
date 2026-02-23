/**
 * Sequence Chaining Orchestrator Interface
 *
 * Manages continuous sequence playback by chaining sequences together.
 * Supports three source modes: manual pick, library browsing, and
 * infinite generation. Handles preloading, hot-swapping, and step
 * watching for seamless transitions.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
import type { AnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";

export type SourceMode = "pick" | "library" | "infinite";

export interface ISequenceChainingOrchestrator {
  /** Whether a chain swap is currently in progress */
  readonly isChainingNow: boolean;

  /** Whether the next sequence is being preloaded */
  readonly isPreloading: boolean;

  /**
   * Initialize with the playback controller and animation state.
   * Must be called after services are ready.
   */
  initialize(
    playbackController: IAnimationPlaybackController,
    animationState: AnimationPanelState
  ): Promise<void>;

  /**
   * Start auto mode for library or infinite source modes.
   * Loads the first sequence and begins preloading.
   */
  startAutoMode(mode: SourceMode): Promise<void>;

  /**
   * Skip to the next sequence (library/infinite modes only).
   */
  skip(): void;

  /**
   * Shuffle to a random sequence, breaking the chain (infinite mode only).
   */
  shuffle(): Promise<void>;

  /**
   * Hot-swap a manually picked sequence into playback.
   */
  hotSwapSequence(sequenceData: SequenceData): void;

  /**
   * Called each animation frame/tick to check if the current sequence
   * has completed and needs chaining. Returns the new sequence if a
   * chain occurred, null otherwise.
   */
  checkAndChain(
    currentStep: number,
    totalSteps: number,
    sourceMode: SourceMode,
    servicesReady: boolean,
    hasSequence: boolean
  ): void;

  /**
   * Called to trigger preloading when playback is partway through.
   */
  checkAndPreload(
    currentStep: number,
    totalSteps: number,
    sourceMode: SourceMode,
    servicesReady: boolean,
    hasSequence: boolean
  ): void;

  /**
   * Register a callback invoked whenever a sequence is swapped in.
   * The callback receives the new SequenceData.
   */
  onSequenceSwapped(callback: (seq: SequenceData) => void): void;

  /**
   * Register a callback invoked when an error occurs during chaining.
   */
  onError(callback: (message: string) => void): void;

  /** Clean up resources */
  dispose(): void;
}
