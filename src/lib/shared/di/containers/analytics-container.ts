/**
 * Analytics Container - ITI Dependency Injection
 *
 * Factory-based container for analytics services.
 * PostHog handles session tracking internally - no separate
 * SessionTracker needed.
 */

import { createContainer } from "iti";
import { PostHogActivityLogger } from "../../analytics/services/implementations/PostHogActivityLogger";

export const analyticsContainer = createContainer().add({
  activityLogger: () => new PostHogActivityLogger(),
});

export type AnalyticsContainer = typeof analyticsContainer;
