<!-- Main Application Layout -->
<script module lang="ts">

import { getApplicationInitializer } from "$lib/shared/application/get-application-initializer";
  import { readBootSnapshot } from "$lib/shared/application/services/boot-snapshot";
  // Module-level: survives component remounts so we never show the auth
  // spinner again after the app has loaded once in this session.
  // Seed from the boot snapshot: if the app has successfully booted before,
  // settings/theme are already primed from localStorage, so we render
  // MainInterface immediately and let auth reconcile in the background instead
  // of showing the "Warming up" spinner. First-ever load (no snapshot) keeps
  // the spinner.
  let _mainInterfaceShown = readBootSnapshot() !== null;

  // Teach TypeScript about the boot-script progress hook injected in app.html.
  // Signature: __tkaLoadProgress(percent: number, message: string) => void
  declare global {
    interface Window {
      __tkaLoadProgress?: (percent: number, message: string) => void;
    }
  }
</script>

<script lang="ts">
  import { getDeviceDetector } from "$lib/shared/device/get-device-detector";
  import { settingsService as settingsServiceSingleton } from "$lib/shared/settings/state/settings-state.svelte";
  import WhatsNewChecker from "../../settings/components/WhatsNewChecker.svelte";
  import ErrorModal from "../../error/components/ErrorModal.svelte";
  import ErrorToast from "../../error/components/ErrorToast.svelte";
  import InboxSubscriptionProvider from "../../inbox/components/InboxSubscriptionProvider.svelte";
  import { myFeedbackDetailState } from "$lib/shared/feedback/state/my-feedback-detail-state.svelte";
  import { firstRunState } from "../../onboarding/state/first-run-state.svelte.ts";
  import { passwordOnboardingState } from "../../onboarding/state/password-onboarding-state.svelte.ts";
  import { appEntryState } from "../../onboarding/state/app-entry-state.svelte.ts";
  import SendSequenceSheetHost from "../../inbox/components/SendSequenceSheetHost.svelte";
  import { propDrawerState } from "../../settings/state/prop-drawer-state.svelte";
  import { PropType } from "../../pictograph/prop/domain/enums/prop-type";

  import { getContext, onMount } from "svelte";
  import { bootProfiler } from "$lib/shared/analytics/boot-profiler";
  import MainInterface from "../../MainInterface.svelte";
  import AuthSheet from "../../navigation/components/AuthSheet.svelte";
  import SupportModal from "../../support/components/SupportModal.svelte";
  import PostSaveActivationHost from "../../onboarding/components/PostSaveActivationHost.svelte";
  import LegalSheet from "../../legal/components/LegalSheet.svelte";
  import {
    getCurrentSheet,
    closeSheet,
    onRouteChange,
  } from "../../navigation/services/sheet-router";
