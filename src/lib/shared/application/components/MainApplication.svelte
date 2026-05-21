<!-- Main Application Layout -->
<script module lang="ts">

import { getApplicationInitializer } from "$lib/shared/application/getApplicationInitializer";
  // Module-level: survives component remounts so we never show the auth
  // spinner again after the app has loaded once in this session.
  let _mainInterfaceShown = false;
</script>

<script lang="ts">
  import { getDeviceDetector } from "$lib/shared/device/getDeviceDetector";
  import { settingsService as settingsServiceSingleton } from "$lib/shared/settings/state/SettingsState.svelte";
  import AchievementNotificationToast from "../../gamification/components/AchievementNotificationToast.svelte";
  import XPToast from "../../gamification/components/XPToast.svelte";
  import WhatsNewChecker from "../../settings/components/WhatsNewChecker.svelte";
  import ErrorModal from "../../error/components/ErrorModal.svelte";
  import ErrorToast from "../../error/components/ErrorToast.svelte";
  import InboxDrawer from "../../inbox/components/InboxDrawer.svelte";
  import InboxSubscriptionProvider from "../../inbox/components/InboxSubscriptionProvider.svelte";
  import { myFeedbackDetailState } from "$lib/shared/feedback/state/my-feedback-detail-state.svelte";
  import FirstRunWizard from "../../onboarding/components/first-run/FirstRunWizard.svelte";
  import CreateTutorialWizard from "../../onboarding/components/create-tutorial/CreateTutorialWizard.svelte";
  import TutorialPrompt from "../../onboarding/components/create-tutorial/TutorialPrompt.svelte";
  import { firstRunState } from "../../onboarding/state/first-run-state.svelte.ts";
  import { appEntryState } from "../../onboarding/state/app-entry-state.svelte.ts";
  import AttributionPrompt from "../../attribution/components/AttributionPrompt.svelte";
  import { getAttributionPromptState } from "../../attribution/state/attribution-prompt-state.svelte";
  import SequenceViewerDrawerHost from "../../sequence-viewer/components/SequenceViewerDrawerHost.svelte";
  import SendSequenceSheetHost from "../../inbox/components/SendSequenceSheetHost.svelte";
  import HeyTikaListener from "../../voice-control/components/HeyTikaListener.svelte";
  import VoiceControlIndicator from "../../voice-control/components/VoiceControlIndicator.svelte";
  import VoiceCommandHelpOverlay from "../../voice-control/components/VoiceCommandHelpOverlay.svelte";
  import PropSelectionSheet from "../../settings/components/tabs/prop-type/PropSelectionSheet.svelte";
  import { propDrawerState } from "../../settings/state/prop-drawer-state.svelte";
  import { PropType } from "../../pictograph/prop/domain/enums/PropType";

  import { getContext, onMount } from "svelte";
  import MainInterface from "../../MainInterface.svelte";
  import AuthSheet from "../../navigation/components/AuthSheet.svelte";
  import LegalSheet from "../../legal/components/LegalSheet.svelte";
  import {
    getCurrentSheet,
    closeSheet,
    onRouteChange,
  } from "../../navigation/services/sheet-router";
import type { SheetType } from "../../navigation/services/contracts/types";
  import { authState } from "../../auth/state/authState.svelte";
  import LandingPage from "../../auth/components/LandingPage.svelte";
  import AuthDrawer from "../../auth/components/AuthDrawer.svelte";
  import { authDrawerState } from "../../auth/state/auth-drawer-state.svelte";
  import ErrorScreen from "../../foundation/ui/ErrorScreen.svelte";
  import type { SettingsState } from "$lib/shared/settings/state/SettingsState.svelte";
  import { initializeTheme, updateTheme as updateThemeService } from "../../theme/services/theme-service";
  import type { ApplicationInitializer } from '$lib/shared/application/services/implementations/ApplicationInitializer'
  import {
    getSettings,
    restoreApplicationState,
    updateSettings,
    updateSetting,
  } from "../state/app-state.svelte";
  import {
    getIsInitialized,
    getInitializationError,
    setInitializationError,
    setInitializationState,
    initializeAppState,
  } from "../state/initialization-state.svelte";
  import type { DeviceDetector } from '$lib/shared/device/services/implementations/DeviceDetector'
  import BackgroundHost from "../../background/shared/components/BackgroundHost.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import PwaMigrationBanner from "../../pwa/components/PwaMigrationBanner.svelte";
  import {
    getShowDebugPanel,
    toggleDebugPanel,
  } from "../state/ui/ui-state.svelte";
  import { switchModule } from "../state/ui/module-state";
  import { navigationState } from "../../navigation/state/navigation-state.svelte";
  import type { ModuleId } from "../../navigation/domain/types";
  import { MODULE_DEFINITIONS } from "../../navigation/config/module-definitions";
  import { handleModuleChange } from "../../navigation-coordinator/navigation-coordinator.svelte";
  import { getAttributionPromptTrigger } from "../../attribution/getAttributionPromptTrigger";
  import { isModuleAccessible } from "../../auth/domain/guest-access-config";
  import { resolveAccessTier } from "../../auth/domain/AccessTier";
  import { isPremiumOrAbove } from "../../auth/domain/models/UserRole";
  // Get DI container from context
