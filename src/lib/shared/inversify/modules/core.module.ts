import type { ContainerModuleLoadOptions } from "inversify";
import { ContainerModule } from "inversify";
import { createSafeBinder } from "../hmr/safeBind";

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
import { WordDeriver } from "../../foundation/services/implementations/WordDeriver";
import { TYPES } from "../types";

// ============================================================================
// HMR STATE PRESERVATION
// ============================================================================
// These state instances must persist across HMR cycles to preserve user state.
// We use import.meta.hot.data to cache them during module disposal.

const hmrData = import.meta.hot?.data as {
  appState?: ReturnType<typeof createAppState>;
  appStateInitializer?: ReturnType<typeof createAppStateInitializer>;
  performanceMetricsState?: ReturnType<typeof createPerformanceMetricsState>;
} | undefined;

// Restore from HMR cache or create new instances
const appState = hmrData?.appState ?? createAppState();
const appStateInitializer = hmrData?.appStateInitializer ?? createAppStateInitializer();
const performanceMetricsState = hmrData?.performanceMetricsState ?? createPerformanceMetricsState();

// Cache instances on HMR dispose
if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.appState = appState;
    data.appStateInitializer = appStateInitializer;
    data.performanceMetricsState = performanceMetricsState;
  });
}

export const coreModule = new ContainerModule(
  (options: ContainerModuleLoadOptions) => {
    // Use safe binder to prevent duplicate bindings during HMR
    const bind = createSafeBinder(options);

    // === APPLICATION SERVICES ===
    bind(TYPES.IApplicationInitializer).to(ApplicationInitializer);
    bind(TYPES.IResourceTracker).to(ResourceTracker);
    bind(TYPES.IComponentManager).to(ComponentManager);
    bind(TYPES.IErrorHandler).to(ErrorHandler);
    bind(TYPES.IHapticFeedback).to(HapticFeedback);
    bind(TYPES.IRippleEffect).to(RippleEffect);

    // === AUTH SERVICES ===
    bind(TYPES.IAuthenticator).to(Authenticator);
    bind(TYPES.IProfilePictureManager)
      .to(ProfilePictureManager)
      .inSingletonScope();
    bind(TYPES.IUserDocumentManager)
      .to(UserDocumentManager)
      .inSingletonScope();
    bind(TYPES.ISubscriptionManager)
      .to(SubscriptionManager)
      .inSingletonScope();
    bind(TYPES.IProfileApiClient).to(ProfileApiClient);
    bind(TYPES.IStepUpAuthCoordinator)
      .to(StepUpAuthCoordinator)
      .inSingletonScope();
    bind(TYPES.IAccountManager).to(AccountManager);
    bind(TYPES.IUsernameValidator)
      .to(UsernameValidator)
      .inSingletonScope();

    // === MOBILE SERVICES ===
    bind(TYPES.IMobileFullscreenManager).to(MobileFullscreenManager);
    bind(TYPES.IPlatformDetector).to(PlatformDetector);
    bind(TYPES.IGestureHandler).to(GestureHandler);
    bind(TYPES.IPWAEngagementTracker).to(PWAEngagementTracker);
    bind(TYPES.IPWAInstallDismissalManager)
      .to(PWAInstallDismissalManager);

    // === DEVICE SERVICES ===
    bind(TYPES.IViewportManager).to(ViewportManager).inSingletonScope();
    bind(TYPES.IDeviceDetector).to(DeviceDetector).inSingletonScope();

    // === FOUNDATION SERVICES ===
    bind(TYPES.IWordDeriver).to(WordDeriver).inSingletonScope();
    bind(TYPES.IFileDownloader).to(FileDownloader);
    bind(TYPES.IStorageManager).to(StorageManager);
    bind(TYPES.ISeoManager).to(SeoManager);
    bind(TYPES.ISvgImageConverter).to(SvgImageConverter);

    // === SETTINGS SERVICES ===
    // Use the module-level singleton to ensure there's only ONE instance app-wide
    // Previously .to(SettingsState).inSingletonScope() created a separate DI instance
    bind(TYPES.ISettingsState).toConstantValue(settingsService);
    bind(TYPES.ISettingsPersister)
      .to(FirebaseSettingsPersister)
      .inSingletonScope();

    // === ONBOARDING SERVICES ===
    bind(TYPES.IOnboardingPersister)
      .to(OnboardingPersister)
      .inSingletonScope();

    // === LIBRARY SERVICES ===
    bind(TYPES.ITagManager).to(TagManager).inSingletonScope();

    // === STATE SERVICES ===
    // Use module-level instances that persist across HMR
    bind(TYPES.IAppState).toConstantValue(appState);
    bind(TYPES.IAppStateInitializer).toConstantValue(appStateInitializer);
    bind(TYPES.IPerformanceMetricsState).toConstantValue(performanceMetricsState);
  }
);
