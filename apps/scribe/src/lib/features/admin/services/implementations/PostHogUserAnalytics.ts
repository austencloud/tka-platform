/**
 * PostHog User Analytics Implementation
 *
 * Fetches aggregated user analytics from PostHog's API.
 * Uses HogQL queries for flexible data retrieval.
 *
 * NOTE: This requires a PostHog Personal API Key with read access.
 * The key should be stored in environment variables.
 *
 * TODO: Add POSTHOG_PERSONAL_API_KEY to .env for production use.
 * For now, returns mock data when the API key is not configured.
 */

import { browser } from "$app/environment";
import type {
  IPostHogUserAnalytics,
  UserEngagementSummary,
  ModuleActivityBreakdown,
  ContentMetrics,
  PostHogSessionSummary,
  TimePeriod,
} from "../contracts/IPostHogUserAnalytics";

// PostHog API configuration
// TODO: Move these to environment variables for production
const POSTHOG_API_HOST = "https://us.i.posthog.com";
// The project ID is derived from the public key for now
// In production, this should be configured separately
const POSTHOG_PROJECT_ID = "98849"; // TKA Scribe project ID

export class PostHogUserAnalytics implements IPostHogUserAnalytics {
  private apiKey: string | null = null;

  constructor() {
    // TODO: Load from environment variable
    // this.apiKey = import.meta.env.VITE_POSTHOG_PERSONAL_API_KEY || null;
    // For now, we'll use mock data
    this.apiKey = null;
  }

  /**
   * Check if the PostHog API is available
   */
  isAvailable(): boolean {
    return this.apiKey !== null && browser;
  }

  /**
   * Get engagement summary for a user
   */
  async getEngagementSummary(userId: string): Promise<UserEngagementSummary> {
    if (!this.isAvailable()) {
      return this.getMockEngagementSummary(userId);
    }

    try {
      // Query for session data in the last 30 days
      const query = `
        SELECT
          max(timestamp) as last_active,
          count(distinct $session_id) as sessions_count,
          sum(session_duration) / 1000 as total_duration_sec
        FROM events
        WHERE distinct_id = '${userId}'
          AND timestamp > now() - interval 30 day
      `;

      const result = await this.executeHogQLQuery(query);

      if (result && result.results && result.results.length > 0) {
        const row = result.results[0];
        if (row) {
          const [lastActive, sessionsCount, totalDurationSec] = row as [string, number, number];
          const avgDuration =
            sessionsCount > 0 ? (totalDurationSec * 1000) / sessionsCount : 0;

          return {
            lastActiveAt: lastActive,
            memberSince: null, // Would come from person properties
            sessionsCount: sessionsCount || 0,
            avgSessionDuration: avgDuration,
            totalTimeSpent: (totalDurationSec || 0) * 1000,
          };
        }
      }
    } catch (error) {
      console.error("[PostHogUserAnalytics] Failed to get engagement summary:", error);
    }

    return this.getMockEngagementSummary(userId);
  }

  /**
   * Get activity breakdown by module
   */
  async getActivityBreakdown(
    userId: string,
    period: TimePeriod
  ): Promise<ModuleActivityBreakdown[]> {
    if (!this.isAvailable()) {
      return this.getMockActivityBreakdown(period);
    }

    const interval = this.getPeriodInterval(period);

    try {
      const query = `
        SELECT
          properties.module as module,
          count() as event_count
        FROM events
        WHERE distinct_id = '${userId}'
          AND timestamp > now() - interval ${interval}
          AND properties.module IS NOT NULL
        GROUP BY properties.module
        ORDER BY event_count DESC
      `;

      const result = await this.executeHogQLQuery(query);

      if (result && result.results) {
        const total = result.results.reduce(
          (sum: number, r: unknown[]) => sum + (r[1] as number),
          0
        );

        return result.results.map((r: unknown[]) => ({
          module: r[0] as string,
          eventCount: r[1] as number,
          percentage: total > 0 ? Math.round(((r[1] as number) / total) * 100) : 0,
        }));
      }
    } catch (error) {
      console.error("[PostHogUserAnalytics] Failed to get activity breakdown:", error);
    }

    return this.getMockActivityBreakdown(period);
  }

  /**
   * Get content creation metrics
   */
  async getContentMetrics(userId: string): Promise<ContentMetrics> {
    if (!this.isAvailable()) {
      return this.getMockContentMetrics();
    }

    try {
      const query = `
        SELECT
          event,
          count() as count
        FROM events
        WHERE distinct_id = '${userId}'
          AND event IN (
            'sequence_create',
            'sequence_save',
            'sequence_export',
            'sequence_share',
            'collection_create'
          )
        GROUP BY event
      `;

      const result = await this.executeHogQLQuery(query);

      if (result && result.results) {
        const metrics: ContentMetrics = {
          sequencesCreated: 0,
          sequencesSaved: 0,
          sequencesExported: 0,
          collectionsCreated: 0,
          sequencesShared: 0,
        };

        for (const [event, count] of result.results) {
          switch (event) {
            case "sequence_create":
              metrics.sequencesCreated = count as number;
              break;
            case "sequence_save":
              metrics.sequencesSaved = count as number;
              break;
            case "sequence_export":
              metrics.sequencesExported = count as number;
              break;
            case "collection_create":
              metrics.collectionsCreated = count as number;
              break;
            case "sequence_share":
              metrics.sequencesShared = count as number;
              break;
          }
        }

        return metrics;
      }
    } catch (error) {
      console.error("[PostHogUserAnalytics] Failed to get content metrics:", error);
    }

    return this.getMockContentMetrics();
  }