// Services - resolved lazily
  let initService: ApplicationInitializer | null = $state(null);
  let settingsService: SettingsState | null = $state(null);
  let deviceService: DeviceDetector | null = $state(null);
  let servicesResolved = $state(false);

  // App state
  let isInitialized = $derived(getIsInitialized());
  let initializationError = $derived(getInitializationError());
  let settings = $derived(getSettings());

  // Voice control opt-in (hidden by default, enabled in Settings > Preferences)
  const voiceControlEnabled = $derived(settings?.voiceControlEnabled === true);

  // Auth state for gating
  const isAuthenticated = $derived(authState.isAuthenticated);
  const authLoading = $derived(authState.loading);

  // Track whether MainInterface has been shown at least once.
  // Once shown, never tear it down for auth loading - the loading spinner
  // is only for initial app startup, not mid-session auth transitions
  // (e.g., guest signing up mid-session should NOT destroy MainInterface).
  // Module-level so it survives component remounts (e.g., navigating from
  // /q/[code] back to a main app route remounts MainApplication fresh).
  const showAuthLoadingSpinner = $derived(authLoading && !_mainInterfaceShown);

  // Mark MainInterface as shown once auth loading completes for the first time
  $effect(() => {
    if (!authLoading && !initializationError) {
      _mainInterfaceShown = true;
    }
  });

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

  // Dynamic browser tab title
  const pageTitle = $derived(() => {
    const mod = MODULE_DEFINITIONS.find(
      (m) => m.id === navigationState.currentModule
    );
    return mod ? `${mod.label} | TKA Composer` : "TKA Composer";
  });

  // Global prop drawer (P key shortcut + PropIndicatorButton)
  const catDogMode = $derived(settings?.catDogMode ?? false);
  const bluePropType = $derived(settings?.bluePropType ?? PropType.STAFF);
  const redPropType = $derived(settings?.redPropType ?? PropType.STAFF);
  let propDrawerActiveTab = $state<"blue" | "red">("blue");

  // Reset to blue tab each time the drawer opens
  $effect(() => {
    if (propDrawerState.isOpen) {
      propDrawerActiveTab = "blue";
    }
  });

  // When cat/dog mode is on, show the selected prop for the active tab
  const propDrawerSelectedPropType = $derived(
    catDogMode && propDrawerActiveTab === "red" ? redPropType : bluePropType
  );

  function handleGlobalPropSelect(propType: PropType) {
    if (catDogMode) {
      if (propDrawerActiveTab === "blue") {
        updateSetting("bluePropType", propType);
        // Auto-switch to red tab so user can pick the other hand
        propDrawerActiveTab = "red";
        return;
      } else {
        updateSetting("redPropType", propType);
      }
    } else {
      updateSetting("bluePropType", propType);
      updateSetting("redPropType", propType);
    }
    propDrawerState.close();
  }

  function handleCatDogToggle() {
    const newMode = !catDogMode;
    updateSetting("catDogMode", newMode);
    if (newMode) {
      // Starting cat/dog mode: begin on blue tab
      propDrawerActiveTab = "blue";
    }
  }

  // Resolve services from ITI container (synchronous - no async needed)
  $effect(() => {
    if (!servicesResolved) {
      try {
        initService = getApplicationInitializer();
        settingsService = settingsServiceSingleton;
        deviceService = getDeviceDetector();
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
        // Skip full re-initialization on HMR - if app is already initialized,
        // the preserved state from import.meta.hot.data means we don't need to
        // redo auth, Firestore, settings, theme, or gamification.
        if (getIsInitialized()) {
          // Re-attach sheet router listener (old one was cleaned up on unmount)
          currentSheetType = getCurrentSheet();
          cleanupSheetListener = onRouteChange(
            async (state) => {
              if (state.sheet === "settings") {
                closeSheet();
                await handleModuleChange("settings" as ModuleId);
                return;
              }
              currentSheetType = state.sheet ?? null;
            }
          );
          return;
        }

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
          !deviceService
        ) {
          console.error("Services not properly resolved");
          setInitializationError("Services not properly resolved");
          return;
        }

        // Progress: Services are resolved from DI container
        (window as any).__tkaLoadProgress?.(88, "Loading settings...");

        // Initialize sheet router state (now that service is resolved)
        currentSheetType = getCurrentSheet();

        // Check for legacy ?sheet=settings URL and redirect to settings module
        if (currentSheetType === "settings") {
          closeSheet();
          await handleModuleChange("settings" as ModuleId);
        }

        cleanupSheetListener = onRouteChange(
          async (state) => {
            // Redirect legacy ?sheet=settings to settings module
            if (state.sheet === "settings") {
              closeSheet();
              await handleModuleChange("settings" as ModuleId);
              return;
            }

            currentSheetType = state.sheet ?? null;
          }
        );

        await restoreApplicationState();
        await initService.initialize();
        (window as any).__tkaLoadProgress?.(92, "Restoring workspace...");

        await settingsService.loadSettings();
        updateSettings(settingsService.currentSettings);
        initializeTheme();

        // Progress: Settings loaded, applying theme
        (window as any).__tkaLoadProgress?.(95, "Applying your theme...");

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

        // Initialize gamification system (authenticated users only - requires Firestore)
        if (authState.isAuthenticated) {
          (window as any).__tkaLoadProgress?.(98, "Initializing achievements...");
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
        }

        setInitializationState(true, false, null, 0);

        // Progress: Fully ready - triggers loading screen fade out with random ready message
        (window as any).__tkaLoadProgress?.(100, "Ready");

        // Record session start for attribution prompt trigger. On first-ever
        // boot this also locks in the "eligibleAfter" date so the deferred
        // prompt actually becomes eligible instead of drifting forward.
        try {
          getAttributionPromptTrigger().recordSessionStart();
        } catch {
          // Non-critical
        }

        // Check if deferred prompts should show (after app settles)
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
      // Guests can only switch to modules they have access to.
      if (event.ctrlKey || event.metaKey) {
        const moduleKeyMap: Record<string, string> = {
          "1": "create",
          "2": "browse",
          "3": "learn",
          "4": "compose",
          "5": "train",
          "6": "browse",
        };
        const targetModuleId = moduleKeyMap[event.key];
        if (targetModuleId) {
          event.preventDefault();
          const tier = resolveAccessTier(
            authState.isAuthenticated,
            isPremiumOrAbove(authState.role)
          );
          if (isModuleAccessible(targetModuleId, tier)) {
            switchModule(targetModuleId as ModuleId);
          }
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
          updateThemeService(parsed.type);
        }
      );
    }
  });
