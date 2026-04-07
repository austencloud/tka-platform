/**
 * Core Container - ITI Implementation
 *
 * Converted from Inversify core.module.ts
 * Contains core application services, auth, mobile, device, and foundation services.
 */

import { createContainer } from "iti";

// Application services
import { ApplicationInitializer } from "../../application/services/implementations/ApplicationInitializer";
import { ComponentManager } from "../../application/services/implementations/ComponentManager";
import { ErrorHandler } from "../../application/services/implementations/ErrorHandler";
import { HapticFeedback } from "../../application/services/implementations/HapticFeedback";
import { ResourceTracker } from "../../application/services/implementations/ResourceTracker";
import { RippleEffect } from "../../application/services/implementations/RippleEffect";

// Auth services
import { Authenticator } from "../../auth/services/implementations/Authenticator";
import { ProfilePictureManager } from "../../auth/services/implementations/ProfilePictureManager";
import { UserDocumentManager } from "../../auth/services/implementations/UserDocumentManager";
import { AccountManager } from "../../auth/services/implementations/AccountManager";
import { UsernameValidator } from "../../auth/services/implementations/UsernameValidator";

// Subscription services
import { SubscriptionManager } from "../../subscription/services/implementations/SubscriptionManager";
import { PremiumGateChecker } from "../../subscription/services/implementations/PremiumGateChecker";

// Device services — import the module-level singletons, NOT the classes
// These are the single source of truth for viewport/device state.
// Creating new instances would cause dual-singleton bugs (two resize listeners,
// two caches, divergent state during resize/initialization).
import { deviceDetector as deviceDetectorSingleton } from "../../device/services/implementations/DeviceDetector";
import { viewportManager as viewportManagerSingleton } from "../../device/services/implementations/ViewportManager.svelte";

// Mobile services
import { MobileFullscreenManager } from "../../mobile/services/implementations/MobileFullscreenManager";
import { PlatformDetector } from "../../mobile/services/implementations/PlatformDetector";
import { GestureHandler } from "../../mobile/services/implementations/GestureHandler";
import { PWAEngagementTracker } from "../../mobile/services/implementations/PWAEngagementTracker";
import { PWAInstallDismissalManager } from "../../mobile/services/implementations/PWAInstallDismissalManager";

// Foundation services
import { FileDownloader } from "../../foundation/services/implementations/FileDownloader";
import { SeoManager } from "../../foundation/services/implementations/SeoManager";
import { StorageManager } from "../../foundation/services/implementations/StorageManager";
import { SvgImageConverter } from "../../foundation/services/implementations/SvgImageConverter";
import { WordDeriver } from "../../foundation/services/implementations/WordDeriver";

// Settings services
import { settingsService } from "../../settings/state/SettingsState.svelte";
import { FirebaseSettingsPersister } from "../../settings/services/implementations/FirebaseSettingsPersister";

// Feature flag services
import { GlobalFeatureFlagPersister } from "../../auth/services/implementations/GlobalFeatureFlagPersister";
import { UserFeatureFlagPersister } from "../../auth/services/implementations/UserFeatureFlagPersister";

// Onboarding services
import { OnboardingPersister } from "../../onboarding/services/implementations/OnboardingPersister";

// Offline services
import { ConflictResolver } from "../../offline/services/implementations/ConflictResolver";

// Library services
import { TagManager } from "../../../features/library/services/implementations/TagManager";

// State factories
import { createAppState } from "../../application/state/app-state-factory.svelte";
import { createPerformanceMetricsState } from "../../application/state/PerformanceMetricsState.svelte";
import { createAppStateInitializer } from "../../foundation/services/implementations/data/app-state-initializer.svelte";

// ============================================================================
// HMR STATE PRESERVATION
// ============================================================================
// These state instances must persist across HMR cycles to preserve user state.
// We use import.meta.hot.data to cache them during module disposal.

