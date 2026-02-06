/**
 * Analytics Data Provider Interface
 *
 * Provides methods for fetching analytics data from Firebase
 */

export interface SummaryMetrics {
  totalUsers: number;
  activeToday: number;
  sequencesCreated: number;
  challengesCompleted: number;
  // Previous period for comparison
  previousTotalUsers: number;
  previousActiveToday: number;
  previousSequencesCreated: number;
  previousChallengesCompleted: number;
}

export interface UserActivityPoint {
  date: string;
  activeUsers: number;
}

export interface ContentStatistics {
  totalSequences: number;
  publicSequences: number;
  totalViews: number;
  totalShares: number;
}

export interface TopSequenceData {
  id: string;
  name: string;
  word: string;
  views: number;
  creator: string;
}

export interface EngagementMetrics {
  challengeParticipants: number;
  achievementsUnlocked: number;
  activeStreaks: number;
  totalXPEarned: number;
  totalUsers: number;
  totalAchievementsPossible: number;
}

export interface AnalyticsTimeRange {
  days: number;
  startDate: Date;
  endDate: Date;
}

/**
 * Activity event breakdown by type
 */
export interface EventTypeBreakdown {
  eventType: string;
  count: number;
  label: string;
  color: string;
}

/**
 * Module usage statistics
 */
export interface ModuleUsageData {
  module: string;
  views: number;
  label: string;
  color: string;
}

/**
 * Recent activity event for display
 */
export interface RecentActivityEvent {
  id: string;
  eventType: string;
  category: string;
  timestamp: Date;
  userId: string;
  metadata?: Record<string, unknown>;
  // User details for display
  user?: {
    displayName: string;
    photoURL: string | null;
    email: string | null;
  };
}

export interface IAnalyticsDataProvider {
  /**
   * Get summary metrics (total users, active users, etc.)
   */
  getSummaryMetrics(timeRange: AnalyticsTimeRange): Promise<SummaryMetrics>;

  /**
   * Get user activity over time
   */
  getUserActivity(timeRange: AnalyticsTimeRange): Promise<UserActivityPoint[]>;

  /**
   * Get content statistics
   */
  getContentStatistics(): Promise<ContentStatistics>;

  /**
   * Get top sequences by views
   */
  getTopSequences(limit: number): Promise<TopSequenceData[]>;

  /**
   * Get engagement metrics
   */
  getEngagementMetrics(): Promise<EngagementMetrics>;

  /**
   * Get activity event breakdown by type for the time range
   */
  getEventTypeBreakdown(
    timeRange: AnalyticsTimeRange
  ): Promise<EventTypeBreakdown[]>;

  /**
   * Get module usage statistics for the time range
   */
  getModuleUsage(timeRange: AnalyticsTimeRange): Promise<ModuleUsageData[]>;

  /**
   * Get recent activity events (across all users)
   */
  getRecentActivity(limit: number): Promise<RecentActivityEvent[]>;
}
