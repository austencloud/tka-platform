<!--
  FirstRunWizard - First-time user onboarding wizard

  Orchestrates the first-run experience:
  1. Welcome screen
  2. Display name input
  3. Favorite prop selection
  4. Pictograph mode preference

  Collects user preferences and applies them to settings.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { savePropPreferences } from "$lib/shared/community/services/prop-preference-persister";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { FirstRunStep } from "../../domain/first-run-types";
  import { authState } from "$lib/shared/auth/state/authState.svelte";

  import WelcomeStep from "./steps/WelcomeStep.svelte";
  import DisplayNameStep from "./steps/DisplayNameStep.svelte";
  import ThemePickerStep from "./steps/ThemePickerStep.svelte";
  import PropPickerStep from "./steps/PropPickerStep.svelte";
  import PictographModeStep from "./steps/PictographModeStep.svelte";
  import AuthStep from "./steps/AuthStep.svelte";
  import BetaDiscoveryStep from "./steps/BetaDiscoveryStep.svelte";
  import DesktopConfigPanel from "./DesktopConfigPanel.svelte";

  interface Props {
    onComplete: () => void;
    onSkip: () => void;
  }

  const { onComplete, onSkip }: Props = $props();

  // Auth state - if authenticated, skip auth step (user signed up via LandingPage)
  const isAuthenticated = $derived(authState.isAuthenticated);

  // Desktop detection
  const DESKTOP_BREAKPOINT = 1024;
  let windowWidth = $state(typeof window !== "undefined" ? window.innerWidth : 0);
  const isDesktop = $derived(windowWidth >= DESKTOP_BREAKPOINT);

  // Wizard state
  let currentStep = $state<FirstRunStep>("betaDiscovery");
  let animateIn = $state(false);

  // Collected data
  let displayName = $state("");
  let pronouns = $state("");
  let selectedTheme = $state<BackgroundType>(
    settingsService.settings.backgroundType ?? BackgroundType.WINTER
  );
  let favoriteProp = $state<PropType>(
    settingsService.settings.bluePropType ?? PropType.STAFF
  );
  let pictographMode = $state<"light" | "dark">(
    getAnimationVisibilityManager().isDarkMode() ? "dark" : "light"
  );

  // Services
  let hapticService: HapticFeedback | null = null;

  // All possible steps (auth step only shown if not already authenticated)
  const ALL_STEPS: FirstRunStep[] = [
    "betaDiscovery",
    "welcome",
    "displayName",
    "theme",
    "favoriteProp",
    "pictographMode",
    "auth",
  ];

  // Desktop collapses 4 config steps into one "displayName" step
  const DESKTOP_STEPS: FirstRunStep[] = [
    "betaDiscovery",
    "welcome",
    "displayName",
    "auth",
  ];

  // Filter steps based on screen size and auth state
  const STEPS = $derived.by(() => {
    const base = isDesktop ? DESKTOP_STEPS : ALL_STEPS;
    return isAuthenticated ? base.filter((step) => step !== "auth") : base;
  });

  // Icons for each step (desktop uses gear for the combined config step)
  const STEP_ICONS = $derived<Record<FirstRunStep, string>>({
    betaDiscovery: "fa-gem",
    welcome: "fa-infinity",
    displayName: isDesktop ? "fa-sliders-h" : "fa-user",
    theme: "fa-moon",
    favoriteProp: "fa-fire",
    pictographMode: "fa-lightbulb",
    auth: "fa-user-plus",
  });

  const currentStepIndex = $derived(STEPS.indexOf(currentStep));
  const progress = $derived(((currentStepIndex + 1) / STEPS.length) * 100);

  onMount(() => {
    try {
      hapticService = getHapticFeedback();
    } catch {
      // Haptics optional
    }

    // Track window width for desktop detection
    function handleResize() {
      windowWidth = window.innerWidth;
    }
    window.addEventListener("resize", handleResize);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      animateIn = true;
    });

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  });

  // When resizing to desktop while on a mobile-only config step, snap to "displayName"
  $effect(() => {
    const MOBILE_CONFIG_STEPS: FirstRunStep[] = ["theme", "favoriteProp", "pictographMode"];
    if (isDesktop && MOBILE_CONFIG_STEPS.includes(currentStep)) {
      currentStep = "displayName";
    }
  });

  function transitionTo(step: FirstRunStep) {
    hapticService?.trigger("selection");
    animateIn = false;

    requestAnimationFrame(() => {
      currentStep = step;
      requestAnimationFrame(() => {
        animateIn = true;
      });
    });
  }

  function handleNext(step: FirstRunStep) {
    transitionTo(step);
  }

  function handleBack() {
    const prevIndex = currentStepIndex - 1;
    const prevStep = STEPS[prevIndex];
    if (prevIndex >= 0 && prevStep) {
      transitionTo(prevStep);
    }
  }

  function handleDisplayNameComplete(name: string, userPronouns: string) {
    displayName = name;
    pronouns = userPronouns;
    handleNext("theme");
  }

  function handleDisplayNameSkip() {
    // Keep empty display name, move on
    handleNext("theme");
  }

  function handleThemeComplete(theme: BackgroundType) {
    selectedTheme = theme;
    handleNext("favoriteProp");
  }

  function handleThemeSkip() {
    // Keep default theme (Winter)
    handleNext("favoriteProp");
  }

  // Live preview - applies theme immediately when user clicks a card
  async function handleThemePreview(theme: BackgroundType) {
    hapticService?.trigger("selection");
    selectedTheme = theme;
    // Apply theme immediately for live preview
    try {
      await settingsService.updateSetting("backgroundType", theme);
      // Also update theme colors
      const { applyThemeForBackground } =
        await import("$lib/shared/settings/utils/background-theme-calculator");
      applyThemeForBackground(theme);
    } catch (error) {
      console.error("Failed to preview theme:", error);
    }
  }

  async function handlePropComplete(prop: PropType) {
    favoriteProp = prop;
    // Apply prop type immediately so pictographs show correct prop on next screen
    try {
      await settingsService.updateSettings({
        bluePropType: prop,
        redPropType: prop,
      });
    } catch (error) {
      console.error("Failed to apply prop type:", error);
    }

    // Persist to user profile as prop preference
    try {
      const userId = authState.user?.uid;
      if (userId) {
        await savePropPreferences(userId, {
          propsISpinWith: [prop],
          favoriteProp: prop,
          favoriteCatdog: null,
        });
      }
    } catch (error) {
      console.error("Failed to save prop preference to profile:", error);
      // Non-blocking - onboarding continues even if profile save fails
    }

    handleNext("pictographMode");
  }

  async function handlePropSkip() {
    // Keep default prop (Staff) - apply it immediately
    try {
      await settingsService.updateSettings({
        bluePropType: PropType.STAFF,
        redPropType: PropType.STAFF,
      });
    } catch (error) {
      console.error("Failed to apply default prop type:", error);
    }
    handleNext("pictographMode");
  }

  async function handleModeComplete(mode: "light" | "dark") {
    pictographMode = mode;
    // Apply mode setting immediately for live preview
    const visibilityManager = getAnimationVisibilityManager();
    visibilityManager.setDarkMode(mode === "dark");

    // If already authenticated (came from LandingPage), complete the wizard
    // Otherwise, go to auth step
    if (isAuthenticated) {
      await applyPreferencesAndComplete();
    } else {
      handleNext("auth");
    }
  }

  function handleModeSkip() {
    // Keep default mode (light)
    if (isAuthenticated) {
      applyPreferencesAndComplete();
    } else {
      handleNext("auth");
    }
  }

  /**
   * Apply all collected preferences and complete the wizard.
   * Called after final step when user is already authenticated.
   */
  async function applyPreferencesAndComplete() {
    hapticService?.trigger("success");

  try {
      // Update display name if provided
      if (displayName.trim()) {
        await settingsService.updateSetting("userName", displayName.trim());
      }

      // Update pronouns if provided (non-blocking)
      if (pronouns.trim()) {
        authState.updatePronouns(pronouns.trim()).catch((err) => {
          console.error("Failed to save pronouns:", err);
        });
      }

      // Update prop type for both hands
      await settingsService.updateSettings({
        bluePropType: favoriteProp,
        redPropType: favoriteProp,
      });

      // Ensure pictograph mode is set
      const visibilityManager = getAnimationVisibilityManager();
      visibilityManager.setDarkMode(pictographMode === "dark");
    } catch (error) {
      console.error("Failed to apply first-run settings:", error);
    }

    // Complete onboarding
    onComplete();
  }

  async function handleAuthComplete() {
    // Auth step completed - apply preferences and finish
    await applyPreferencesAndComplete();
  }

  function handleSkipAll() {
    hapticService?.trigger("selection");
    // If already authenticated, complete immediately with defaults
    // Otherwise, go to auth step (auth is required)
    if (isAuthenticated) {
      applyPreferencesAndComplete();
    } else {
      transitionTo("auth");
    }
  }

  async function handleDesktopConfigComplete(data: {
    displayName: string;
    pronouns: string;
    theme: BackgroundType;
    prop: PropType;
    mode: "light" | "dark";
  }) {
    displayName = data.displayName;
    pronouns = data.pronouns;
    selectedTheme = data.theme;
    favoriteProp = data.prop;
    pictographMode = data.mode;

    // Apply prop type immediately
    try {
      await settingsService.updateSettings({
        bluePropType: data.prop,
        redPropType: data.prop,
      });
    } catch (error) {
      console.error("Failed to apply prop type:", error);
    }

    // Apply pictograph mode
    const visibilityManager = getAnimationVisibilityManager();
    visibilityManager.setDarkMode(data.mode === "dark");

    if (isAuthenticated) {
      await applyPreferencesAndComplete();
    } else {
      handleNext("auth");
    }
  }

  async function handleQuickStart() {
    // Apply sensible defaults
    hapticService?.trigger("selection");

    try {
      // Apply default settings (staff prop, light mode, current theme)
      await settingsService.updateSettings({
        bluePropType: PropType.STAFF,
        redPropType: PropType.STAFF,
      });

      // Default to Light Mode
      const visibilityManager = getAnimationVisibilityManager();
      visibilityManager.setDarkMode(false);
    } catch (error) {
      console.error("Failed to apply default settings:", error);
    }

    // If already authenticated, complete immediately
    // Otherwise, go to auth step (required for all users)
    if (isAuthenticated) {
      onComplete();
    } else {
      transitionTo("auth");
    }
  }