  /**
   * Get recent sessions with replay URLs
   */
  async getRecentSessions(
    userId: string,
    limit = 10
  ): Promise<PostHogSessionSummary[]> {
    if (!this.isAvailable()) {
      return this.getMockRecentSessions(userId, limit);
    }

    try {
      const query = `
        SELECT
          $session_id as session_id,
          min(timestamp) as started_at,
          max(timestamp) as ended_at,
          dateDiff('millisecond', min(timestamp), max(timestamp)) as duration,
          groupArray(distinct properties.module) as modules
        FROM events
        WHERE distinct_id = '${userId}'
          AND $session_id IS NOT NULL
          AND timestamp > now() - interval 30 day
        GROUP BY $session_id
        ORDER BY started_at DESC
        LIMIT ${limit}
      `;

      const result = await this.executeHogQLQuery(query);

      if (result && result.results) {
        return result.results.map((r: unknown[]) => {
          const sessionId = r[0] as string;
          const modules = (r[4] as string[]).filter((m) => m != null);

          return {
            sessionId,
            startedAt: new Date(r[1] as string),
            endedAt: r[2] ? new Date(r[2] as string) : null,
            duration: r[3] as number,
            modules,
            replayUrl: this.getSessionReplayUrl(sessionId),
            hasRecording: true, // Assume recording is available
          };
        });
      }
    } catch (error) {
      console.error("[PostHogUserAnalytics] Failed to get recent sessions:", error);
    }

    return this.getMockRecentSessions(userId, limit);
  }

  /**
   * Get the URL for PostHog session replay
   */
  getSessionReplayUrl(sessionId: string): string {
    return `https://us.posthog.com/project/${POSTHOG_PROJECT_ID}/replay/${sessionId}`;
  }

  /**
   * Execute a HogQL query against the PostHog API
   */
  private async executeHogQLQuery(
    query: string
  ): Promise<{ results: unknown[][] } | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await fetch(
        `${POSTHOG_API_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            query: {
              kind: "HogQLQuery",
              query,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`PostHog API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[PostHogUserAnalytics] Query failed:", error);
      return null;
    }
  }

  /**
   * Convert time period to HogQL interval
   */
  private getPeriodInterval(period: TimePeriod): string {
    switch (period) {
      case "today":
        return "1 day";
      case "week":
        return "7 day";
      case "month":
        return "30 day";
      case "all":
        return "365 day";
    }
  }

  // ============================================
  // Mock data for when PostHog API is unavailable
  // ============================================

  private getMockEngagementSummary(_userId: string): UserEngagementSummary {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    return {
      lastActiveAt: twoHoursAgo.toISOString(),
      memberSince: threeMonthsAgo.toISOString(),
      sessionsCount: 4,
      avgSessionDuration: 12 * 60 * 1000, // 12 minutes
      totalTimeSpent: 48 * 60 * 1000, // 48 minutes total
    };
  }

  private getMockActivityBreakdown(_period: TimePeriod): ModuleActivityBreakdown[] {
    return [
      { module: "browse", percentage: 60, eventCount: 120 },
      { module: "create", percentage: 30, eventCount: 60 },
      { module: "learn", percentage: 10, eventCount: 20 },
    ];
  }

  private getMockContentMetrics(): ContentMetrics {
    return {
      sequencesCreated: 12,
      sequencesSaved: 8,
      sequencesExported: 3,
      collectionsCreated: 1,
      sequencesShared: 2,
    };
  }

  private getMockRecentSessions(
    _userId: string,
    limit: number
  ): PostHogSessionSummary[] {
    const now = new Date();
    const sessions: PostHogSessionSummary[] = [];

    // Generate mock sessions
    const mockSessionData = [
      { hoursAgo: 2, duration: 12, modules: ["browse", "create"] },
      { hoursAgo: 26, duration: 18, modules: ["create", "learn"] },
      { hoursAgo: 72, duration: 5, modules: ["browse"] },
      { hoursAgo: 120, duration: 25, modules: ["create", "browse", "learn"] },
      { hoursAgo: 168, duration: 8, modules: ["settings", "browse"] },
    ];

    for (let i = 0; i < Math.min(limit, mockSessionData.length); i++) {
      const data = mockSessionData[i]!;
      const startedAt = new Date(now.getTime() - data.hoursAgo * 60 * 60 * 1000);
      const endedAt = new Date(startedAt.getTime() + data.duration * 60 * 1000);
      const sessionId = `mock-session-${i}-${Date.now()}`;

      sessions.push({
        sessionId,
        startedAt,
        endedAt,
        duration: data.duration * 60 * 1000,
        modules: data.modules,
        replayUrl: this.getSessionReplayUrl(sessionId),
        hasRecording: true,
      });
    }

    return sessions;
  }
}