const hmrData = import.meta.hot?.data as
  | {
      appState?: ReturnType<typeof createAppState>;
      appStateInitializer?: ReturnType<typeof createAppStateInitializer>;
      performanceMetricsState?: ReturnType<typeof createPerformanceMetricsState>;
    }
  | undefined;

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

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================
// Services that need to be singletons are instantiated once at module level

// Device services — reuse the module-level singletons (single source of truth)
const viewportManager = viewportManagerSingleton;
const deviceDetector = deviceDetectorSingleton;

// Auth services (singletons)
const profilePictureManager = new ProfilePictureManager();
const usernameValidator = new UsernameValidator();
const userDocumentManager = new UserDocumentManager(profilePictureManager, usernameValidator);
const subscriptionManager = new SubscriptionManager();
const premiumGateChecker = new PremiumGateChecker();
// Settings services (singletons)
const firebaseSettingsPersister = new FirebaseSettingsPersister();

// Feature flag services (singletons)
const globalFeatureFlagPersister = new GlobalFeatureFlagPersister();
const userFeatureFlagPersister = new UserFeatureFlagPersister();

// Onboarding services (singletons)
const onboardingPersister = new OnboardingPersister();

// Offline services (singletons)
const conflictResolver = new ConflictResolver();

// Library services (singletons)
const tagManager = new TagManager();

// Foundation services (singletons)
const wordDeriver = new WordDeriver();

// ============================================================================
// CONTAINER DEFINITION
// ============================================================================

export const coreContainer = createContainer()
  // === STATE SERVICES (HMR-preserved singletons) ===
  .add({
    appState: () => appState,
    appStateInitializer: () => appStateInitializer,
    performanceMetricsState: () => performanceMetricsState,
  })
  // === SETTINGS SERVICES (module singleton) ===
  .add({
    settingsState: () => settingsService,
    settingsPersister: () => firebaseSettingsPersister,
    globalFeatureFlagPersister: () => globalFeatureFlagPersister,
    userFeatureFlagPersister: () => userFeatureFlagPersister,
  })
  // === DEVICE SERVICES (singletons) ===
  .add({
    viewportManager: () => viewportManager,
    deviceDetector: () => deviceDetector,
  })
  // === APPLICATION SERVICES (transient - new instance each time) ===
  .add({
    applicationInitializer: () => new ApplicationInitializer(),
    resourceTracker: () => new ResourceTracker(),
    componentManager: () => new ComponentManager(),
    errorHandler: () => new ErrorHandler(),
    hapticFeedback: () => new HapticFeedback(),
    rippleEffect: () => new RippleEffect(),
  })
  // === AUTH SERVICES (mix of singletons and transient) ===
  .add({
    authenticator: () => new Authenticator(),
    profilePictureManager: () => profilePictureManager,
    userDocumentManager: () => userDocumentManager,
    subscriptionManager: () => subscriptionManager,
    premiumGateChecker: () => premiumGateChecker,
    usernameValidator: () => usernameValidator,
  })
  // === ACCOUNT MANAGER ===
  .add((deps) => ({
    accountManager: () => new AccountManager(deps.hapticFeedback),
  }))
  // === MOBILE SERVICES ===
  .add({
    mobileFullscreenManager: () => new MobileFullscreenManager(),
    platformDetector: () => new PlatformDetector(),
    gestureHandler: () => new GestureHandler(),
    pwaEngagementTracker: () => new PWAEngagementTracker(),
    pwaInstallDismissalManager: () => new PWAInstallDismissalManager(),
  })
  // === FOUNDATION SERVICES ===
  .add({
    wordDeriver: () => wordDeriver,
    fileDownloader: () => new FileDownloader(),
    storageManager: () => new StorageManager(),
    seoManager: () => new SeoManager(),
    svgImageConverter: () => new SvgImageConverter(),
  })
  // === ONBOARDING SERVICES ===
  .add({
    onboardingPersister: () => onboardingPersister,
  })
  // === LIBRARY SERVICES ===
  .add({
    tagManager: () => tagManager,
  })
  // === OFFLINE SERVICES ===
  .add({
    conflictResolver: () => conflictResolver,
  });

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CoreContainer = typeof coreContainer;