</script>

<div class="first-run-wizard" class:animate-in={animateIn}>
  <!-- Progress bar -->
  <div class="progress-bar">
    <div class="progress-fill" style="width: {progress}%"></div>
  </div>

  <!-- Skip button (hidden on beta discovery step and desktop config panel which has its own) -->
  {#if currentStep !== "betaDiscovery" && !(currentStep === "displayName" && isDesktop)}
    <button class="skip-button" onclick={handleSkipAll}>Skip all</button>
  {/if}

  <!-- Step content -->
  <div class="step-container" class:desktop-config={currentStep === "displayName" && isDesktop}>
    {#if currentStep === "betaDiscovery"}
      <BetaDiscoveryStep onNext={() => handleNext("welcome")} />
    {:else if currentStep === "welcome"}
      <WelcomeStep
        onNext={() => handleNext("displayName")}
        onQuickStart={handleQuickStart}
      />
    {:else if currentStep === "displayName" && isDesktop}
      <DesktopConfigPanel
        initialDisplayName={displayName}
        initialPronouns={pronouns}
        initialTheme={selectedTheme}
        initialProp={favoriteProp}
        initialMode={pictographMode}
        onComplete={handleDesktopConfigComplete}
        onBack={handleBack}
        onSkip={handleSkipAll}
        onThemePreview={handleThemePreview}
      />
    {:else if currentStep === "displayName"}
      <DisplayNameStep
        initialValue={displayName}
        initialPronouns={pronouns}
        onNext={handleDisplayNameComplete}
        onBack={handleBack}
        onSkip={handleDisplayNameSkip}
      />
    {:else if currentStep === "theme"}
      <ThemePickerStep
        initialValue={selectedTheme}
        onNext={handleThemeComplete}
        onBack={handleBack}
        onSkip={handleThemeSkip}
        onPreview={handleThemePreview}
      />
    {:else if currentStep === "favoriteProp"}
      <PropPickerStep
        initialValue={favoriteProp}
        onNext={handlePropComplete}
        onBack={handleBack}
        onSkip={handlePropSkip}
      />
    {:else if currentStep === "pictographMode"}
      <PictographModeStep
        initialValue={pictographMode}
        isFinalStep={isAuthenticated}
        onComplete={handleModeComplete}
        onBack={handleBack}
        onSkip={handleModeSkip}
      />
    {:else if currentStep === "auth"}
      <AuthStep onComplete={handleAuthComplete} onBack={handleBack} />
    {/if}
  </div>

  <!-- Step indicator dots with icons -->
  <div class="step-dots">
    {#each STEPS as step, i}
      <button
        class="dot"
        class:active={i === currentStepIndex}
        class:completed={i < currentStepIndex}
        onclick={() => {
          if (i < currentStepIndex) {
            transitionTo(step);
          }
        }}
        disabled={i > currentStepIndex}
        aria-label="Step {i + 1}: {step}"
      >
        <i class="fas {STEP_ICONS[step]}" aria-hidden="true"></i>
      </button>
    {/each}
  </div>
</div>

<style>
  .first-run-wizard {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    z-index: var(--z-priority);
    overflow-y: auto;
  }

  /* Progress bar */
  .progress-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.1);
  }

  .progress-fill {
    height: 100%;
    background: var(--theme-accent-strong, #8b5cf6);
    transition: width var(--duration-emphasis) ease;
  }

  /* Skip button */
  .skip-button {
    position: fixed;
    top: 16px;
    right: 16px;
    padding: 8px 16px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.875rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .skip-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    border-color: rgba(255, 255, 255, 0.3);
  }

  /* Step container */
  .step-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 600px;
    padding: 0 16px 90px;
  }

  .step-container.desktop-config {
    max-width: 980px;
  }

  /* Animation */
  .first-run-wizard :global(.beta-discovery-step),
  .first-run-wizard :global(.welcome-step),
  .first-run-wizard :global(.display-name-step),
  .first-run-wizard :global(.theme-picker-step),
  .first-run-wizard :global(.prop-picker-step),
  .first-run-wizard :global(.pictograph-mode-step),
  .first-run-wizard :global(.auth-step),
  .first-run-wizard :global(.desktop-config-panel) {
    opacity: 0;
    transform: translateY(20px);
    transition:
      opacity 0.4s ease,
      transform 0.4s ease;
  }

  .first-run-wizard.animate-in :global(.beta-discovery-step),
  .first-run-wizard.animate-in :global(.welcome-step),
  .first-run-wizard.animate-in :global(.display-name-step),
  .first-run-wizard.animate-in :global(.theme-picker-step),
  .first-run-wizard.animate-in :global(.prop-picker-step),
  .first-run-wizard.animate-in :global(.pictograph-mode-step),
  .first-run-wizard.animate-in :global(.auth-step),
  .first-run-wizard.animate-in :global(.desktop-config-panel) {
    opacity: 1;
    transform: translateY(0);
  }

  /* Step dots with icons */
  .step-dots {
    position: fixed;
    bottom: 32px;
    display: flex;
    gap: 12px;
  }

  .dot {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    border: 2px solid rgba(255, 255, 255, 0.15);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    padding: 0;
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.9rem;
  }

  .dot:disabled {
    cursor: default;
  }

  .dot:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.7);
  }

  .dot.active {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 30%,
      transparent
    );
    border-color: var(--theme-accent-strong, #8b5cf6);
    color: var(--theme-accent-strong, #8b5cf6);
    transform: scale(1.1);
  }

  .dot.completed {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.4);
    color: rgba(255, 255, 255, 0.7);
  }

  /* Mobile */
  @media (max-width: 480px) {
    .skip-button {
      top: 12px;
      right: 12px;
      padding: 6px 12px;
      font-size: 0.8125rem;
    }

    .step-dots {
      bottom: 24px;
      gap: 10px;
    }

    .dot {
      width: 36px;
      height: 36px;
      font-size: 0.8rem;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .progress-fill {
      transition: none;
    }

    .first-run-wizard :global(.beta-discovery-step),
    .first-run-wizard :global(.welcome-step),
    .first-run-wizard :global(.display-name-step),
    .first-run-wizard :global(.theme-picker-step),
    .first-run-wizard :global(.prop-picker-step),
    .first-run-wizard :global(.pictograph-mode-step),
    .first-run-wizard :global(.auth-step),
    .first-run-wizard :global(.desktop-config-panel) {
      transition: none;
      opacity: 1;
      transform: none;
    }

    .dot,
    .skip-button {
      transition: none;
    }
  }
</style>