import type { SheetType } from "../../navigation/services/types";
  import { authState } from "../../auth/state/auth-state.svelte";
  import { authDrawerState } from "../../auth/state/auth-drawer-state.svelte";
  import ConfirmDialog from "$lib/shared/foundation/ui/ConfirmDialog.svelte";
  import {
    anonymousImportPrompt,
    confirmAnonymousImport,
    cancelAnonymousImport,
  } from "$lib/shared/auth/state/anonymous-import-prompt.svelte";
  import ErrorScreen from "../../foundation/ui/ErrorScreen.svelte";
  import type { SettingsState } from "$lib/shared/settings/state/settings-state.svelte";
  import { initializeTheme, updateTheme as updateThemeService } from "../../theme/services/theme-service";
  import type { ApplicationInitializer } from '$lib/shared/application/services/application-initializer'
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
  import type { DeviceDetector } from '$lib/shared/device/services/device-detector'
  import BackgroundHost from "../../background/shared/components/BackgroundHost.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import {
    getShowDebugPanel,
    toggleDebugPanel,
  } from "../state/ui/ui-state.svelte";
  import { switchModule } from "../state/ui/module-state";
  import { navigationState } from "../../navigation/state/navigation-state.svelte";
  import type { ModuleId } from "../../navigation/domain/types";
  import { MODULE_DEFINITIONS } from "../../navigation/config/module-definitions";
  import { handleModuleChange } from "../../navigation-coordinator/navigation-coordinator.svelte";
  import { isModuleAccessible } from "../../auth/domain/guest-access-config";
  import { resolveAccessTier } from "../../auth/domain/access-tier";
  import { isPremiumOrAbove } from "../../auth/domain/models/user-role";
  import { detectAndCaptureScanEntry } from "../../analytics/scan-attribution";
  import { writeBootSnapshot } from "$lib/shared/application/services/boot-snapshot";
  import { CURRENT_MODULE_KEY } from "$lib/shared/navigation/config/storage-keys";
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
  // A guest is anyone without a full account: unauthenticated OR an anonymous
  // Firebase identity (provisioned on first persistable action via
  // ensureGuestIdentity). The AuthDrawer must mount for both — an anonymous
  // guest tapping "Create Account" upgrades the anon session in place.
  const isFullAccount = $derived(authState.isFullAccount);
  const isGuest = $derived(!isFullAccount);
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
    return mod ? `${mod.label} | Flow Arts Composer` : "Flow Arts Composer";
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

    // Optimistic warm-reload: settings/theme are primed and MainInterface is
    // already rendering, so retire the boot splash now instead of waiting for
    // the full async boot chain. Idempotent with the final __tkaLoadProgress(100).
    if (readBootSnapshot() !== null) {
      window.__tkaLoadProgress?.(100, "Ready");
    }

    // Run async initialization without blocking cleanup function return
    (async () => {
      try {
        // Skip full re-initialization on HMR - if app is already initialized,
        // the preserved state from import.meta.hot.data means we don't need to
        // redo auth, Firestore, settings, or theme.
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
        bootProfiler.mark("app:init-state");
        await initializeAppState();
        bootProfiler.end("app:init-state");

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
        window.__tkaLoadProgress?.(88, "Loading settings...");

        // Initialize sheet router state (now that service is resolved)
        currentSheetType = getCurrentSheet();

        // Check for legacy ?sheet=settings URL and redirect to settings module
        if (currentSheetType === "settings") {
          closeSheet();
          await handleModuleChange("settings" as ModuleId);
        }

        // A ?sheet=auth deep link means "sign in if needed" (the QR scan
        // funnel arrives this way). Drop it when the user is already signed
        // in so the sheet doesn't flash open. If auth hasn't restored yet,
        // AuthSheet's own auto-close-when-authenticated effect covers it.
        if (currentSheetType === "auth" && authState.isAuthenticated) {
          closeSheet();
          currentSheetType = null;
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

        bootProfiler.mark("app:restore-workspace");
        await restoreApplicationState();
        await initService.initialize();
        bootProfiler.end("app:restore-workspace");
        window.__tkaLoadProgress?.(92, "Restoring workspace...");

        bootProfiler.mark("app:load-settings+theme");
        await settingsService.loadSettings();
        updateSettings(settingsService.currentSettings);
        initializeTheme();

        // Progress: Settings loaded, applying theme
        window.__tkaLoadProgress?.(95, "Applying your theme...");

        // Apply background-based theme colors on startup
        const { applyThemeForBackground } =
          await import("../../settings/utils/background-theme-calculator");
        const currentSettings = settingsService.currentSettings;
        const bgType = currentSettings?.backgroundType;
        if (bgType) {
          applyThemeForBackground(bgType);
        }
        bootProfiler.end("app:load-settings+theme");

        setInitializationState(true, false, null, 0);

        // Progress: Fully ready - triggers loading screen fade out with random ready message
        window.__tkaLoadProgress?.(100, "Ready");
        // Persist a boot snapshot so the NEXT load can skip the auth spinner and
        // render optimistically. role/uid seed the optimistic tier (W1b); the
        // active module picks the right skeleton.
        writeBootSnapshot({
          uid: authState.getEffectiveUserId(),
          role: authState.role,
          tier: resolveAccessTier(
            authState.isAuthenticated,
            authState.isAnonymous,
            isPremiumOrAbove(authState.role)
          ),
          activeModule:
            (typeof localStorage !== "undefined" &&
              localStorage.getItem(CURRENT_MODULE_KEY)) ||
            "create",
        });
        detectAndCaptureScanEntry();

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
            authState.isAnonymous,
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

  // Note: First-run wizard is shown based on simple state checks in the template:
  // - !isFullAccount → guest mode (MainInterface with guest restrictions)
  // - isFullAccount && !firstRunState.isDone() → FirstRunWizard
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
        ({ applyThemeForBackground }) => {
          applyThemeForBackground(parsed.type);
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
    content="Flow Arts Composer is a flow arts choreography toolbox for staves, fans, and other props. Create, learn, and share movement sequences using The Kinetic Alphabet notation system."
  />
</svelte:head>

<!-- Application Container -->
<div class="tka-app" data-testid="tka-application">
  <!-- Background Host - Uses reactive settings, controller survives HMR -->
  {#if settings.backgroundEnabled}
    <BackgroundHost
      backgroundType={settings.backgroundType || BackgroundType.COSMIC}
      backgroundColor={settings.backgroundColor}
      pauseDuringPlayback={true}
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
    {#await import("../../pwa/components/PwaMigrationBanner.svelte") then mod}
      <mod.default />
    {/await}

    <!-- FirstRunWizard as overlay (only for newly authenticated users) -->
    <!-- Returning users (isDone() === true) have valid local preferences
         already. The cloud sync is a background freshen, so don't blank out
         the app with "Loading preferences..." - that looks like a full page
         reload right after sign-in. Only block the UI for genuine first-run
         users whose local state isn't set up yet. -->
    {#if isFullAccount && (!firstRunState.isDone() || firstRunState.shouldShow || passwordOnboardingState.required) && (firstRunState.syncInProgress || !firstRunState.cloudSynced || passwordOnboardingState.syncInProgress || !passwordOnboardingState.cloudSynced)}
      <!-- Hold for cloud sync so we never flash a setup card for an account that
           already finished onboarding / set a password on another device. -->
      <div class="fullscreen-overlay">
        <div class="auth-loading">
          <div class="auth-loading-spinner"></div>
          <p>Loading preferences...</p>
        </div>
      </div>
    {:else if isFullAccount && (!firstRunState.isDone() || firstRunState.shouldShow || passwordOnboardingState.required)}
      <!-- Unified post-signup setup: name and/or required password on ONE card.
           AccountSetupStep shows only what's needed and auto-completes if neither
           applies (e.g. a Google signup that already has a name + a login). -->
      <div class="fullscreen-overlay">
        {#await import("../../onboarding/components/first-run/AccountSetupWizard.svelte") then mod}
          {#if (!firstRunState.isDone() || firstRunState.shouldShow) && appEntryState.isEntryAnimating()}
            <div class="wizard-exit-wrapper">
              <mod.default
                needsPassword={passwordOnboardingState.required}
                forcePreview={firstRunState.previewMode}
                onComplete={() => firstRunState.markCompleted()}
              />
            </div>
          {:else}
            <mod.default
              needsPassword={passwordOnboardingState.required}
              forcePreview={firstRunState.previewMode}
              onComplete={() => {
                const wasFirstRun =
                  !firstRunState.isDone() || firstRunState.shouldShow;
                if (wasFirstRun) {
                  firstRunState.markCompleted();
                  appEntryState.startEntrySequence(true);
                }
              }}
            />
          {/if}
        {/await}
      </div>
    {:else if appEntryState.isCreateTutorial()}
      <div class="fullscreen-overlay">
        {#await import("../../onboarding/components/create-tutorial/CreateTutorialWizard.svelte") then mod}
          <mod.default
            onComplete={() => appEntryState.completeEntry()}
            onSkip={() => appEntryState.skipToComplete()}
          />
        {/await}
      </div>
    {/if}

    <!-- Tutorial prompt overlays the main app so the user sees the real layout behind it -->
    {#if appEntryState.isTutorialPrompt()}
      {#await import("../../onboarding/components/create-tutorial/TutorialPrompt.svelte") then mod}
        <mod.default
          onAccept={() => appEntryState.acceptTutorial()}
          onSkip={() => appEntryState.declineTutorial()}
        />
      {/await}
    {/if}

    <!-- AuthModal for guest sign-up / anonymous-upgrade flow -->
    {#if isGuest}
      {#await import("../../auth/components/AuthModal.svelte") then mod}
        <mod.default
          open={authDrawerState.open}
          initialMode={authDrawerState.initialMode}
          onClose={() => authDrawerState.hide()}
        />
      {/await}
    {/if}

    <!-- Auth sheet (route-based) -->
    <AuthSheet
      isOpen={showAuthSheet}
      onClose={() => closeSheet()}
    />

    <!-- Support modal — in-app "buy me a coffee" (self-driven via supportModalState) -->
    <SupportModal />

    <!-- Post-save activation nudge — self-driven via postSaveActivation (SP3 Part B) -->
    <PostSaveActivationHost />

    <!-- Legal sheets (terms/privacy - route-based) -->
    <LegalSheet
      isOpen={showTermsSheet || showPrivacySheet}
      type={showPrivacySheet ? "privacy" : "terms"}
      onClose={() => closeSheet()}
    />

    <!-- Inbox Subscriptions (for badge counts) -->
    <InboxSubscriptionProvider />

    <!-- Inbox Drawer (messages + notifications) -->
    {#await import("../../inbox/components/InboxDrawer.svelte") then mod}
      <mod.default />
    {/await}

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

    <!-- Global Prop Selection Drawer (P key shortcut) -->
    {#if propDrawerState.isOpen}
      {#await import("../../settings/components/tabs/prop-type/PropSelectionSheet.svelte") then mod}
        <mod.default
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
      {/await}
    {/if}

    <!-- Voice Control: opt-in via Settings > Preferences -->
    {#if voiceControlEnabled}
      {#await import("../../voice-control/components/HeyTikaListener.svelte") then mod}
        <mod.default />
      {/await}
      {#await import("../../voice-control/components/VoiceControlIndicator.svelte") then mod}
        <mod.default />
      {/await}
      {#await import("../../voice-control/components/VoiceCommandHelpOverlay.svelte") then mod}
        <mod.default />
      {/await}
    {/if}
  {/if}

  <!-- Anonymous-guest collision import offer (open via promptAnonymousImport) -->
  <ConfirmDialog
    bind:isOpen={anonymousImportPrompt.isOpen}
    variant="info"
    title="Keep what you just made?"
    message={`Add the ${anonymousImportPrompt.count} sequence${anonymousImportPrompt.count === 1 ? "" : "s"} you created as a guest to this account?`}
    confirmText="Import"
    cancelText="Not now"
    onConfirm={confirmAnonymousImport}
    onCancel={cancelAnonymousImport}
  />

  <!-- Send Sequence Sheet (global overlay for "Send to..." actions) -->
  <SendSequenceSheetHost />

  <!-- Sequence Viewer Drawer (mobile overlay) - outside auth gate so external links work -->
  {#await import("../../sequence-viewer/components/SequenceViewerDrawerHost.svelte") then mod}
    <mod.default />
  {/await}
</div>

<style>
  .tka-app {
    display: flex;
    flex-direction: column;
    /* The in-app-browser banner is fixed to the viewport bottom at --z-sticky,
       the same tier as BottomNavigation, and it mounts later in the DOM — so
       without this it paints straight over the tab bar, and `overflow: hidden`
       below means there is no scrolling out from under it. +layout.svelte
       publishes the measured height on :root (0px whenever no banner shows,
       which is every session but a detected webview). */
    height: calc(100dvh - var(--iab-banner-height, 0px));
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
    background: var(--theme-panel-bg, rgb(18, 18, 28));
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

  /* No mobile height override here on purpose. There used to be a
     `@media (max-width: 768px) { .tka-app { height: 100dvh } }` that only
     restated the base value — harmless until the base grew the banner
     reservation above, at which point the duplicate silently shadowed it on
     exactly the viewports the banner exists for. One height, one place. */

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
