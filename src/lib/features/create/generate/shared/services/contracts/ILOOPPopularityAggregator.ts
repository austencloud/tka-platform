/**
 * ILOOPPopularityAggregator
 *
 * Interface for aggregating LOOP type popularity from public sequences.
 * Provides real-time statistics with client-side caching.
 */

import type { LOOPPopularityData } from "../../domain/models/loop-selection-types";

export interface ILOOPPopularityAggregator {
  /**
   * Get popularity data for all LOOP types
   * Uses 1-hour cache to avoid excessive Firestore reads
   *
   * @param forceRefresh - Force a fresh fetch, bypassing cache
   * @returns Array of popularity data, sorted by usageCount descending
   */
  getPopularityData(forceRefresh?: boolean): Promise<LOOPPopularityData[]>;

  /**
   * Get the top N most popular LOOP types
   * @param limit - Number of results to return
   * @returns Array of popularity data
   */
  getTopPopular(limit?: number): Promise<LOOPPopularityData[]>;

  /**
   * Get popularity for a specific LOOP type
   * @param loopType - The LOOP type string (e.g., "strict_rotated")
   * @returns Popularity data or null if no sequences use this type
   */
  getPopularityForType(loopType: string): Promise<LOOPPopularityData | null>;

  /**
   * Check if the cache is valid
   * @returns true if cache exists and hasn't expired
   */
  isCacheValid(): boolean;

  /**
   * Clear the cache
   * Forces next request to fetch fresh data
   */
  clearCache(): void;

  /**
   * Get the cache expiration time
   * @returns Timestamp when cache expires, or null if no cache
   */
  getCacheExpiration(): number | null;
}
