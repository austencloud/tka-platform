/**
 * Spinner Metrics Repository Interface
 *
 * Manages global metrics for the infinite spinner, persisted to Firebase.
 * Tracks total sequences ever generated across all users and sessions.
 */

import type { SpinnerMetrics } from "../../domain/models/spinner-models";

export interface ISpinnerMetricsRepository {
  /**
   * Get current global metrics.
   * Lazy loads from Firebase on first call.
   */
  getMetrics(): Promise<SpinnerMetrics>;

  /**
   * Increment the global generation counter atomically.
   * Returns the new total after incrementing.
   */
  incrementGeneratedCount(): Promise<number>;

  /**
   * Subscribe to real-time metric updates.
   * Returns an unsubscribe function.
   */
  subscribe(callback: (metrics: SpinnerMetrics) => void): () => void;
}
