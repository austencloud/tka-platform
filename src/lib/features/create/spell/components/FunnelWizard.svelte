<!--
FunnelWizard.svelte - Multi-step filter wizard

Progressively narrows variations through a series of filter steps.
Shows count decreasing at each step (600 → 245 → 87 → 23).
Ends with "Pick Best" or "Browse All" selection.
-->
<script lang="ts">
  import type { ScoredVariation } from "../state/variation-state.svelte";
  import {
    createFunnelState,
    FUNNEL_STEPS,
    type FunnelFilters,
  } from "../state/funnel-state.svelte";
  import FunnelStep from "./FunnelStep.svelte";

  interface Props {
    variations: ScoredVariation[];
    onComplete: (selected: ScoredVariation) => void;
    onBrowse: (filtered: ScoredVariation[]) => void;
    onBack: () => void;
  }

  let { variations, onComplete, onBrowse, onBack }: Props = $props();

  // Create funnel state for this wizard instance
  const funnelState = createFunnelState();

  // Initialize with variations
  $effect(() => {
    funnelState.setVariations(variations);
  });

  // Get current filter value for the current step
  function getCurrentFilterValue(): unknown {
    const step = funnelState.currentStep;
    if (!step) return null;
    return funnelState.filters[step.filterKey];
  }

  // Handle option selection
  function handleOptionSelect(value: unknown) {
    const step = funnelState.currentStep;
    if (!step) return;
    funnelState.setFilter(step.filterKey, value as FunnelFilters[keyof FunnelFilters]);
  }

  // Handle "Pick Best" selection
  function handlePickBest() {
    const best = funnelState.bestVariation;
    if (best) {
      onComplete(best);
    }
  }

  // Handle "Browse All" selection
  function handleBrowseAll() {
    const filtered = funnelState.getFinalVariations();
    onBrowse(filtered);
  }

  // Handle navigation
  function handleNext() {
    funnelState.nextStep();
  }

  function handlePrevious() {
    if (funnelState.currentStepIndex === 0) {
      onBack();
    } else {
      funnelState.previousStep();
    }
  }

  function handleSkip() {
    funnelState.skipToEnd();
  }

  // Progress indicator
  const progressPercent = $derived(
    ((funnelState.currentStepIndex + 1) / (FUNNEL_STEPS.length + 1)) * 100
  );
</script>

