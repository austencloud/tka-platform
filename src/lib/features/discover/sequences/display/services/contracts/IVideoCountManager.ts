/**
 * IVideoCountManager - Manage video counts for sequences
 *
 * Provides efficient video count lookups for sequence detail views.
 * Wraps ICollaborativeVideoManager with caching and batch operations.
 */

export interface IVideoCountManager {
  /**
   * Get the video count for a sequence
   * @param sequenceId - The sequence to get video count for
   * @returns Number of videos associated with the sequence
   */
  getVideoCount(sequenceId: string): Promise<number>;

  /**
   * Refresh the video count for a sequence
   * (e.g., after adding/removing a video)
   */
  refreshCount(sequenceId: string): Promise<number>;

  /**
   * Clear cached count for a sequence
   */
  invalidateCache(sequenceId: string): void;
}
