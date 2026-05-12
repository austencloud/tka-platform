/**
 * PostHog Analytics Provider
 *
 * Provides access to PostHog analytics data for the admin dashboard.
 * Uses client-side PostHog instance for project info and constructs
 * dashboard links. API queries are optional and may require additional setup.
 */

import { browser } from "$app/environment";
import { getPostHogInstance } from "$lib/shared/analytics/services/posthog";
import type { PostHogSummaryMetrics, UserSegments, PostHogDashboardLinks } from "./types";

// PostHog US cloud base URL
const POSTHOG_APP_URL = "https://us.posthog.com";

export class PostHogAnalyticsProvider {
  private cachedProjectId: string | null = null;

  /**
   * Get the PostHog project ID from the initialized instance.
   * The project ID is the API key/token used to initialize PostHog.
   */
  getProjectId(): string | null {
    if (!browser) return null;

    // Return cached value if available
    if (this.cachedProjectId) return this.cachedProjectId;

    const posthog = getPostHogInstance();
    if (!posthog) return null;

    // The token/API key serves as the project identifier for URLs
    // PostHog uses the API key in dashboard URLs
    const token = posthog.config?.token;
    if (token) {
      this.cachedProjectId = token;
      return token;
    }

    return null;
  }

  /**
   * Check if PostHog is initialized and available
   */
  isAvailable(): boolean {
    if (!browser) return false;
    const posthog = getPostHogInstance();
    return posthog !== null;
  }

  /**
   * Get links to PostHog dashboard pages.
   * These link directly to PostHog's UI for full analytics access.
   */
  getDashboardLinks(): PostHogDashboardLinks | null {
    const projectId = this.getProjectId();
    if (!projectId) return null;

    // PostHog dashboard URLs use the project API key in the path
    // Format: https://us.posthog.com/project/{project_api_key}/...
    const baseUrl = `${POSTHOG_APP_URL}/project/${projectId}`;

    return {
      retention: `${baseUrl}/retention`,
      insights: `${baseUrl}/insights`,
      persons: `${baseUrl}/persons`,
      replay: `${baseUrl}/replay/recent`,
      events: `${baseUrl}/events`,
    };
  }

  /**
   * Get summary metrics from PostHog.
   *
   * Note: Full metrics require the PostHog Query API which needs
   * a personal API key with read access. For now, we return null
   * and the dashboard shows placeholder values with links to PostHog.
   *
   * To enable API queries in the future:
   * 1. Create a Personal API Key in PostHog with "Read" access
   * 2. Add it as an environment variable (server-side only)
   * 3. Create a SvelteKit endpoint to proxy queries
   * 4. Use HogQL to query events/persons
   */
  async getSummaryMetrics(): Promise<PostHogSummaryMetrics | null> {
    // API queries require server-side implementation with API key
    // For now, return null to indicate data should come from PostHog UI
    return null;
  }

  /**
   * Get user segment counts.
   *
   * Note: Segment calculation requires HogQL queries against the
   * persons and events tables. This needs server-side API access.
   *
   * Segment definitions:
   * - Creators: users with 5+ "sequence_created" events
   * - Consumers: users with 10+ "sequence_viewed" events but 0 created
   * - Learners: users with 3+ "lesson_completed" events
   * - Lurkers: users with <5 total sessions and no content interactions
   */
  async getUserSegments(): Promise<UserSegments | null> {
    // API queries require server-side implementation with API key
    // For now, return null to indicate data should come from PostHog UI
    return null;
  }
}