</script>

<svelte:head>
  <title>{pageTitle()}</title>
  <meta
    name="description"
    content="TKA Composer is a flow arts choreography toolbox for staves, fans, and other props. Create, learn, and share movement sequences using The Kinetic Alphabet notation system."
  />
</svelte:head>

<!-- Application Container -->
<div class="tka-app" data-testid="tka-application">
  <!-- Background Host - Uses reactive settings, controller survives HMR -->
  {#if settings.backgroundEnabled}
    <BackgroundHost
      backgroundType={settings.backgroundType || BackgroundType.COSMIC}
      backgroundColor={settings.backgroundColor}
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
  {:else if showAuthLoadingSpinner}
    <!-- Auth Loading State (initial load only - never tears down MainInterface once shown) -->
    <div class="auth-loading">
      <div class="auth-loading-spinner"></div>
      <p>Warming up...</p>
    </div>
  {:else}
    <!-- MainInterface always mounted - guest restrictions via context -->
    <MainInterface />

    <!-- PWA migration banner for users who installed from tkascribe.com -->
    <PwaMigrationBanner />

    <!-- FirstRunWizard as overlay (only for newly authenticated users) -->
    <!-- Returning users (isDone() === true) have valid local preferences
         already. The cloud sync is a background freshen, so don't blank out
         the app with "Loading preferences..." - that looks like a full page
         reload right after sign-in. Only block the UI for genuine first-run
         users whose local state isn't set up yet. -->
    {#if isAuthenticated && !firstRunState.isDone() && (firstRunState.syncInProgress || !firstRunState.cloudSynced)}
      <div class="fullscreen-overlay">
        <div class="auth-loading">
          <div class="auth-loading-spinner"></div>
          <p>Loading preferences...</p>
        </div>
      </div>
    {:else if isAuthenticated && (!firstRunState.isDone() || firstRunState.shouldShow)}
      <div class="fullscreen-overlay">
        {#if appEntryState.phase === "wizard-exiting"}
          <div class="wizard-exit-wrapper">
            <FirstRunWizard
              onComplete={() => firstRunState.markCompleted()}
              onSkip={() => firstRunState.markSkipped()}
            />
          </div>
        {:else}
          <FirstRunWizard
            onComplete={() => {
              firstRunState.markCompleted();
              appEntryState.startEntrySequence(true);
            }}
            onSkip={() => {
              firstRunState.markSkipped();
              appEntryState.startEntrySequence(true);
            }}
          />
        {/if}
      </div>
    {:else if isAuthenticated && appEntryState.isCreateTutorial()}
      <div class="fullscreen-overlay">
        <CreateTutorialWizard
          onComplete={() => appEntryState.completeEntry()}
          onSkip={() => appEntryState.skipToComplete()}
        />
      </div>
    {/if}

    <!-- Tutorial prompt overlays the main app so the user sees the real layout behind it -->
    {#if isAuthenticated && appEntryState.isTutorialPrompt()}
      <TutorialPrompt
        onAccept={() => appEntryState.acceptTutorial()}
        onSkip={() => appEntryState.declineTutorial()}
      />
    {/if}

    <!-- AuthDrawer for guest sign-up flow -->
    {#if !isAuthenticated}
      <AuthDrawer
        open={authDrawerState.open}
        initialMode={authDrawerState.initialMode}
        onClose={() => authDrawerState.hide()}
      />
    {/if}

    <!-- Auth sheet (route-based) -->
    <AuthSheet
      isOpen={showAuthSheet}
      onClose={() => closeSheet()}
    />

    <!-- Legal sheets (terms/privacy - route-based) -->
    <LegalSheet
      isOpen={showTermsSheet || showPrivacySheet}
      type={showPrivacySheet ? "privacy" : "terms"}
      onClose={() => closeSheet()}
    />

    <!-- Gamification Toast Notifications -->
    <AchievementNotificationToast />
    <XPToast />

    <!-- Inbox Subscriptions (for badge counts) -->
    <InboxSubscriptionProvider />

    <!-- Inbox Drawer (messages + notifications) -->
    <InboxDrawer />

    <!-- Quick Feedback Panel (desktop hotkey: f) -->
    {#await import("$lib/features/feedback/components/quick/QuickFeedbackPanel.svelte") then mod}
      <mod.default />
    {/await}

    <!-- My Feedback Detail Drawer (for viewing/editing user's own feedback) -->
    {#await import("$lib/features/feedback/components/my-feedback/MyFeedbackDetail.svelte") then mod}
      <mod.default
        item={feedbackDetailItem}
        isOpen={showFeedbackDetail}
        onClose={() => myFeedbackDetailState.close()}
        onUpdate={myFeedbackDetailState.updateItem}
        onDelete={myFeedbackDetailState.deleteItem}
      />
    {/await}

    <!-- System Announcements Modal -->
    {#await import("$lib/features/admin/components/AnnouncementChecker.svelte") then mod}
      <mod.default />
    {/await}

    <!-- What's New Modal (version updates) -->
    <WhatsNewChecker />

    <!-- Global Error Modal -->
    <ErrorModal />
    <!-- Non-blocking error toasts (warnings, info) -->
    <ErrorToast />

    <!-- Deferred Attribution Prompt (appears after engagement threshold) -->
    <AttributionPrompt />

    <!-- Global Prop Selection Drawer (P key shortcut) -->
    <PropSelectionSheet
      bind:isOpen={propDrawerState.isOpen}
      selectedPropType={propDrawerSelectedPropType}
      color={catDogMode ? propDrawerActiveTab : "blue"}
      title={catDogMode ? (propDrawerActiveTab === "blue" ? "Blue Prop" : "Red Prop") : "Change Prop"}
      onSelect={handleGlobalPropSelect}
      showCatDogToggle={true}
      catDogEnabled={catDogMode}
      onCatDogToggle={handleCatDogToggle}
      showTabs={catDogMode}
      bind:activeTab={propDrawerActiveTab}
      autoClose={!catDogMode}
    />

    <!-- Voice Control: opt-in via Settings > Preferences -->
    {#if voiceControlEnabled}
      <HeyTikaListener />
      <VoiceControlIndicator />
      <VoiceCommandHelpOverlay />
    {/if}
  {/if}

  <!-- Send Sequence Sheet (global overlay for "Send to..." actions) -->
  <SendSequenceSheetHost />

  <!-- Sequence Viewer Drawer (mobile overlay) - outside auth gate so external links work -->
  <SequenceViewerDrawerHost />
</div>

<style>
  .tka-app {
    display: flex;
    flex-direction: column;
    height: 100dvh;
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
    min-height: 100dvh;
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

  /* Fullscreen overlay for first-run wizard and tutorial wizard */
  .fullscreen-overlay {
    position: fixed;
    inset: 0;
    z-index: 900;
    background: rgb(18, 18, 28);
  }

  /* Wizard exit animation - fades out + slight scale down */
  .wizard-exit-wrapper {
    position: absolute;
    inset: 0;
    z-index: 10;
    animation: wizard-exit 400ms ease-in forwards;
    pointer-events: none;
  }

  @keyframes wizard-exit {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.97);
    }
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .tka-app {
      height: 100dvh;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .tka-app {
      transition: none;
    }

    .wizard-exit-wrapper {
      animation: none;
      opacity: 0;
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
