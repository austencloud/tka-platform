/**
 * Sequence Cache Service Interface
 *
 * Manages cache lifecycle when sequences change or playback stops.
 * Ensures memory is properly released to prevent leaks.
 *
 * Uses reactive state ownership - service owns $state, component derives from it.
 * Clear operations are signaled via incrementing counters that trigger $effect.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * Reactive state owned by the service
 */
export interface SequenceCacheState {
  /** Current sequence ID */
  sequenceId: string | null;
  /** Increments when caches should be cleared (triggers component $effect) */
  clearSignal: number;
  /** Increments when pre-rendered frames should be cleared */
  preRenderClearSignal: number;
}

/**
 * Service for managing sequence-related cache lifecycle
 */
export interface ISequenceCache {
  /**
   * Reactive state - read from component via $derived
   */
  readonly state: SequenceCacheState;

  /**
   * Update with new sequence data - clears caches if sequence changed
   * @returns The new sequence ID if changed, null otherwise
   */
  handleSequenceChange(sequenceData: SequenceData | null): string | null;

  /**
   * Handle playback state change - clears pre-rendered frames when stopped
   */
  handlePlaybackChange(isPlaying: boolean): void;

  /**
   * Set whether pre-rendered frames exist (used to decide if clearing is needed)
   */
  setHasPreRenderedFrames(value: boolean): void;

  /**
   * Clean up resources
   */
  dispose(): void;
}
