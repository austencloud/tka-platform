<!--
  FirstRunWizard - First-time user onboarding wizard

  Deliberately minimal: beta notice -> welcome -> display name. Theme,
  favorite prop, and pictograph mode were cut (2026-06-04) so a new user —
  e.g. a festival QR scanner — gets from sign-up to the composer in seconds.
  All of those have sensible defaults and remain configurable in Settings.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { FirstRunStep } from "../../domain/first-run-types";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";

  import WelcomeStep from "./steps/WelcomeStep.svelte";
  import DisplayNameStep from "./steps/DisplayNameStep.svelte";
  import AuthStep from "./steps/AuthStep.svelte";
  import BetaDiscoveryStep from "./steps/BetaDiscoveryStep.svelte";

  interface Props {
    onComplete: () => void;
    onSkip: () => void;
  }

  const { onComplete, onSkip }: Props = $props();
  // onSkip is part of the wizard contract (MainApplication wires it to
  // markSkipped) but the current flow always completes via onComplete.
  void onSkip;

  // Auth state - if authenticated, skip auth step (user signed up via auth sheet)
  const isAuthenticated = $derived(authState.isAuthenticated);

  // Wizard state
  let currentStep = $state<FirstRunStep>("betaDiscovery");
  let animateIn = $state(false);

  // Collected data
  let displayName = $state("");
  let pronouns = $state("");

  // Services
  let hapticService: HapticFeedback | null = null;

  // All possible steps (auth step only shown if not already authenticated)
  const ALL_STEPS: FirstRunStep[] = [
    "betaDiscovery",
    "welcome",
    "displayName",
    "auth",
  ];

  const STEPS = $derived(
    isAuthenticated ? ALL_STEPS.filter((step) => step !== "auth") : ALL_STEPS
  );

  const STEP_ICONS: Record<FirstRunStep, string> = {
    betaDiscovery: "fa-gem",
    welcome: "fa-infinity",
    displayName: "fa-user",
    auth: "fa-user-plus",
  };

  const currentStepIndex = $derived(STEPS.indexOf(currentStep));
  const progress = $derived(((currentStepIndex + 1) / STEPS.length) * 100);

  onMount(() => {
    try {
      hapticService = getHapticFeedback();
    } catch {
      // Haptics optional
    }

    // Trigger entrance animation
    requestAnimationFrame(() => {
      animateIn = true;
    });
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
    finishOrAuth();
  }

  function handleDisplayNameSkip() {
    // Keep empty display name, move on
    finishOrAuth();
  }

  /** Display name is the last config step: complete if signed in, else auth. */
  function finishOrAuth() {
    if (isAuthenticated) {
      void applyPreferencesAndComplete();
    } else {
      handleNext("auth");
    }
  }

  /**
   * Apply collected preferences and complete the wizard.
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
          toast.warning("Couldn't save your pronouns. Set them later in Settings.");
        });
      }
    } catch (error) {
      console.error("Failed to apply first-run settings:", error);
      // Surface a brief, non-blocking notice. Completion is intentional:
      // these preferences have safe defaults and remain editable in Settings,
      // so a save failure should never trap a new user in the wizard.
      toast.warning(
        "Couldn't save some preferences. You can update them later in Settings."
      );
    }

    // Complete onboarding regardless of settings-save outcome (see above).
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
      void applyPreferencesAndComplete();
    } else {
      transitionTo("auth");
    }
  }

  function handleQuickStart() {
    // Skip straight past the name step with defaults
    hapticService?.trigger("selection");
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

  <!-- Skip button (hidden on beta discovery step) -->
  {#if currentStep !== "betaDiscovery"}
    <button class="skip-button" onclick={handleSkipAll}>Skip all</button>
  {/if}

  <!-- Step content -->
  <div class="step-container">
    {#if currentStep === "betaDiscovery"}
      <BetaDiscoveryStep onNext={() => handleNext("welcome")} />
    {:else if currentStep === "welcome"}
      <WelcomeStep
        onNext={() => handleNext("displayName")}
        onQuickStart={handleQuickStart}
      />
    {:else if currentStep === "displayName"}
      <DisplayNameStep
        initialValue={displayName}
        initialPronouns={pronouns}
        onNext={handleDisplayNameComplete}
        onBack={handleBack}
        onSkip={handleDisplayNameSkip}
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
    background: var(--theme-panel-bg, rgba(0, 0, 0, 0.4));
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
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
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
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.875rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .skip-button:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
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

  /* Animation */
  .first-run-wizard :global(.beta-discovery-step),
  .first-run-wizard :global(.welcome-step),
  .first-run-wizard :global(.display-name-step),
  .first-run-wizard :global(.auth-step) {
    opacity: 0;
    transform: translateY(20px);
    transition:
      opacity 0.4s ease,
      transform 0.4s ease;
  }

  .first-run-wizard.animate-in :global(.beta-discovery-step),
  .first-run-wizard.animate-in :global(.welcome-step),
  .first-run-wizard.animate-in :global(.display-name-step),
  .first-run-wizard.animate-in :global(.auth-step) {
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
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    padding: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: 0.9rem;
  }

  .dot:disabled {
    cursor: default;
  }

  .dot:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
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
    background: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.4));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
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
    .first-run-wizard :global(.auth-step) {
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
