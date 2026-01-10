/**
 * Analytics Container - ITI Dependency Injection
 *
 * Factory-based container for analytics services.
 * SessionTracker must be created first (ActivityLogger depends on it).
 */

import { createContainer } from "iti";
import { SessionTracker } from "../../analytics/services/implementations/SessionTracker";
import { ActivityLogger } from "../../analytics/services/implementations/ActivityLogger";

export const analyticsContainer = createContainer()
  .add({
    sessionTracker: () => new SessionTracker(),
  })
  .add((ctx) => ({
    activityLogger: () => new ActivityLogger(ctx.sessionTracker),
  }));

export type AnalyticsContainer = typeof analyticsContainer;
