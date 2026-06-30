<!--
  CreateTutorialWizard - Post-onboarding tutorial for learning the Create workflow

  Teaches new users the core build loop by embedding live Create module components.
  Steps auto-advance when the user completes each action (no Continue button).
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import {
    createTutorialState,
    type CreateTutorialStep,
  } from "../../state/create-tutorial-state.svelte";

  // Step components (will be created in Tasks 4-8)
  import PickStartPositionStep from "./steps/PickStartPositionStep.svelte";
  import AddStepTutorialStep from "./steps/AddStepTutorialStep.svelte";
  import PlaySequenceStep from "./steps/PlaySequenceStep.svelte";
  import ReadyStep from "./steps/ReadyStep.svelte";

  interface Props {
    onComplete: () => void;
    onSkip: () => void;
  }

  const { onComplete, onSkip }: Props = $props();

  let animateIn = $state(false);
  let hapticService: HapticFeedback | null = null;

  const STEP_ICONS: Record<CreateTutorialStep, string> = {
    "pick-start": "fa-crosshairs",
    "add-step": "fa-plus",
    "play-sequence": "fa-play",
    ready: "fa-rocket",
  };

  const STEPS: CreateTutorialStep[] = [
    "pick-start",
    "add-step",
    "play-sequence",
    "ready",
  ];

  onMount(() => {
    try {
      hapticService = getHapticFeedback();
    } catch {
      // Haptics optional
    }

    requestAnimationFrame(() => {
      animateIn = true;
    });
  });

  // Step exit duration — the outgoing card lifts + fades before we swap.
  // Kept in sync with the .tutorial-step transition below.
  const STEP_EXIT_MS = 230;

  function prefersReducedMotion(): boolean {
    return (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
    );
  }

  // Play the outgoing card's exit, run `swap`, then spring the new card in.
  function transitionStep(swap: () => void) {
    if (prefersReducedMotion()) {
      swap();
      animateIn = true;
      return;
    }
    animateIn = false;
    setTimeout(() => {
      swap();
      requestAnimationFrame(() => {
        animateIn = true;
      });
    }, STEP_EXIT_MS);
  }

  function handleAdvance() {
    hapticService?.trigger("selection");

    if (createTutorialState.currentStep === "ready") {
      // Last step - exit the card, then complete the tutorial.
      if (prefersReducedMotion()) {
        onComplete();
        return;
      }
      animateIn = false;
      setTimeout(onComplete, STEP_EXIT_MS);
      return;
    }

    transitionStep(() => createTutorialState.advance());
  }

  function handleBack() {
    if (createTutorialState.currentStepIndex === 0) return;
    hapticService?.trigger("selection");

    // On the add-step step with steps already picked, undo the last step
    // instead of leaving the step entirely
    if (
      createTutorialState.currentStep === "add-step" &&
      createTutorialState.steps.length > 0
    ) {
      createTutorialState.removeLastStep();
      return;
    }

    transitionStep(() => createTutorialState.goBack());
  }

  function handleDotClick(index: number) {
    if (index >= createTutorialState.currentStepIndex) return;
    hapticService?.trigger("selection");
    transitionStep(() => createTutorialState.goToStep(index));
  }

  function handleSkip() {
    hapticService?.trigger("selection");
    createTutorialState.reset();
    onSkip();
  }
</script>

