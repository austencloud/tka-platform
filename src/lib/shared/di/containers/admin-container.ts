/**
 * Admin Container - ITI Dependency Injection Configuration
 *
 * Registers all admin services with the ITI container.
 * External dependencies (IActivityLogger, IPresenceTracker) must be provided
 * when composing this container with the root container.
 */

import { createContainer } from "iti";

// Service implementations
import { SystemStateManager } from "$lib/features/admin/services/implementations/SystemStateManager";
import { AuditLogger } from "$lib/features/admin/services/implementations/AuditLogger";
import { AdminChallengeManager } from "$lib/features/admin/services/implementations/AdminChallengeManager";
import { UserMetricsAnalyzer } from "$lib/features/admin/services/implementations/UserMetricsAnalyzer";
import { EventActivityAnalyzer } from "$lib/features/admin/services/implementations/EventActivityAnalyzer";
import { ContentQueryAnalyzer } from "$lib/features/admin/services/implementations/ContentQueryAnalyzer";
import { AnalyticsDataProvider } from "$lib/features/admin/services/implementations/AnalyticsDataProvider";
import { AnnouncementManager } from "$lib/features/admin/services/implementations/AnnouncementManager";
import { UserActivityTracker } from "$lib/features/admin/services/implementations/UserActivityTracker";
import { PostHogUserAnalytics } from "$lib/features/admin/services/implementations/PostHogUserAnalytics";
import { PostHogAnalyticsProvider } from "$lib/features/admin/services/implementations/PostHogAnalyticsProvider";
import { QuickAccessPersister } from "$lib/shared/debug/services/implementations/QuickAccessPersister";

// Service contracts
import type { ISystemStateManager } from "$lib/features/admin/services/contracts/ISystemStateManager";
import type { IAuditLogger } from "$lib/features/admin/services/contracts/IAuditLogger";
import type { IAdminChallengeManager } from "$lib/features/admin/services/contracts/IAdminChallengeManager";
import type { IAnalyticsDataProvider } from "$lib/features/admin/services/contracts/IAnalyticsDataProvider";
import type { IAnnouncementManager } from "$lib/features/admin/services/contracts/IAnnouncementManager";
import type { IUserActivityTracker } from "$lib/features/admin/services/contracts/IUserActivityTracker";
import type { IPostHogUserAnalytics } from "$lib/features/admin/services/contracts/IPostHogUserAnalytics";
import type { IPostHogAnalyticsProvider } from "$lib/features/admin/services/contracts/IPostHogAnalyticsProvider";
import type { IQuickAccessPersister } from "$lib/shared/debug/services/contracts/IQuickAccessPersister";
import type { IUserMetricsAnalyzer } from "$lib/features/admin/services/implementations/UserMetricsAnalyzer";
import type { IEventActivityAnalyzer } from "$lib/features/admin/services/implementations/EventActivityAnalyzer";
import type { IContentQueryAnalyzer } from "$lib/features/admin/services/implementations/ContentQueryAnalyzer";

// External dependencies (from other modules)
import type { IActivityLogger } from "$lib/shared/analytics/services/contracts/IActivityLogger";
import type { IPresenceTracker } from "$lib/shared/presence/services/contracts/IPresenceTracker";

/**
 * External dependencies required by the admin container.
 * These must be provided when composing with the root container.
 */
export interface AdminContainerDeps {
  activityLogger: IActivityLogger;
  presenceTracker: IPresenceTracker;
}

/**
 * Create the admin container with external dependencies injected.
 */
export function createAdminContainer(deps: AdminContainerDeps) {
  return createContainer()
    // Layer 1: Services with no internal dependencies
    .add({
      auditLogger: (): IAuditLogger => new AuditLogger(),
      contentQueryAnalyzer: (): IContentQueryAnalyzer =>
        new ContentQueryAnalyzer(),
      announcementManager: (): IAnnouncementManager => new AnnouncementManager(),
      quickAccessPersister: (): IQuickAccessPersister =>
        new QuickAccessPersister(),
      postHogUserAnalytics: (): IPostHogUserAnalytics =>
        new PostHogUserAnalytics(),
      postHogAnalyticsProvider: (): IPostHogAnalyticsProvider =>
        new PostHogAnalyticsProvider(),
    })
    // Layer 2: Services depending on external deps
    .add({
      systemStateManager: (): ISystemStateManager =>
        new SystemStateManager(deps.activityLogger),
      eventActivityAnalyzer: (): IEventActivityAnalyzer =>
        new EventActivityAnalyzer(deps.activityLogger),
      userActivityTracker: (): IUserActivityTracker =>
        new UserActivityTracker(deps.presenceTracker),
    })
    // Layer 3: Services depending on Layer 2
    .add((ctx) => ({
      userMetricsAnalyzer: (): IUserMetricsAnalyzer =>
        new UserMetricsAnalyzer(ctx.systemStateManager),
      adminChallengeManager: (): IAdminChallengeManager =>
        new AdminChallengeManager(ctx.auditLogger),
    }))
    // Layer 4: Orchestrators
    .add((ctx) => ({
      analyticsDataProvider: (): IAnalyticsDataProvider =>
        new AnalyticsDataProvider(
          ctx.userMetricsAnalyzer,
          ctx.eventActivityAnalyzer,
          ctx.contentQueryAnalyzer
        ),
    }));
}

/**
 * Type representing the admin container instance.
 */
export type AdminContainer = ReturnType<typeof createAdminContainer>;
