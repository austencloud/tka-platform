<!-- Main Application Layout -->
<script lang="ts">
  import AchievementNotificationToast from "../../gamification/components/AchievementNotificationToast.svelte";
  import XPToast from "../../gamification/components/XPToast.svelte";
  import QuickFeedbackPanel from "$lib/features/feedback/components/quick/QuickFeedbackPanel.svelte";
  import AnnouncementChecker from "$lib/features/admin/components/AnnouncementChecker.svelte";
  import WhatsNewChecker from "../../settings/components/WhatsNewChecker.svelte";
  import MigrationChecker from "../../migration/components/MigrationChecker.svelte";
  import ErrorModal from "../../error/components/ErrorModal.svelte";
  import InboxDrawer from "../../inbox/components/InboxDrawer.svelte";
  import InboxSubscriptionProvider from "../../inbox/components/InboxSubscriptionProvider.svelte";
  import MyFeedbackDetail from "$lib/features/feedback/components/my-feedback/MyFeedbackDetail.svelte";
  import { myFeedbackDetailState } from "$lib/features/feedback/state/my-feedback-detail-state.svelte";
  import FirstRunWizard from "../../onboarding/components/first-run/FirstRunWizard.svelte";
  import { firstRunState } from "../../onboarding/state/first-run-state.svelte.ts";

  import { getContext, onMount } from "svelte";
  import MainInterface from "../../MainInterface.svelte";
  import AuthSheet from "../../navigation/components/AuthSheet.svelte";
  import LegalSheet from "../../legal/components/LegalSheet.svelte";
  import type {
    ISheetRouter,
    SheetType,
  } from "../../navigation/services/contracts/ISheetRouter";
  import { authState } from "../../auth/state/authState.svelte";
  import LandingPage from "../../auth/components/LandingPage.svelte";
  import type { IAuthenticator } from "../../auth/services/contracts/IAuthenticator";
  import ErrorScreen from "../../foundation/ui/ErrorScreen.svelte";
  import type { ISettingsState } from "../../settings/services/contracts/ISettingsState";
  import { ThemeService } from "../../theme/services/ThemeService";
  import type { IApplicationInitializer } from "../services/contracts/IApplicationInitializer";
  import {
    getSettings,
    restoreApplicationState,
    updateSettings,
  } from "../state/app-state.svelte";
  import {
    getIsInitialized,
    getInitializationError,
    setInitializationError,
    setInitializationState,
    initializeAppState,
  } from "../state/initialization-state.svelte";
  import type { IDeviceDetector } from "../../device/services/contracts/IDeviceDetector";
  import BackgroundCanvas from "../../background/shared/components/BackgroundCanvas.svelte";
  import { BackgroundType } from "../../background/shared/domain/enums/background-enums";
  import {
    getShowDebugPanel,
    toggleDebugPanel,
  } from "../state/ui/ui-state.svelte";
  import { switchModule } from "../state/ui/module-state";
  import { navigationState } from "../../navigation/state/navigation-state.svelte";
  import type { ModuleId } from "../../navigation/domain/types";
  import { handleModuleChange } from "../../navigation-coordinator/navigation-coordinator.svelte";
  import { container } from "../../di";

  // Get DI container from context
  const getContainer = getContext<() => Container | null>("di-container");

  // Services - resolved lazily
  let initService: IApplicationInitializer | null = $state(null);
  let settingsService: ISettingsState | null = $state(null);
  let deviceService: IDeviceDetector | null = $state(null);
  let sheetRouterService: ISheetRouter | null = $state(null);
  let authService: IAuthenticator | null = $state(null);
  let servicesResolved = $state(false);

  // App state
  let isInitialized = $derived(getIsInitialized());
  let initializationError = $derived(getInitializationError());
  let settings = $derived(getSettings());

  // Auth state for gating
  const isAuthenticated = $derived(authState.isAuthenticated);
  const authLoading = $derived(authState.loading);

  // Route-based sheet state
  let currentSheetType = $state<SheetType>(null);
  let showAuthSheet = $derived(currentSheetType === "auth");
  let showTermsSheet = $derived(currentSheetType === "terms");
  let showPrivacySheet = $derived(currentSheetType === "privacy");

  // Debug panel state (admin-only) - uses centralized UI state
  let showDebugPanel = $derived(getShowDebugPanel());

  // My Feedback Detail drawer state (controlled via global myFeedbackDetailState)
  let feedbackDetailItem = $derived(myFeedbackDetailState.selectedItem);
  let showFeedbackDetail = $derived(myFeedbackDetailState.isOpen);

  // Resolve services from ITI container (synchronous - no async needed)
  $effect(() => {
    if (!servicesResolved) {
      try {
        initService = container.items
          .applicationInitializer as IApplicationInitializer;
        settingsService = container.items.settingsState as ISettingsState;
        deviceService = container.items.deviceDetector as IDeviceDetector;
        sheetRouterService = container.items.sheetRouter as ISheetRouter;
        authService = container.items.authenticator as IAuthenticator;
        servicesResolved = true;
      } catch (error) {
        console.error("Failed to resolve services:", error);
        setInitializationError(`Service resolution failed: ${error}`);
      }
    }
  });

  // Initialize application
  onMount(() => {
    let cleanupSheetListener: (() => void) | null = null;

    // Run async initialization without blocking cleanup function return
    (async () => {
      try {
        setInitializationState(false, true, null, 0);
        // ITI container is created synchronously - no ensureContainerInitialized needed
        await initializeAppState();

        // Services are already resolved from ITI container in $effect above
        // Wait briefly for $effect to run
        await new Promise((resolve) => setTimeout(resolve, 10));

        if (!servicesResolved) {
          console.error("Service resolution failed");
          setInitializationError(
            "Service resolution failed - services not available"
          );
          return;
        }

        if (
          !initService ||
          !settingsService ||
          !deviceService ||
          !sheetRouterService
        ) {
          console.error("Services not properly resolved");
          setInitializationError("Services not properly resolved");
          return;
        }

        // Initialize sheet router state (now that service is resolved)
        currentSheetType = sheetRouterService.getCurrentSheet();

        // Check for legacy ?sheet=settings URL and redirect to settings module
        if (currentSheetType === "settings") {
          sheetRouterService.closeSheet();
          await handleModuleChange("settings" as ModuleId);
        }

        cleanupSheetListener = sheetRouterService.onRouteChange(
          async (state) => {
            // Redirect legacy ?sheet=settings to settings module
            if (state.sheet === "settings") {
              sheetRouterService?.closeSheet();
              await handleModuleChange("settings" as ModuleId);
              return;
            }

            currentSheetType = state.sheet ?? null;
          }
        );

        await restoreApplicationState();
        await initService.initialize();
        await settingsService.loadSettings();
        updateSettings(settingsService.currentSettings);
        ThemeService.initialize();

        // Apply background-based theme colors on startup
        const { applyThemeForBackground } =
          await import("../../settings/utils/background-theme-calculator");
        const bgType = settingsService.currentSettings?.backgroundType;
        if (bgType) {
          applyThemeForBackground(bgType);
        }

        // Initialize gamification system
        try {
          const { initializeGamification } =
            await import("../../gamification/init/gamification-initializer");
          await initializeGamification();
        } catch (gamError) {
          console.error(
            "⚠️ Gamification failed to initialize (non-blocking):",
            gamError
          );
        }

        setInitializationState(true, false, null, 0);
      } catch (error) {
        console.error("Application initialization failed:", error);
        setInitializationError(
          error instanceof Error
            ? error.message
            : "Unknown initialization error"
        );
      }
    })();

    return () => {
      cleanupSheetListener?.();
    };
  });

  // Handle keyboard shortcuts
  $effect(() => {
    function handleKeydown(event: KeyboardEvent) {
      // Debug panel toggle (Ctrl/Cmd + `) - Admin only
      if ((event.ctrlKey || event.metaKey) && event.key === "`") {
        event.preventDefault();
        if (authState.isAdmin) {
          toggleDebugPanel();
        }
        return;
      }

      // Settings module toggle (Ctrl/Cmd + ,)
      if ((event.ctrlKey || event.metaKey) && event.key === ",") {
        event.preventDefault();
        // Toggle behavior: if in settings, go back to previous module
        if (navigationState.currentModule === "settings") {
          const previousModule = navigationState.previousModule || "dashboard";
          switchModule(previousModule as ModuleId);
        } else {
          switchModule("settings" as ModuleId);
        }
        return;
      }

      // Tab navigation (Ctrl/Cmd + 1-6)
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case "1":
            event.preventDefault();
            switchModule("create");
            break;
          case "2":
            event.preventDefault();
            switchModule("discover");
            break;
          case "3":
            event.preventDefault();
            switchModule("learn");
            break;
          case "4":
            event.preventDefault();
            switchModule("compose");
            break;
          case "5":
            event.preventDefault();
            switchModule("train");
            break;
          case "6":
            event.preventDefault();
            switchModule("library");
            break;
        }
      }
    }

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  });

  // Note: First-run wizard is now shown based on simple state checks in the template:
  // - !isAuthenticated → LandingPage
  // - isAuthenticated && !firstRunState.isDone() → FirstRunWizard
  // No need for triggerIfFirstTime() calls since we check isDone() directly

  // Create a serialized key for background settings to detect actual changes
  const backgroundSettingsKey = $derived(
    JSON.stringify({
      type: settings.backgroundType,
    })
  );

  // Watch for background changes to update theme (CSS variable updates handled by SettingsState)
  $effect(() => {
    // Track only the serialized key to detect actual value changes
    const key = backgroundSettingsKey;
    const initialized = isInitialized;

    if (!initialized) return;

    // Parse the key back to get values (avoids re-reading reactive state)
    const parsed = JSON.parse(key) as {
      type: BackgroundType;
    };

    if (parsed.type) {
      // Only update theme - SettingsState handles updateBodyBackground
      ThemeService.updateTheme(parsed.type);
    }
  });
