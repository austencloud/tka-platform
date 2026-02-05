/**
 * Deep Link Sequence Service Contract
 *
 * Handles loading sequences from:
 * - Deep link URLs (shareable links)
 * - Pending edit transfers from Browser module
 *
 * Encapsulates the complex sequence enrichment logic
 * (position derivation, letter derivation, merging).
 *
 * Domain: Create module - Sequence Loading
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface DeepLinkLoadResult {
  /** Whether a sequence was loaded */
  loaded: boolean;
  /** The tab to navigate to (if specified in deep link) */
  targetTab?: string;
  /** Source of the loaded sequence */
  source?: "deepLink" | "pendingEdit";
}

export interface IDeepLinkSequenceHandler {
  /**
   * Check if there's a deep link sequence waiting to be loaded
   */
  hasDeepLink(): boolean;

  /**
   * Check if there's a pending edit sequence from Browser
   */
  hasPendingEdit(): boolean;

  /**
   * Check if a pending edit was processed this session.
   * This flag survives localStorage clearing and can be used by persistence
   * restoration code to avoid overwriting the loaded sequence.
   */
  wasPendingEditProcessedThisSession(): boolean;

  /**
   * Load sequence from deep link store and enrich with derived data.
   * Handles position derivation, letter derivation, and merging.
   *
   * @param setSequence Callback to set the sequence in state
   * @returns Result indicating if sequence was loaded and target tab
   */
  loadFromDeepLink(
    setSequence: (sequence: SequenceData) => void
  ): Promise<DeepLinkLoadResult>;

  /**
   * Load sequence from localStorage pending edit transfer.
   * Used when user clicks "Edit" on a sequence in Browser.
   *
   * @param setSequence Callback to set the sequence in state
   * @returns Result indicating if sequence was loaded
   */
  loadFromPendingEdit(
    setSequence: (sequence: SequenceData) => void
  ): Promise<DeepLinkLoadResult>;

  /**
   * Attempt to load from any available source (deep link first, then pending edit).
   * Returns immediately after first successful load.
   *
   * @param setSequence Callback to set the sequence in state
   * @returns Result indicating source and target tab
   */
  loadFromAnySource(
    setSequence: (sequence: SequenceData) => void
  ): Promise<DeepLinkLoadResult>;

  /**
   * Clear any pending edit data from localStorage
   */
  clearPendingEdit(): void;
}
