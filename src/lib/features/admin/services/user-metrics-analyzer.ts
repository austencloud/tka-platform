import type { SummaryMetrics, ContentStatistics, AnalyticsTimeRange } from "./types";
import type { SystemStateManager } from "./system-state-manager";
/**
 * User Metrics Analyzer
 *
 * Analyzes user-based metrics from the SystemStateManager cache.
 * Handles summary metrics and content statistics.
 */


/**
 * Empty metrics for error/unavailable states
 */
const EMPTY_SUMMARY_METRICS: SummaryMetrics = {
  totalUsers: 0,
  activeToday: 0,
  sequencesCreated: 0,
  previousTotalUsers: 0,
  previousActiveToday: 0,
  previousSequencesCreated: 0,
};

const EMPTY_CONTENT_STATS: ContentStatistics = {
  totalSequences: 0,
  publicSequences: 0,
  totalViews: 0,
  totalShares: 0,
};

export class UserMetricsAnalyzer {
  constructor(private readonly systemStateManager: SystemStateManager) {}

  /**
   * Get summary metrics from cached user data
   *
   * Note: Only "Active Today" is time-based. Other metrics are all-time totals
   * since we don't have per-period tracking without Firebase indexes.
   */
  async getSummaryMetrics(
    _timeRange: AnalyticsTimeRange
  ): Promise<SummaryMetrics> {
    try {
      const systemState = await this.systemStateManager.getSystemState();
      const users = systemState.users;
      const totalUsers = users.length;

      // Calculate active users today/yesterday from cached data
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      let activeToday = 0;
      let previousActiveToday = 0;
      let totalSequences = 0;

      for (const user of users) {
        // Count active users
        if (user.lastActivityDate) {
          if (user.lastActivityDate >= todayStart) {
            activeToday++;
          } else if (user.lastActivityDate >= yesterdayStart) {
            previousActiveToday++;
          }
        }
        // Sum totals
        totalSequences += user.sequenceCount;
      }

      return {
        totalUsers,
        activeToday,
        sequencesCreated: totalSequences,
        // No historical comparison available for these metrics
        previousTotalUsers: totalUsers,
        previousActiveToday,
        previousSequencesCreated: totalSequences,
      };
    } catch (error) {
      console.error("[UserMetricsAnalyzer] Failed to get summary metrics:", error);
      return EMPTY_SUMMARY_METRICS;
    }
  }

  /**
   * Get content statistics aggregated from user data
   */
  async getContentStatistics(): Promise<ContentStatistics> {
    try {
      const systemState = await this.systemStateManager.getSystemState();
      const users = systemState.users;

      let totalSequences = 0;
      let publicSequences = 0;
      let totalViews = 0;
      let totalShares = 0;

      for (const user of users) {
        totalSequences += user.sequenceCount;
        publicSequences += user.publicSequenceCount;
        totalViews += user.totalViews;
        totalShares += user.shareCount;
      }

      return {
        totalSequences,
        publicSequences,
        totalViews,
        totalShares,
      };
    } catch (error) {
      console.error("[UserMetricsAnalyzer] Failed to get content statistics:", error);
      return EMPTY_CONTENT_STATS;
    }
  }
}