<div class="funnel-wizard">
  <!-- Progress bar -->
  <div class="progress-container">
    <div
      class="progress-bar"
      style="width: {progressPercent}%"
      role="progressbar"
      aria-valuenow={funnelState.currentStepIndex + 1}
      aria-valuemin={1}
      aria-valuemax={FUNNEL_STEPS.length + 1}
    ></div>
  </div>

  <!-- Step indicators -->
  <div class="step-indicators">
    {#each FUNNEL_STEPS as step, index}
      <button
        class="step-indicator"
        class:active={index === funnelState.currentStepIndex}
        class:completed={index < funnelState.currentStepIndex}
        onclick={() => funnelState.goToStep(index)}
        title={step.title}
        aria-label="Go to step {index + 1}: {step.title}"
      >
        {index + 1}
      </button>
    {/each}
    <button
      class="step-indicator"
      class:active={funnelState.isComplete}
      class:completed={false}
      onclick={() => funnelState.skipToEnd()}
      title="Final Selection"
      aria-label="Go to final selection"
    >
      <i class="fas fa-check" aria-hidden="true"></i>
    </button>
  </div>

  <!-- Main content area -->
  <div class="wizard-content">
    {#if funnelState.isComplete}
      <!-- Final selection view -->
      <div class="final-selection">
        <div class="count-result">
          <span class="number">{funnelState.getFinalVariations().length}</span>
          <span class="label">variations match your preferences</span>
        </div>

        <div class="actions">
          <button class="action-button primary" onclick={handlePickBest}>
            <i class="fas fa-star" aria-hidden="true"></i>
            Pick Best
          </button>
          <button class="action-button secondary" onclick={handleBrowseAll}>
            Browse All {funnelState.getFinalVariations().length}
          </button>
        </div>

        {#if funnelState.bestVariation}
          <p class="best-hint">
            Best score: {funnelState.bestVariation.score.total}
          </p>
        {/if}
      </div>
    {:else if funnelState.currentStep}
      <!-- Current step -->
      <FunnelStep
        step={funnelState.currentStep}
        options={funnelState.getCurrentStepOptions()}
        currentValue={getCurrentFilterValue()}
        countBefore={funnelState.countBeforeFilter}
        countAfter={funnelState.countAfterFilter}
        onSelect={handleOptionSelect}
      />
    {/if}
  </div>

  <!-- Navigation buttons -->
  <div class="navigation">
    <button
      class="nav-button back"
      onclick={handlePrevious}
      aria-label={funnelState.currentStepIndex === 0 ? "Go back to setup" : "Previous step"}
    >
      <i class="fas fa-chevron-left" aria-hidden="true"></i>
      {funnelState.currentStepIndex === 0 ? "Back" : "Previous"}
    </button>

    {#if !funnelState.isComplete}
      <button class="nav-button skip" onclick={handleSkip}>
        Skip All
      </button>

      <button
        class="nav-button next"
        onclick={handleNext}
        aria-label={funnelState.isLastStep ? "Go to selection" : "Next step"}
      >
        {funnelState.isLastStep ? "Done" : "Next"}
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </button>
    {:else}
      <button class="nav-button next" onclick={() => funnelState.resetSteps()}>
        Start Over
        <i class="fas fa-redo" aria-hidden="true"></i>
      </button>
    {/if}
  </div>
</div>

<style>
  .funnel-wizard {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-lg, 24px);
    padding: var(--settings-spacing-md, 16px);
    max-width: 480px;
    margin: 0 auto;
  }

  /* Progress bar */
  .progress-container {
    height: 4px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: var(--theme-accent, #6366f1);
    transition: width var(--duration-emphasis) ease;
  }

  /* Step indicators */
  .step-indicators {
    display: flex;
    justify-content: center;
    gap: var(--settings-spacing-sm, 8px);
  }

  .step-indicator {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 50%;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .step-indicator:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .step-indicator:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .step-indicator.active {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: white;
  }

  .step-indicator.completed {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 30%, transparent);
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-accent, #6366f1);
  }

  /* Main content */
  .wizard-content {
    min-height: 200px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  /* Final selection */
  .final-selection {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--settings-spacing-lg, 24px);
    text-align: center;
  }

  .count-result {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .count-result .number {
    font-size: 48px;
    font-weight: 700;
    color: var(--theme-accent, #6366f1);
    line-height: 1;
  }

  .count-result .label {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--settings-spacing-sm, 8px);
    justify-content: center;
  }

  .action-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: var(--settings-spacing-md, 16px) var(--settings-spacing-lg, 24px);
    min-height: 48px;
    border-radius: var(--settings-radius-md, 12px);
    font-size: var(--font-size-md, 16px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .action-button.primary {
    background: var(--theme-accent, #6366f1);
    border: none;
    color: white;
  }

  .action-button.primary:hover {
    background: var(--theme-accent-hover, #4f46e5);
  }

  .action-button.secondary {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #ffffff);
  }

  .action-button.secondary:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .action-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .best-hint {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  /* Navigation */
  .navigation {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
  }

  .nav-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    min-height: 48px;
    background: transparent;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-sm, 8px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .nav-button:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .nav-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .nav-button.skip {
    font-size: var(--font-size-compact, 12px);
    padding: var(--settings-spacing-xs, 4px) var(--settings-spacing-sm, 8px);
    min-height: 36px;
  }

  .nav-button.next {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: white;
  }

  .nav-button.next:hover {
    background: var(--theme-accent-hover, #4f46e5);
    border-color: var(--theme-accent-hover, #4f46e5);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .progress-bar,
    .step-indicator,
    .action-button,
    .nav-button {
      transition: none;
    }
  }
</style>
