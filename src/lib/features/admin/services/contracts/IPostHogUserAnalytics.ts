/**
 * PostHog User Analytics Interface
 *
 * Service for fetching aggregated user analytics from PostHog.
 * Provides meaningful metrics instead of raw event streams.
 */

/**
 * Engagement summary for a user
 */
export interface UserEngagementSummary {
  /** ISO timestamp of last activity */
  lastActiveAt: string | null;
  /** ISO timestamp of account creation (from PostHog person properties) */
  memberSince: string | null;
  /** Number of sessions in the specified period */
  sessionsCount: number;
  /** Average session duration in milliseconds */
  avgSessionDuration: number;
  /** Total time spent in app in the period (ms) */
  totalTimeSpent: number;
}

/**
 * Module activity breakdown
 */
export interface ModuleActivityBreakdown {
  /** Module name (browse, create, learn, etc.) */
  module: string;
  /** Percentage of time/activity in this module (0-100) */
  percentage: number;
  /** Number of events in this module */
  eventCount: number;
}

/**
 * Content creation metrics
 */
export interface ContentMetrics {
  /** Sequences created */
  sequencesCreated: number;
  /** Sequences saved to library */
  sequencesSaved: number;
  /** Sequences exported (PNG, etc.) */
  sequencesExported: number;
  /** Collections created */
  collectionsCreated: number;
  /** Sequences shared (public) */
  sequencesShared: number;
}

/**
 * Recent session summary from PostHog
 */
export interface PostHogSessionSummary {
  /** PostHog session ID */
  sessionId: string;
  /** Session start time */
  startedAt: Date;
  /** Session end time (null if ongoing) */
  endedAt: Date | null;
  /** Session duration in milliseconds */
  duration: number;
  /** Modules visited during session */
  modules: string[];
  /** URL for PostHog session replay */
  replayUrl: string | null;
  /** Whether session recording is available */
  hasRecording: boolean;
}

/**
 * Time period for queries
 */
export type TimePeriod = "today" | "week" | "month" | "all";

export interface IPostHogUserAnalytics {
  /**
   * Get engagement summary for a user
   * @param userId - Firebase user ID (distinct_id in PostHog)
   */
  getEngagementSummary(userId: string): Promise<UserEngagementSummary>;

  /**
   * Get activity breakdown by module
   * @param userId - Firebase user ID
   * @param period - Time period to analyze
   */
  getActivityBreakdown(
    userId: string,
    period: TimePeriod
  ): Promise<ModuleActivityBreakdown[]>;

  /**
   * Get content creation metrics
   * @param userId - Firebase user ID
   */
  getContentMetrics(userId: string): Promise<ContentMetrics>;

  /**
   * Get recent sessions with replay URLs
   * @param userId - Firebase user ID
   * @param limit - Maximum sessions to return
   */
  getRecentSessions(
    userId: string,
    limit?: number
  ): Promise<PostHogSessionSummary[]>;

  /**
   * Get the URL for PostHog session replay
   * @param sessionId - PostHog session ID
   */
  getSessionReplayUrl(sessionId: string): string;

  /**
   * Check if the PostHog API is available
   */
  isAvailable(): boolean;
}
