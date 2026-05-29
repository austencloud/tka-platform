<!--
PositionsConceptExperience - Three-phase hand positions learning flow.
Phase 1: Discovery - place hands on grid to discover alpha/beta/gamma.
Phase 2: Construction Quiz - build requested positions from prompts.
Phase 3: Speed Rounds - rapid classification drill.
Phase 4: Complete - summary and continue.

Supports keyboard navigation (arrow keys between phases) and accessibility features.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { createPositionsExperienceState } from "./positions-experience-state.svelte";
  import PositionsDiscoveryPhase from "./DiscoveryVariantA.svelte";
  import ConstructionQuiz from "./ConstructionQuiz.svelte";
  import SpeedRounds from "./SpeedRounds.svelte";
  import ExperienceProgressIndicator from "../ExperienceProgressIndicator.svelte";

  import type { ExperienceViewMode } from "../../../domain/types";

  let { onComplete, viewMode = "step" } = $props<{
    onComplete?: () => void;
    viewMode?: ExperienceViewMode;
  }>();

  const hapticService = getHapticFeedback();
  const experienceState = createPositionsExperienceState();

  const PHASE_STEP: Record<string, number> = {
    discovery: 1,
    "construction-quiz": 2,
    "speed-rounds": 3,
    complete: 4,
  };
  const totalSteps = 4;

  const currentStep = $derived(PHASE_STEP[experienceState.phase] ?? 1);

  // Container ref for focus management
  let containerRef = $state<HTMLDivElement | null>(null);

  onMount(() => {
    experienceState.startAnimations();
  });

  function handleKeydown(event: KeyboardEvent) {
    if (viewMode !== "step") return;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      navigateForward();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      navigateBack();
    }
  }

  function navigateForward() {
    hapticService?.trigger("selection");
    const phase = experienceState.phase;
    if (phase === "discovery" && experienceState.allDiscovered) {
      experienceState.advanceToQuiz();
    } else if (phase === "construction-quiz" && experienceState.quizPassed) {
      experienceState.advanceToSpeedRounds();
    }
    // Speed rounds and complete advance via their own callbacks
  }

  function navigateBack() {
    hapticService?.trigger("selection");
    const phase = experienceState.phase;
    if (phase === "construction-quiz") {
      experienceState.transitionTo("discovery");
    } else if (phase === "speed-rounds") {
      experienceState.transitionTo("construction-quiz");
    }
  }

  function handleSpeedRoundsComplete() {
    experienceState.complete();
  }

  function handleSkipToQuiz() {
    hapticService?.trigger("selection");
    experienceState.discoverType("alpha");
    experienceState.discoverType("beta");
    experienceState.discoverType("gamma");
    experienceState.advanceToQuiz();
  }

  function handleContinue() {
    experienceState.reset();
    onComplete?.();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="positions-experience"
  class:animate-in={experienceState.animateIn}
  bind:this={containerRef}
  onkeydown={handleKeydown}
  tabindex="0"
  role="application"
  aria-label="Positions lesson, use arrow keys to navigate"
>
  <!-- Accessibility: Live region for announcements -->
  <div class="sr-only" aria-live="polite" aria-atomic="true">
    {experienceState.announcement}
  </div>

  <!-- Accessibility: Skip link -->
  {#if experienceState.phase === "discovery"}
    <button class="skip-link" onclick={handleSkipToQuiz}>Skip to quiz</button>
  {/if}

  {#if experienceState.phase === "discovery"}
    <PositionsDiscoveryPhase {experienceState} />
  {:else if experienceState.phase === "construction-quiz"}
    <ConstructionQuiz {experienceState} />
  {:else if experienceState.phase === "speed-rounds"}
    <SpeedRounds {experienceState} onComplete={handleSpeedRoundsComplete} />
  {:else if experienceState.phase === "complete"}
    <div class="complete-screen anim-item" style="--anim-order: 0;">
      <div class="complete-icon anim-item" style="--anim-order: 1;">
        <i class="fas fa-check-circle"></i>
      </div>
      <h2 class="complete-heading anim-item" style="--anim-order: 2;">
        Positions Complete!
      </h2>
      <div class="complete-stats anim-item" style="--anim-order: 3;">
        <div class="stat">
          <span class="stat-value">{experienceState.quizScore}/{experienceState.quizTotal}</span>
          <span class="stat-label">Quiz Score</span>
        </div>
        <div class="stat">
          <span class="stat-value">{experienceState.bestStreak}</span>
          <span class="stat-label">Best Streak</span>
        </div>
      </div>
      <button
        class="continue-btn anim-item"
        style="--anim-order: 4;"
        onclick={handleContinue}
      >
        Continue
      </button>
    </div>
  {/if}

  <ExperienceProgressIndicator {currentStep} {totalSteps} />
</div>

<style>
  .positions-experience {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 1rem;
    overflow-y: auto;
    overflow-x: hidden;
    outline: none;
    position: relative;
  }

  /* Screen reader only */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Skip link - visible on focus */
  .skip-link {
    position: absolute;
    top: -100px;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.75rem 1.5rem;
    background: var(--theme-accent, #22d3ee);
    color: var(--theme-on-accent, #000);
    font-weight: 600;
    font-size: var(--font-size-sm, 0.875rem);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    z-index: var(--z-modal);
    transition: top var(--duration-normal, 200ms) ease;
  }

  .skip-link:focus {
    top: 1rem;
    outline: 2px solid white;
    outline-offset: 2px;
  }

  /* Completion screen */
  .complete-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    flex: 1;
    text-align: center;
    padding: 2rem;
  }

  .complete-icon {
    font-size: 4rem;
    color: var(--theme-accent, #22d3ee);
    filter: drop-shadow(0 0 20px rgba(34, 211, 238, 0.4));
  }

  .complete-heading {
    font-size: 1.75rem;
    font-weight: 800;
    color: var(--theme-text, #fff);
    margin: 0;
  }

  .complete-stats {
    display: flex;
    gap: 2rem;
    margin: 0.5rem 0;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--theme-accent, #22d3ee);
  }

  .stat-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .continue-btn {
    padding: 0.875rem 2.5rem;
    background: var(--theme-accent, #22d3ee);
    color: var(--theme-on-accent, #000);
    font-weight: 700;
    font-size: var(--font-size-min, 14px);
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition:
      transform var(--duration-normal, 200ms) ease,
      box-shadow var(--duration-normal, 200ms) ease;
  }

  .continue-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(34, 211, 238, 0.3);
  }

  .continue-btn:active {
    transform: translateY(0);
  }

  /* Staggered entrance animation system */
  :global(.positions-experience .anim-item) {
    opacity: 0;
    transform: translateY(20px);
  }

  :global(.positions-experience.animate-in .anim-item) {
    animation: fadeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: calc(var(--anim-order, 0) * 120ms);
  }

  @keyframes fadeSlideUp {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 600px) {
    .positions-experience {
      padding: 1rem;
    }

    .complete-heading {
      font-size: 1.5rem;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    :global(.positions-experience .anim-item) {
      opacity: 1;
      transform: none;
    }

    :global(.positions-experience.animate-in .anim-item) {
      animation: none;
      opacity: 1;
      transform: none;
    }
  }
</style>
