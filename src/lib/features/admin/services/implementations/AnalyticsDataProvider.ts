/**
 * Analytics Data Provider
 *
 * Orchestrates analytics data retrieval by delegating to focused analyzers.
 * This is the main entry point for analytics data in the admin module.
 *
 * Architecture:
 * - UserMetricsAnalyzer: Summary, content, and engagement metrics from SystemStateManager
 * - EventActivityAnalyzer: Activity logs, event breakdowns, module usage
 * - ContentQueryAnalyzer: Top sequences and content queries
 */

import { injectable, inject } from "inversify";
import { getFirestoreInstance, getAuthSync } from "$lib/shared/auth/firebase";
import { TYPES } from "$lib/shared/inversify/types";
import type {
  IAnalyticsDataProvider,
  SummaryMetrics,
  UserActivityPoint,
  ContentStatistics,
  TopSequenceData,
  EngagementMetrics,
  AnalyticsTimeRange,
  EventTypeBreakdown,
  ModuleUsageData,
  RecentActivityEvent,
} from "../contracts/IAnalyticsDataProvider";
import type { IUserMetricsAnalyzer } from "./UserMetricsAnalyzer";
import type { IEventActivityAnalyzer } from "./EventActivityAnalyzer";
import type { IContentQueryAnalyzer } from "./ContentQueryAnalyzer";

/**
 * Empty metrics for when Firebase is unavailable
 */
const EMPTY_SUMMARY_METRICS: SummaryMetrics = {
  totalUsers: 0,
  activeToday: 0,
  sequencesCreated: 0,
  challengesCompleted: 0,
  previousTotalUsers: 0,
  previousActiveToday: 0,
  previousSequencesCreated: 0,
  previousChallengesCompleted: 0,
};

@injectable()
export class AnalyticsDataProvider implements IAnalyticsDataProvider {
  constructor(
    @inject(TYPES.IUserMetricsAnalyzer)
    private readonly userMetricsAnalyzer: IUserMetricsAnalyzer,
    @inject(TYPES.IEventActivityAnalyzer)
    private readonly eventActivityAnalyzer: IEventActivityAnalyzer,
    @inject(TYPES.IContentQueryAnalyzer)
    private readonly contentQueryAnalyzer: IContentQueryAnalyzer
  ) {}

  /**
   * Check if Firebase is properly initialized and user is authenticated
   */
  private async isFirestoreAvailable(): Promise<boolean> {
    try {
      const firestore = await getFirestoreInstance();
      return (
        firestore !== null &&
        firestore !== undefined &&
        getAuthSync().currentUser !== null
      );
    } catch {
      return false;
    }
  }

  // ============================================================================
  // USER METRICS (delegated to UserMetricsAnalyzer)
  // ============================================================================

  async getSummaryMetrics(
    timeRange: AnalyticsTimeRange
  ): Promise<SummaryMetrics> {
    if (!(await this.isFirestoreAvailable())) {
      return EMPTY_SUMMARY_METRICS;
    }
    return this.userMetricsAnalyzer.getSummaryMetrics(timeRange);
  }

  async getContentStatistics(): Promise<ContentStatistics> {
    if (!(await this.isFirestoreAvailable())) {
      return { totalSequences: 0, publicSequences: 0, totalViews: 0, totalShares: 0 };
    }
    return this.userMetricsAnalyzer.getContentStatistics();
  }

  async getEngagementMetrics(): Promise<EngagementMetrics> {
    if (!(await this.isFirestoreAvailable())) {
      return {
        challengeParticipants: 0,
        achievementsUnlocked: 0,
        activeStreaks: 0,
        totalXPEarned: 0,
        totalUsers: 0,
        totalAchievementsPossible: 0,
      };
    }
    return this.userMetricsAnalyzer.getEngagementMetrics();
  }

  // ============================================================================
  // ACTIVITY ANALYTICS (delegated to EventActivityAnalyzer)
  // ============================================================================

  async getUserActivity(
    timeRange: AnalyticsTimeRange
  ): Promise<UserActivityPoint[]> {
    if (!(await this.isFirestoreAvailable())) {
      return [];
    }
    return this.eventActivityAnalyzer.getUserActivity(timeRange);
  }

  async getEventTypeBreakdown(
    timeRange: AnalyticsTimeRange
  ): Promise<EventTypeBreakdown[]> {
    if (!(await this.isFirestoreAvailable())) {
      return [];
    }
    return this.eventActivityAnalyzer.getEventTypeBreakdown(timeRange);
  }

  async getModuleUsage(
    timeRange: AnalyticsTimeRange
  ): Promise<ModuleUsageData[]> {
    if (!(await this.isFirestoreAvailable())) {
      return [];
    }
    return this.eventActivityAnalyzer.getModuleUsage(timeRange);
  }

  async getRecentActivity(limit: number): Promise<RecentActivityEvent[]> {
    if (!(await this.isFirestoreAvailable())) {
      return [];
    }
    return this.eventActivityAnalyzer.getRecentActivity(limit);
  }

  // ============================================================================
  // CONTENT QUERIES (delegated to ContentQueryAnalyzer)
  // ============================================================================

  async getTopSequences(limit: number): Promise<TopSequenceData[]> {
    if (!(await this.isFirestoreAvailable())) {
      return [];
    }
    return this.contentQueryAnalyzer.getTopSequences(limit);
  }
}
