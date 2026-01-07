/**
 * Admin Module - InversifyJS DI Container Configuration
 *
 * Registers all admin services with the dependency injection container.
 */

import { ContainerModule, type ContainerModuleLoadOptions } from "inversify";
import { TYPES } from "../types";
import type { ISystemStateManager } from "../../../features/admin/services/contracts/ISystemStateManager";
import type { IAuditLogger } from "../../../features/admin/services/contracts/IAuditLogger";
import type { IAdminChallengeManager } from "../../../features/admin/services/contracts/IAdminChallengeManager";
import type { IAnalyticsDataProvider } from "../../../features/admin/services/contracts/IAnalyticsDataProvider";
import type { IAnnouncementManager } from "../../../features/admin/services/contracts/IAnnouncementManager";
import type { IUserActivityTracker } from "../../../features/admin/services/contracts/IUserActivityTracker";
import type { IQuickAccessPersister } from "../../debug/services/contracts/IQuickAccessPersister";
import type { IUserMetricsAnalyzer } from "../../../features/admin/services/implementations/UserMetricsAnalyzer";
import type { IEventActivityAnalyzer } from "../../../features/admin/services/implementations/EventActivityAnalyzer";
import type { IContentQueryAnalyzer } from "../../../features/admin/services/implementations/ContentQueryAnalyzer";
import { SystemStateManager } from "../../../features/admin/services/implementations/SystemStateManager";
import { AuditLogger } from "../../../features/admin/services/implementations/AuditLogger";
import { AdminChallengeManager } from "../../../features/admin/services/implementations/AdminChallengeManager";
import { AnalyticsDataProvider } from "../../../features/admin/services/implementations/AnalyticsDataProvider";
import { UserMetricsAnalyzer } from "../../../features/admin/services/implementations/UserMetricsAnalyzer";
import { EventActivityAnalyzer } from "../../../features/admin/services/implementations/EventActivityAnalyzer";
import { ContentQueryAnalyzer } from "../../../features/admin/services/implementations/ContentQueryAnalyzer";
import { AnnouncementManager } from "../../../features/admin/services/implementations/AnnouncementManager";
import { UserActivityTracker } from "../../../features/admin/services/implementations/UserActivityTracker";
import { QuickAccessPersister } from "../../debug/services/implementations/QuickAccessPersister";

export const adminModule = new ContainerModule(
  (options: ContainerModuleLoadOptions) => {
    // System State Service (foundation for all admin views)
    options
      .bind<ISystemStateManager>(TYPES.ISystemStateManager)
      .to(SystemStateManager)
      .inSingletonScope();

    // Audit Log Service (accountability and debugging)
    options
      .bind<IAuditLogger>(TYPES.IAuditLogger)
      .to(AuditLogger)
      .inSingletonScope();

    // Admin Challenge Service
    options
      .bind<IAdminChallengeManager>(TYPES.IAdminChallengeManager)
      .to(AdminChallengeManager)
      .inSingletonScope();

    // Analytics Services (decomposed for single responsibility)
    options
      .bind<IUserMetricsAnalyzer>(TYPES.IUserMetricsAnalyzer)
      .to(UserMetricsAnalyzer)
      .inSingletonScope();

    options
      .bind<IEventActivityAnalyzer>(TYPES.IEventActivityAnalyzer)
      .to(EventActivityAnalyzer)
      .inSingletonScope();

    options
      .bind<IContentQueryAnalyzer>(TYPES.IContentQueryAnalyzer)
      .to(ContentQueryAnalyzer)
      .inSingletonScope();

    // Analytics Data Provider (orchestrates the above analyzers)
    options
      .bind<IAnalyticsDataProvider>(TYPES.IAnalyticsDataProvider)
      .to(AnalyticsDataProvider)
      .inSingletonScope();

    // Announcement Service
    options
      .bind<IAnnouncementManager>(TYPES.IAnnouncementManager)
      .to(AnnouncementManager)
      .inSingletonScope();

    // User Activity Service (admin user monitoring)
    options
      .bind<IUserActivityTracker>(TYPES.IUserActivityTracker)
      .to(UserActivityTracker)
      .inSingletonScope();

    // Quick Access Persister (admin toolbar user shortcuts)
    options
      .bind<IQuickAccessPersister>(TYPES.IQuickAccessPersister)
      .to(QuickAccessPersister)
      .inSingletonScope();
  }
);
