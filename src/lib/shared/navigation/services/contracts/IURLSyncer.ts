/**
 * URL Sync Service Contract
 *
 * Handles keeping the browser URL in sync with the current sequence
 * so users can share by simply copying the URL bar at any time.
 *
 * Domain: Navigation - Live URL Synchronization
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * Options for URL sync operations
 */
export interface URLSyncOptions {
  /** Milliseconds to debounce (default: 500) */
  debounce?: number;
  /** Skip debouncing and update immediately */
  immediate?: boolean;
  /** Allow clearing URL when sequence is empty (default: true) */
  allowClear?: boolean;
}

/**
 * Service for synchronizing browser URL with sequence state
 */
export interface IURLSyncer {
  /**
   * Update the browser URL to reflect the current sequence
   * Uses replaceState to avoid creating history entries
   *
   * @param sequence - Current sequence to encode in URL (null to clear)
   * @param module - Module shorthand: 'construct', 'animate', etc.
   * @param options - Configuration options
   */
  syncURLWithSequence(
    sequence: SequenceData | null,
    module: string,
    options?: URLSyncOptions
  ): void;

  /**
   * Clear sequence data from URL
   * Removes the 'open' parameter and reverts to clean URL
   */
  clearSequenceFromURL(): void;

  /**
   * Check if current URL contains a sequence
   */
  hasSequenceInURL(): boolean;

  /**
   * Create a debounced URL sync function for reactive effects
   * Returns a function that can be called repeatedly without creating
   * multiple pending timeouts
   *
   * @param module - Module shorthand
   * @param debounceMs - Debounce duration in milliseconds (default: 500)
   */
  createDebouncedSync(
    module: string,
    debounceMs?: number
  ): (sequence: SequenceData | null) => void;

  /**
   * Cancel any pending debounced URL updates
   */
  cancelPendingUpdates(): void;
}
