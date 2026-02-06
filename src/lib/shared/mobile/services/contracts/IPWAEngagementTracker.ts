/**
 * PWA Engagement Tracking Service Contract
 *
 * Tracks user engagement signals to determine optimal timing
 * for showing PWA install prompts.
 */

export interface PWAEngagementMetrics {
  /** Number of times user has visited the app */
  visitCount: number;

  /** Whether user has created at least one sequence */
  hasCreatedSequence: boolean;

  /** Number of meaningful interactions (clicks, selections, etc.) */
  interactionCount: number;

  /** Total time spent in app (milliseconds) */
  totalTimeSpent: number;

  /** Timestamp of first visit */
  firstVisit: number;

  /** Timestamp of last visit */
  lastVisit: number;
}

export interface IPWAEngagementTracker {
  /**
   * Increment visit count (call on app mount)
   */
  recordVisit(): void;

  /**
   * Record that user created a sequence
   */
  recordSequenceCreated(): void;

  /**
   * Record a meaningful user interaction
   */
  recordInteraction(): void;

  /**
   * Start tracking time spent in session
   */
  startSession(): void;

  /**
   * End tracking time spent in session
   */
  endSession(): void;

  /**
   * Get current engagement metrics
   */
  getMetrics(): PWAEngagementMetrics;

  /**
   * Check if user has met engagement threshold to show install prompt
   *
   * Shows prompt after:
   * - User creates first sequence, OR
   * - 5+ interactions, OR
   * - 2+ minutes of time spent, OR
   * - 2+ visits
   */
  shouldShowInstallPrompt(): boolean;

  /**
   * Reset all engagement metrics (for testing)
   */
  reset(): void;
}
