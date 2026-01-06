import type { ContainerModuleLoadOptions } from "inversify";
import { ContainerModule } from "inversify";

// PERFORMANCE FIX: Import services directly to avoid circular dependencies
import { ApplicationInitializer } from "../../application/services/implementations/ApplicationInitializer";
import { ComponentManager } from "../../application/services/implementations/ComponentManager";
import { ErrorHandler } from "../../application/services/implementations/ErrorHandler";
import { HapticFeedback } from "../../application/services/implementations/HapticFeedback";
import { ResourceTracker } from "../../application/services/implementations/ResourceTracker";
import { RippleEffect } from "../../application/services/implementations/RippleEffect";
import { Authenticator } from "../../auth/services/implementations/Authenticator";
import { ProfilePictureManager } from "../../auth/services/implementations/ProfilePictureManager";
import { UserDocumentManager } from "../../auth/services/implementations/UserDocumentManager";
import { ProfileApiClient } from "../../auth/services/implementations/ProfileApiClient";
import { StepUpAuthCoordinator } from "../../auth/services/implementations/StepUpAuthCoordinator.svelte";
import { AccountManager } from "../../auth/services/implementations/AccountManager";
import { UsernameValidator } from "../../auth/services/implementations/UsernameValidator";
import { SubscriptionManager } from "../../subscription/services/implementations/SubscriptionManager";
import { createAppState } from "../../application/state/app-state-factory.svelte";
import { createPerformanceMetricsState } from "../../application/state/PerformanceMetricsState.svelte";
import { DeviceDetector } from "../../device/services/implementations/DeviceDetector";
import { ViewportManager } from "../../device/services/implementations/ViewportManager.svelte";
import { createAppStateInitializer } from "../../foundation/services/implementations/data/app-state-initializer.svelte";
import { FileDownloader } from "../../foundation/services/implementations/FileDownloader";
import { SeoManager } from "../../foundation/services/implementations/SeoManager";
import { StorageManager } from "../../foundation/services/implementations/StorageManager";
import { SvgImageConverter } from "../../foundation/services/implementations/SvgImageConverter";
import { MobileFullscreenManager } from "../../mobile/services/implementations/MobileFullscreenManager";
import { PlatformDetector } from "../../mobile/services/implementations/PlatformDetector";
import { GestureHandler } from "../../mobile/services/implementations/GestureHandler";
import { PWAEngagementTracker } from "../../mobile/services/implementations/PWAEngagementTracker";
import { PWAInstallDismissalManager } from "../../mobile/services/implementations/PWAInstallDismissalManager";
import { settingsService } from "../../settings/state/SettingsState.svelte";
import { FirebaseSettingsPersister } from "../../settings/services/implementations/FirebaseSettingsPersister";
import { OnboardingPersister } from "../../onboarding/services/implementations/OnboardingPersister";
import { TagManager } from "../../../features/library/services/implementations/TagManager";
import { TYPES } from "../types";

export const coreModule = new ContainerModule(
  (options: ContainerModuleLoadOptions) => {
    // === APPLICATION SERVICES ===
    options.bind(TYPES.IApplicationInitializer).to(ApplicationInitializer);
    options.bind(TYPES.IResourceTracker).to(ResourceTracker);
    options.bind(TYPES.IComponentManager).to(ComponentManager);
    options.bind(TYPES.IErrorHandler).to(ErrorHandler);
    options.bind(TYPES.IHapticFeedback).to(HapticFeedback);
    options.bind(TYPES.IRippleEffect).to(RippleEffect);

    // === AUTH SERVICES ===
    options.bind(TYPES.IAuthenticator).to(Authenticator);
    options
      .bind(TYPES.IProfilePictureManager)
      .to(ProfilePictureManager)
      .inSingletonScope();
    options
      .bind(TYPES.IUserDocumentManager)
      .to(UserDocumentManager)
      .inSingletonScope();
    options
      .bind(TYPES.ISubscriptionManager)
      .to(SubscriptionManager)
      .inSingletonScope();
    options.bind(TYPES.IProfileApiClient).to(ProfileApiClient);
    options
      .bind(TYPES.IStepUpAuthCoordinator)
      .to(StepUpAuthCoordinator)
      .inSingletonScope();
    options.bind(TYPES.IAccountManager).to(AccountManager);
    options
      .bind(TYPES.IUsernameValidator)
      .to(UsernameValidator)
      .inSingletonScope();

    // === MOBILE SERVICES ===
    options.bind(TYPES.IMobileFullscreenManager).to(MobileFullscreenManager);
    options.bind(TYPES.IPlatformDetector).to(PlatformDetector);
    options.bind(TYPES.IGestureHandler).to(GestureHandler);
    options.bind(TYPES.IPWAEngagementTracker).to(PWAEngagementTracker);
    options
      .bind(TYPES.IPWAInstallDismissalManager)
      .to(PWAInstallDismissalManager);

    // === DEVICE SERVICES ===
    options.bind(TYPES.IViewportManager).to(ViewportManager).inSingletonScope();
    options.bind(TYPES.IDeviceDetector).to(DeviceDetector).inSingletonScope();

    // === FOUNDATION SERVICES ===
    options.bind(TYPES.IFileDownloader).to(FileDownloader);
    options.bind(TYPES.IStorageManager).to(StorageManager);
    options.bind(TYPES.ISeoManager).to(SeoManager);
    options.bind(TYPES.ISvgImageConverter).to(SvgImageConverter);

    // === SETTINGS SERVICES ===
    // Use the module-level singleton to ensure there's only ONE instance app-wide
    // Previously .to(SettingsState).inSingletonScope() created a separate DI instance
    options.bind(TYPES.ISettingsState).toConstantValue(settingsService);
    options
      .bind(TYPES.ISettingsPersister)
      .to(FirebaseSettingsPersister)
      .inSingletonScope();

    // === ONBOARDING SERVICES ===
    options
      .bind(TYPES.IOnboardingPersister)
      .to(OnboardingPersister)
      .inSingletonScope();

    // === LIBRARY SERVICES ===
    options.bind(TYPES.ITagManager).to(TagManager).inSingletonScope();

    // === STATE SERVICES ===
    options.bind(TYPES.IAppState).toConstantValue(createAppState());
    options
      .bind(TYPES.IAppStateInitializer)
      .toConstantValue(createAppStateInitializer());
    options
      .bind(TYPES.IPerformanceMetricsState)
      .toConstantValue(createPerformanceMetricsState());
  }
);