</script>

<svelte:head>
  <title>TKA Scribe - A flow arts choreography Toolbox</title>
  <meta
    name="description"
    content="TKA Scribe is a revolutionary flow arts choreography toolbox for staffs, fans, and other flow arts. Create, learn, and share movement sequences using The Kinetic Alphabet notation system."
  />
</svelte:head>

<!-- Application Container -->
<div class="tka-app" data-testid="tka-application">
  <!-- Background Canvas - Uses reactive settings -->
  {#if settings.backgroundEnabled}
    <BackgroundCanvas
      backgroundType={settings.backgroundType || BackgroundType.SOLID_COLOR}
      quality={settings.backgroundQuality || "medium"}
      backgroundColor={settings.backgroundColor || "#000000"}
      {...settings.gradientColors
        ? { gradientColors: settings.gradientColors }
        : {}}
      {...settings.gradientDirection !== undefined
        ? { gradientDirection: settings.gradientDirection }
        : {}}
    />
  {/if}

  {#if initializationError}
    <ErrorScreen
      error={initializationError}
      onRetry={() => window.location.reload()}
    />
  {:else if authLoading}
    <!-- Auth Loading State -->
    <div class="auth-loading">
      <div class="auth-loading-spinner"></div>
      <p>Checking authentication...</p>
    </div>
  {:else if !isAuthenticated}
    <!-- Not authenticated: show landing page (login/signup) -->
    <LandingPage />
  {:else if firstRunState.syncInProgress || (!firstRunState.cloudSynced && !firstRunState.isDone())}
    <!-- Wait for first-run status to sync from cloud before deciding to show wizard -->
    <div class="auth-loading">
      <div class="auth-loading-spinner"></div>
      <p>Loading preferences...</p>
    </div>
  {:else if !firstRunState.isDone()}
    <!-- Authenticated but hasn't completed preferences wizard yet -->
    <FirstRunWizard
      onComplete={() => firstRunState.markCompleted()}
      onSkip={() => firstRunState.markSkipped()}
    />
  {:else}
    <!-- Main Interface - Full app for authenticated users who completed onboarding -->
    <MainInterface />

    <!-- Auth sheet (route-based) -->
    <AuthSheet
      isOpen={showAuthSheet}
      onClose={() => sheetRouterService?.closeSheet()}
    />

    <!-- Legal sheets (terms/privacy - route-based) -->
    <LegalSheet
      isOpen={showTermsSheet || showPrivacySheet}
      type={showPrivacySheet ? "privacy" : "terms"}
      onClose={() => sheetRouterService?.closeSheet()}
    />

    <!-- Gamification Toast Notifications -->
    <AchievementNotificationToast />
    <XPToast />

    <!-- Inbox Subscriptions (for badge counts) -->
    <InboxSubscriptionProvider />

    <!-- Inbox Drawer (messages + notifications) -->
    <InboxDrawer />

    <!-- Quick Feedback Panel (desktop hotkey: f) -->
    <QuickFeedbackPanel />

    <!-- My Feedback Detail Drawer (for viewing/editing user's own feedback) -->
    <MyFeedbackDetail
      item={feedbackDetailItem}
      isOpen={showFeedbackDetail}
      onClose={() => myFeedbackDetailState.close()}
      onUpdate={myFeedbackDetailState.updateItem}
      onDelete={myFeedbackDetailState.deleteItem}
    />

    <!-- System Announcements Modal -->
    <AnnouncementChecker />

    <!-- What's New Modal (version updates) -->
    <WhatsNewChecker />

    <!-- Domain Migration Notifications -->
    <MigrationChecker />

    <!-- Global Error Modal -->
    <ErrorModal />
  {/if}
</div>

<style>
  .tka-app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    width: 100%;
    position: relative;
    z-index: 2; /* Above body::after transition layer (z-index: 1) */
    overflow: hidden;
    transition: all var(--duration-emphasis) ease;
    background: transparent;
    --text-color: rgba(255, 255, 255, 0.95);
    --foreground: rgba(255, 255, 255, 0.95);
    --muted-foreground: rgba(255, 255, 255, 0.7);
  }

  /* Auth loading state */
  .auth-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 16px;
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--font-size-sm);
  }

  .auth-loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    animation: auth-spin 1s linear infinite;
  }

  @keyframes auth-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .tka-app {
      /* Dynamic viewport height for mobile app */
      min-height: 100dvh;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .tka-app {
      transition: none;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .tka-app {
      --text-color: white;
      --foreground: white;
    }
  }

  /* Print styles */
  @media print {
    .tka-app {
      min-height: auto;
      overflow: visible;
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .auth-loading-spinner {
      animation: none;
    }
    /* Disable local keyframe animations */
    [style*="auth-spin"] {
      animation: none;
    }
  }
</style>
