/**
 * ISequenceDataProvider - Unified interface for loading sequence data
 *
 * Abstracts the data source (local Dexie, Firebase, etc.) so components
 * don't need to know where sequences come from.
 *
 * Use this instead of directly accessing sequenceRepository or browseLoader.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface ISequenceDataProvider {
  /**
   * Load full sequence data with motion information.
   *
   * Tries multiple sources in priority order:
   * 1. Returns immediately if the sequence already has motion data
   * 2. Checks local repository (user's own sequences)
   * 3. Falls back to browse/public loader (Firebase sequences)
   *
   * @param sequence - The sequence to hydrate (may be lightweight metadata only)
   * @returns Fully hydrated sequence with motion data, or the original if hydration fails
   */
  hydrateSequence(sequence: SequenceData): Promise<SequenceData>;

  /**
   * Load a sequence by identifier (word or name).
   *
   * @param identifier - The sequence word or name
   * @returns Fully hydrated sequence, or null if not found
   */
  loadByIdentifier(identifier: string): Promise<SequenceData | null>;

  /**
   * Start hydrating a sequence in the background. Returns immediately.
   * Intended for hover prefetch - starts the Firestore round-trip early
   * so that a subsequent hydrateSequence() call is an instant cache hit.
   *
   * No-ops if the sequence already has motion data or is already prefetching.
   */
  prefetch(sequence: SequenceData): void;

  /**
   * Get a previously prefetched hydration result if available.
   * Returns null if the sequence hasn't been prefetched or prefetch is still in-flight.
   */
  getCached(sequence: SequenceData): SequenceData | null;
}
