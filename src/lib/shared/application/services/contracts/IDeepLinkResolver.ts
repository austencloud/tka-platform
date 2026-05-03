/**
 * IDeepLinkResolver - Resolves sequence IDs from URLs to full sequence data
 *
 * Used by ModalUrlRestorer to fetch sequences from various sources
 * when a user navigates to a deep link URL.
 *
 * Resolution chain:
 * 1. SessionStorage cache (handles HMR and same-tab refresh)
 * 2. Local SequenceRepository (session sequences in IndexedDB)
 * 3. Firebase public sequences (for cross-user/cross-tab links)
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export type DeepLinkSource = "cache" | "local" | "public" | null;
export type DeepLinkError = "not_found" | "network" | null;

export interface DeepLinkResult {
  /** The resolved sequence data, or null if not found */
  sequence: SequenceData | null;
  /** Where the sequence was found */
  source: DeepLinkSource;
  /** Error type if resolution failed */
  error: DeepLinkError;
}

export interface IDeepLinkResolver {
  /**
   * Resolve a sequence ID to full sequence data.
   *
   * Tries multiple sources in order:
   * 1. Session cache (for HMR/refresh)
   * 2. Local repository (IndexedDB)
   * 3. Public sequences (Firebase)
   *
   * @param sequenceId - The sequence document ID from URL
   * @returns Resolution result with sequence data and source
   */
  resolve(sequenceId: string): Promise<DeepLinkResult>;
}
