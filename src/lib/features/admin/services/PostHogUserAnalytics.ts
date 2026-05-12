/**
 * PostHog User Analytics Implementation
 *
 * Fetches user analytics via the server-side proxy at /api/admin/analytics.
 * The proxy handles PostHog API authentication so the personal API key
 * stays server-side.
 *
 * Falls back to mock data when the API is unavailable or returns errors.
 */

import { browser } from "$app/environment";
import { auth } from "$lib/shared/auth/firebase";
import type { UserEngagementSummary, ModuleActivityBreakdown, ContentMetrics, PostHogSessionSummary, TimePeriod } from "./types";

const POSTHOG_PROJECT_ID = "299320";

export class PostHogUserAnalytics {
  private available: boolean | null = null;

  isAvailable(): boolean {
    return browser && this.available !== false;
  }

  async getEngagementSummary(userId: string): Promise<UserEngagementSummary> {
    try {
      // Fetch engagement basics and sessions in parallel
      const [engData, sessions] = await Promise.all([
        this.query("engagement", userId),
        this.query("sessions", userId, { limit: 50 }),
      ]);

      if (engData.results?.length > 0) {
        const [lastActive, sessionsCount] = engData.results[0] as [string, number];

        // Compute duration from sessions data (duration is index 3, in ms)
        let totalDurationMs = 0;
        if (sessions.results?.length > 0) {
          for (const row of sessions.results) {
            totalDurationMs += (row[3] as number) || 0;
          }
        }

        const count = sessionsCount || 0;
        const avgDuration = count > 0 ? totalDurationMs / count : 0;

        this.available = true;
        return {
          lastActiveAt: lastActive,
          memberSince: null,
          sessionsCount: count,
          avgSessionDuration: avgDuration,
          totalTimeSpent: totalDurationMs,
        };
      }
    } catch (err) {
      console.error("[PostHogUserAnalytics] Engagement query failed:", err);
    }

    return this.getMockEngagementSummary();
  }

  async getActivityBreakdown(
    userId: string,
    period: TimePeriod
  ): Promise<ModuleActivityBreakdown[]> {
    try {
      const data = await this.query("activity", userId, { period });

      if (data.results?.length > 0) {
        const total = data.results.reduce(
          (sum: number, r: unknown[]) => sum + (r[1] as number),
          0
        );

        this.available = true;
        return data.results.map((r: unknown[]) => ({
          module: r[0] as string,
          eventCount: r[1] as number,
          percentage:
            total > 0 ? Math.round(((r[1] as number) / total) * 100) : 0,
        }));
      }
    } catch (err) {
      console.error("[PostHogUserAnalytics] Activity query failed:", err);
    }

    return this.getMockActivityBreakdown();
  }

  async getContentMetrics(userId: string): Promise<ContentMetrics> {
    try {
      const data = await this.query("content", userId);

      if (data.results) {
        const metrics: ContentMetrics = {
          sequencesCreated: 0,
          sequencesSaved: 0,
          sequencesExported: 0,
          collectionsCreated: 0,
          sequencesShared: 0,
        };

        for (const [event, count] of data.results) {
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

        this.available = true;
        return metrics;
      }
    } catch (err) {
      console.error("[PostHogUserAnalytics] Content query failed:", err);
    }

    return this.getMockContentMetrics();
  }

  async getRecentSessions(
    userId: string,
    limit = 10
  ): Promise<PostHogSessionSummary[]> {
    try {
      const data = await this.query("sessions", userId, { limit });

      if (data.results?.length > 0) {
        this.available = true;
        return data.results.map((r: unknown[]) => {
          const sessionId = r[0] as string;
          const modules = (r[4] as string[]).filter((m) => m != null);

          return {
            sessionId,
            startedAt: new Date(r[1] as string),
            endedAt: r[2] ? new Date(r[2] as string) : null,
            duration: r[3] as number,
            modules,
            replayUrl: this.getSessionReplayUrl(sessionId),
            hasRecording: true,
          };
        });
      }
    } catch (err) {
      console.error("[PostHogUserAnalytics] Sessions query failed:", err);
    }

    return this.getMockRecentSessions(limit);
  }

  getSessionReplayUrl(sessionId: string): string {
    return `https://us.posthog.com/project/${POSTHOG_PROJECT_ID}/replay/${sessionId}`;
  }

  /**
   * Call the server-side analytics proxy.
   * Throws on non-2xx responses so callers fall back to mock data.
   */
  private async query(
    type: string,
    userId: string,
    extra?: Record<string, unknown>
  ): Promise<{ results: unknown[][] }> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("Not signed in");
    }
    const token = await user.getIdToken();

    const response = await fetch("/api/admin/analytics", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type, userId, ...extra }),
    });

    if (!response.ok) {
      throw new Error(`Analytics proxy returned ${response.status}`);
    }

    const body = await response.json();

    if (!body.success) {
      throw new Error(body.message ?? "Unknown error");
    }

    return { results: body.results };
  }

  // ============================================
  // Mock data for when the API is unavailable
  // ============================================

  private getMockEngagementSummary(): UserEngagementSummary {
    const now = new Date();
    return {
      lastActiveAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      memberSince: new Date(
        now.getTime() - 90 * 24 * 60 * 60 * 1000
      ).toISOString(),
      sessionsCount: 4,
      avgSessionDuration: 12 * 60 * 1000,
      totalTimeSpent: 48 * 60 * 1000,
    };
  }

  private getMockActivityBreakdown(): ModuleActivityBreakdown[] {
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

  private getMockRecentSessions(limit: number): PostHogSessionSummary[] {
    const now = new Date();
    const mockSessionData = [
      { hoursAgo: 2, duration: 12, modules: ["browse", "create"] },
      { hoursAgo: 26, duration: 18, modules: ["create", "learn"] },
      { hoursAgo: 72, duration: 5, modules: ["browse"] },
      { hoursAgo: 120, duration: 25, modules: ["create", "browse", "learn"] },
      { hoursAgo: 168, duration: 8, modules: ["settings", "browse"] },
    ];

    return mockSessionData.slice(0, limit).map((data, i) => {
      const startedAt = new Date(
        now.getTime() - data.hoursAgo * 60 * 60 * 1000
      );
      const endedAt = new Date(
        startedAt.getTime() + data.duration * 60 * 1000
      );
      const sessionId = `mock-session-${i}-${Date.now()}`;

      return {
        sessionId,
        startedAt,
        endedAt,
        duration: data.duration * 60 * 1000,
        modules: data.modules,
        replayUrl: this.getSessionReplayUrl(sessionId),
        hasRecording: true,
      };
    });
  }
}
