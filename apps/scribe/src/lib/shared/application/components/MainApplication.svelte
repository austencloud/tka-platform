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
  import AttributionPrompt from "../../attribution/components/AttributionPrompt.svelte";
  import { getAttributionPromptState } from "../../attribution/state/attribution-prompt-state.svelte";
  import SequenceViewerDrawerHost from "../../sequence-viewer/components/SequenceViewerDrawerHost.svelte";
  import HeyTikaListener from "../../voice-control/components/HeyTikaListener.svelte";
  import VoiceControlIndicator from "../../voice-control/components/VoiceControlIndicator.svelte";
  import VoiceCommandHelpOverlay from "../../voice-control/components/VoiceCommandHelpOverlay.svelte";

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
  import BackgroundHost from "../../background/shared/components/BackgroundHost.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
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
  const getContainer = getContext<() => typeof container | null>("di-container");

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

        // Progress: Services are resolved from DI container
        (window as any).__tkaLoadProgress?.(70, "Loading settings...");

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
        (window as any).__tkaLoadProgress?.(78, "Restoring workspace...");

        await settingsService.loadSettings();
        updateSettings(settingsService.currentSettings);
        ThemeService.initialize();

        // Progress: Settings loaded, applying theme
        (window as any).__tkaLoadProgress?.(85, "Applying your theme...");

        // Apply background-based theme colors on startup
        // Must handle SOLID_COLOR and LINEAR_GRADIENT specially to use user's saved colors
        const { applyThemeForBackground, applyThemeFromColors } =
          await import("../../settings/utils/background-theme-calculator");
        const currentSettings = settingsService.currentSettings;
        const bgType = currentSettings?.backgroundType;
        if (bgType) {
          if (bgType === BackgroundType.SOLID_COLOR && currentSettings.backgroundColor) {
            // Use user's saved solid color, not predefined theme colors
            applyThemeFromColors(currentSettings.backgroundColor);
          } else if (bgType === BackgroundType.LINEAR_GRADIENT && currentSettings.gradientColors) {
            // Use user's saved gradient colors
            applyThemeFromColors(undefined, currentSettings.gradientColors);
          } else {
            // Animated backgrounds use predefined theme colors
            applyThemeForBackground(bgType);
          }
        }

        // Initialize gamification system
        (window as any).__tkaLoadProgress?.(92, "Initializing achievements...");
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

        // Progress: Fully ready - triggers loading screen fade out with random ready message
        (window as any).__tkaLoadProgress?.(100, "Ready");

        // Check if deferred attribution prompt should show (after app settles)
        setTimeout(() => {
          getAttributionPromptState().checkAndMaybeShow();
        }, 5000); // Wait 5 seconds after init for smoother UX
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
          const previousModule = navigationState.previousModule || "create";
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
            switchModule("browse");
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
            switchModule("browse");
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
  // Include color values so theme updates when colors change, not just type
  const backgroundSettingsKey = $derived(
    JSON.stringify({
      type: settings.backgroundType,
      bgColor: settings.backgroundColor,
      gradientColors: settings.gradientColors,
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
      bgColor?: string;
      gradientColors?: string[];
    };

    if (parsed.type) {
      // Apply the FULL theme (--theme-* CSS variables) based on background
      // This is the critical fix - we must call the proper theme application functions
      import("../../settings/utils/background-theme-calculator").then(
        ({ applyThemeForBackground, applyThemeFromColors }) => {
          if (
            parsed.type === BackgroundType.SOLID_COLOR &&
            parsed.bgColor
          ) {
            // Use user's solid color
            applyThemeFromColors(parsed.bgColor);
          } else if (
            parsed.type === BackgroundType.LINEAR_GRADIENT &&
            parsed.gradientColors
          ) {
            // Use user's gradient colors
            applyThemeFromColors(undefined, parsed.gradientColors);
          } else {
            // Animated backgrounds use predefined theme colors
            applyThemeForBackground(parsed.type);
          }
          // Still call legacy dropdown vars update
          ThemeService.updateTheme(parsed.type);
        }
      );
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
  <!-- Background Host - Uses reactive settings, controller survives HMR -->
  {#if settings.backgroundEnabled}
    <BackgroundHost
      backgroundType={settings.backgroundType || BackgroundType.SOLID_COLOR}
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
  {:else if !firstRunState.isDone() || firstRunState.shouldShow}
    <!-- Authenticated but hasn't completed preferences wizard yet (or force-showing for preview) -->
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

    <!-- Deferred Attribution Prompt (appears after engagement threshold) -->
    <AttributionPrompt />

    <!-- Voice Control: "Hey Tika" wake word listener + visual indicator -->
    <HeyTikaListener />
    <VoiceControlIndicator />
    <VoiceCommandHelpOverlay />
  {/if}

  <!-- Sequence Viewer Drawer (mobile overlay) - outside auth gate so external links work -->
  <SequenceViewerDrawerHost />
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
  }
</style>
