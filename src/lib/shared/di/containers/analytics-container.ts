/**
 * Analytics Container - ITI Dependency Injection
 *
 * Factory-based container for analytics services.
 * PostHog handles session tracking internally, so SessionTracker
 * is still available for backward compatibility but not required
 * by PostHogActivityLogger.
 */

import { createContainer } from "iti";
import { SessionTracker } from "../../analytics/services/implementations/SessionTracker";
import { PostHogActivityLogger } from "../../analytics/services/implementations/PostHogActivityLogger";

export const analyticsContainer = createContainer()
  .add({
    sessionTracker: () => new SessionTracker(),
  })
  .add({
    activityLogger: () => new PostHogActivityLogger(),
  });

export type AnalyticsContainer = typeof analyticsContainer;
