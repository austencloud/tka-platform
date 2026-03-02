<!--
  CreateTutorialWizard - Post-onboarding tutorial for learning the Create workflow

  Teaches new users the core build loop by embedding live Create module components.
  Steps auto-advance when the user completes each action (no Continue button).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import {
    createTutorialState,
    type CreateTutorialStep,
  } from "../../state/create-tutorial-state.svelte";

  // Step components (will be created in Tasks 4-8)
  import PickStartPositionStep from "./steps/PickStartPositionStep.svelte";
  import AddBeatStep from "./steps/AddBeatStep.svelte";
  import OpenActionsStep from "./steps/OpenActionsStep.svelte";
  import PlaySequenceStep from "./steps/PlaySequenceStep.svelte";
  import ReadyStep from "./steps/ReadyStep.svelte";

  interface Props {
    onComplete: () => void;
    onSkip: () => void;
  }

  const { onComplete, onSkip }: Props = $props();

  let animateIn = $state(false);
  let hapticService: IHapticFeedback | null = null;

  const STEP_ICONS: Record<CreateTutorialStep, string> = {
    "pick-start": "fa-crosshairs",
    "add-beat": "fa-plus",
    "open-actions": "fa-tools",
    "play-sequence": "fa-play",
    ready: "fa-rocket",
  };

  const STEPS: CreateTutorialStep[] = [
    "pick-start",
    "add-beat",
    "open-actions",
    "play-sequence",
    "ready",
  ];

  onMount(() => {
    try {
      hapticService = container.items.hapticFeedback;
    } catch {
      // Haptics optional
    }

    requestAnimationFrame(() => {
      animateIn = true;
    });
  });

  function handleAdvance() {
    hapticService?.trigger("selection");
    animateIn = false;

    requestAnimationFrame(() => {
      if (createTutorialState.currentStep === "ready") {
        // Last step — complete the tutorial
        onComplete();
        return;
      }

      createTutorialState.advance();

      requestAnimationFrame(() => {
        animateIn = true;
      });
    });
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

  <!-- Skip button -->
  <button class="skip-button" onclick={handleSkip}>Skip tutorial</button>

  <!-- Step content -->
  <div class="step-container">
    {#if createTutorialState.currentStep === "pick-start"}
      <PickStartPositionStep onAdvance={handleAdvance} />
    {:else if createTutorialState.currentStep === "add-beat"}
      <AddBeatStep onAdvance={handleAdvance} />
    {:else if createTutorialState.currentStep === "open-actions"}
      <OpenActionsStep onAdvance={handleAdvance} />
    {:else if createTutorialState.currentStep === "play-sequence"}
      <PlaySequenceStep onAdvance={handleAdvance} />
    {:else if createTutorialState.currentStep === "ready"}
      <ReadyStep onAdvance={handleAdvance} />
    {/if}
  </div>

  <!-- Step dots with icons -->
  <div class="step-dots">
    {#each STEPS as step, i}
      <div
        class="dot"
        class:active={i === createTutorialState.currentStepIndex}
        class:completed={i < createTutorialState.currentStepIndex}
        aria-label="Step {i + 1}: {step}"
      >
        <i class="fas {STEP_ICONS[step]}" aria-hidden="true"></i>
      </div>
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
    z-index: 10000;
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
    transition: width var(--duration-emphasis, 0.6s) ease;
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
    transition: all var(--duration-normal, 0.3s) ease;
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
    max-width: 780px;
    padding: 0 16px 90px;
  }

  /* Entrance animation for step content */
  .create-tutorial-wizard :global(.tutorial-step) {
    opacity: 0;
    transform: translateY(20px);
    transition:
      opacity 0.4s ease,
      transform 0.4s ease;
  }

  .create-tutorial-wizard.animate-in :global(.tutorial-step) {
    opacity: 1;
    transform: translateY(0);
  }

  /* Step dots */
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
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.9rem;
    transition: all var(--duration-normal, 0.3s) ease;
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

    .create-tutorial-wizard :global(.tutorial-step) {
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
