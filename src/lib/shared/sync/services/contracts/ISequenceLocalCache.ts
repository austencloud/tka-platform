/**
 * ISequenceLocalCache
 *
 * IndexedDB-based local cache for sequence data.
 * Provides instant access to sequences for multi-device sync scenarios.
 * When Device B joins a sync room, cached sequences load instantly
 * instead of waiting for Firebase round-trip.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface SequenceLocalCacheStats {
  count: number;
  sizeBytes: number;
}

export interface ISequenceLocalCache {
  /**
   * Get a sequence from local cache
   * @param sequenceId - Unique sequence identifier
   * @returns The cached sequence data, or null if not found
   */
  get(sequenceId: string): Promise<SequenceData | null>;

  /**
   * Store a sequence in local cache
   * @param sequenceId - Unique sequence identifier
   * @param data - The sequence data to cache
   */
  set(sequenceId: string, data: SequenceData): Promise<void>;

  /**
   * Check if sequence exists in cache (faster than get for existence checks)
   * @param sequenceId - Unique sequence identifier
   * @returns True if the sequence is cached
   */
  has(sequenceId: string): Promise<boolean>;

  /**
   * Get multiple sequences in a single operation (batch read)
   * @param sequenceIds - Array of sequence identifiers
   * @returns Map of sequenceId to SequenceData for found entries
   */
  getMany(sequenceIds: string[]): Promise<Map<string, SequenceData>>;

  /**
   * Delete a sequence from cache
   * @param sequenceId - Unique sequence identifier
   */
  delete(sequenceId: string): Promise<void>;

  /**
   * Get cache statistics
   * @returns Object with count and sizeBytes
   */
  getStats(): Promise<SequenceLocalCacheStats>;

  /**
   * Prune old entries to stay under quota (LRU eviction)
   * Deletes oldest entries by access time until cache is under limit
   * @param maxSizeBytes - Target maximum size in bytes
   * @returns Number of entries deleted
   */
  prune(maxSizeBytes: number): Promise<number>;

  /**
   * Clear all cached sequences
   */
  clear(): Promise<void>;
}
