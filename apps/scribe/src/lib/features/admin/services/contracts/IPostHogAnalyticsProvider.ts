/**
 * PostHog Analytics Provider Interface
 *
 * Provides access to PostHog analytics data for the admin dashboard.
 * Uses PostHog's Query API (HogQL) for custom metrics.
 */

/**
 * Summary metrics from PostHog
 */
export interface PostHogSummaryMetrics {
  totalUsers: number;
  activeUsers7d: number;
  totalSessions7d: number;
  avgSessionDurationSeconds: number;
}

/**
 * User segment counts based on behavior
 */
export interface UserSegments {
  creators: number; // Created 5+ sequences
  consumers: number; // Viewed 10+ but created 0
  learners: number; // Completed 3+ lessons
  lurkers: number; // <5 sessions and no content
}

/**
 * PostHog dashboard link configuration
 */
export interface PostHogDashboardLinks {
  retention: string;
  insights: string;
  persons: string;
  replay: string;
  events: string;
}

export interface IPostHogAnalyticsProvider {
  /**
   * Get the project ID for constructing dashboard URLs
   */
  getProjectId(): string | null;

  /**
   * Check if PostHog is initialized and available
   */
  isAvailable(): boolean;

  /**
   * Get links to PostHog dashboard pages
   */
  getDashboardLinks(): PostHogDashboardLinks | null;

  /**
   * Get summary metrics (total users, active users, sessions, etc.)
   * Note: These may require API calls and could be rate-limited.
   * Returns null if data unavailable.
   */
  getSummaryMetrics(): Promise<PostHogSummaryMetrics | null>;

  /**
   * Get user segment counts
   * Note: These require HogQL queries and may be slow.
   * Returns null if data unavailable.
   */
  getUserSegments(): Promise<UserSegments | null>;
}