<div class="create-tutorial-wizard" class:animate-in={animateIn}>
  <!-- Progress bar -->
  <div class="progress-bar">
    <div
      class="progress-fill"
      style="width: {createTutorialState.progress}%"
    ></div>
  </div>

  <!-- Navigation buttons -->
  {#if createTutorialState.currentStepIndex > 0}
    <button class="back-button" onclick={handleBack}>
      <i class="fas fa-arrow-left" aria-hidden="true"></i> Back
    </button>
  {/if}
  <button class="skip-button" onclick={handleSkip}>Skip tutorial</button>

  <!-- Step content -->
  <div class="step-container">
    {#if createTutorialState.currentStep === "pick-start"}
      <PickStartPositionStep onAdvance={handleAdvance} />
    {:else if createTutorialState.currentStep === "add-step"}
      <AddStepTutorialStep onAdvance={handleAdvance} />
    {:else if createTutorialState.currentStep === "play-sequence"}
      <PlaySequenceStep onAdvance={handleAdvance} />
    {:else if createTutorialState.currentStep === "ready"}
      <ReadyStep onAdvance={handleAdvance} />
    {/if}
  </div>

  <!-- Step dots with icons -->
  <div class="step-dots">
    {#each STEPS as step, i}
      {#if i < createTutorialState.currentStepIndex}
        <button
          class="dot completed"
          aria-label="Go back to step {i + 1}: {step}"
          onclick={() => handleDotClick(i)}
        >
          <i class="fas {STEP_ICONS[step]}" aria-hidden="true"></i>
        </button>
      {:else}
        <div
          class="dot"
          class:active={i === createTutorialState.currentStepIndex}
          aria-label="Step {i + 1}: {step}"
        >
          <i class="fas {STEP_ICONS[step]}" aria-hidden="true"></i>
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .create-tutorial-wizard {
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
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .progress-fill {
    height: 100%;
    background: var(--theme-accent-strong, #8b5cf6);
    transition: width var(--duration-emphasis, 0.6s) ease;
  }

  /* Back button */
  .back-button {
    position: fixed;
    top: 16px;
    left: 16px;
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.875rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all var(--duration-normal, 200ms) var(--ease-out);
  }

  .back-button:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  /* Skip button */
  .skip-button {
    position: fixed;
    top: 16px;
    right: 16px;
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.875rem;
    cursor: pointer;
    transition: all var(--duration-normal, 200ms) var(--ease-out);
  }

  .skip-button:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  /* Step container */
  .step-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 1100px;
    padding: 0 16px 90px;
  }

  /* Header wrapper — column on desktop, one compact line on mobile (see media query) */
  .create-tutorial-wizard :global(.step-header) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 100%;
  }

  /* Step transition: outgoing card lifts + fades, incoming springs up into place. */
  .create-tutorial-wizard :global(.tutorial-step) {
    opacity: 0;
    transform: translateY(26px) scale(0.965);
    transition:
      opacity 240ms ease,
      transform 440ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .create-tutorial-wizard.animate-in :global(.tutorial-step) {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  /* Step dots */
  .step-dots {
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
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
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.9rem;
    transition: all var(--duration-normal, 200ms) var(--ease-out);
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

  button.dot.completed {
    background: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    cursor: pointer;
    padding: 0;
  }

  button.dot.completed:hover {
    background: var(--theme-hover, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-accent-strong, #8b5cf6);
    color: var(--theme-accent-strong, #8b5cf6);
    transform: scale(1.1);
  }

  /* Mobile */
  @media (max-width: 480px) {
    .back-button {
      top: 12px;
      left: 12px;
      padding: 6px 12px;
      font-size: 0.8125rem;
    }

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

    .create-tutorial-wizard :global(.tutorial-step) {
      transition: none;
      opacity: 1;
      transform: none;
    }

    .dot,
    .skip-button,
    .back-button,
    button.dot.completed {
      transition: none;
    }
  }

  /* ── Mobile / small-tablet: fullscreen edge-to-edge ── */
  @media (max-width: 900px) {
    .step-container {
      padding: 0;
      max-width: none;
      align-items: stretch;
    }

    /* Strip card chrome for every step (0,2,0) > each step's own rule (0,1,0) */
    .create-tutorial-wizard :global(.tutorial-step) {
      max-width: none;
      width: 100%;
      border: none;
      border-radius: 0;
      min-height: 100dvh;
      box-sizing: border-box;
      padding-top: 56px; /* clear fixed Back/Skip buttons */
      padding-bottom: 88px; /* clear fixed step-dots */
      padding-left: max(8px, env(safe-area-inset-left));
      padding-right: max(8px, env(safe-area-inset-right));
    }

    /* Free the second axis so the device-aware fitter grows tiles both ways.
       (Ready's accordion is intentionally NOT filled — it stays content-sized.) */
    .create-tutorial-wizard :global(.picker-container),
    .create-tutorial-wizard :global(.viewer-container) {
      height: auto;
      flex: 1;
      min-height: 0;
    }

  }
</style>
