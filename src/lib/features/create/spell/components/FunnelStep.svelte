<!--
FunnelStep.svelte - Individual wizard step

Displays a question with selectable options.
Each option shows how many variations would match that choice.
-->
<script lang="ts">
  import type { FunnelOption, FunnelStepDefinition } from "../state/funnel-state.svelte";

  interface Props {
    step: FunnelStepDefinition;
    options: FunnelOption[];
    currentValue: unknown;
    countBefore: number;
    countAfter: number;
    onSelect: (value: unknown) => void;
  }

  let { step, options, currentValue, countBefore, countAfter, onSelect }: Props =
    $props();

  function isSelected(option: FunnelOption): boolean {
    return option.value === currentValue;
  }

  function handleOptionClick(option: FunnelOption) {
    onSelect(option.value);
  }
</script>

<div class="funnel-step">
  <div class="step-header">
    <h3 class="step-title">{step.title}</h3>
    <p class="step-question">{step.question}</p>
  </div>

  <div class="options-grid" role="radiogroup" aria-label={step.question}>
    {#each options as option}
      <button
        class="option-button"
        class:selected={isSelected(option)}
        onclick={() => handleOptionClick(option)}
        role="radio"
        aria-checked={isSelected(option)}
      >
        <span class="option-label">{option.label}</span>
        <span class="option-count">({option.count})</span>
      </button>
    {/each}
  </div>

  <div class="count-transition" aria-live="polite">
    <span class="count-before">{countBefore}</span>
    <span class="arrow" aria-hidden="true">→</span>
    <span class="count-after" class:decreased={countAfter < countBefore}>
      {countAfter}
    </span>
    <span class="count-label">remaining</span>
  </div>
</div>

<style>
  .funnel-step {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-md, 16px);
  }

  .step-header {
    text-align: center;
  }

  .step-title {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .step-question {
    margin: 4px 0 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .options-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--settings-spacing-sm, 8px);
    justify-content: center;
  }

  .option-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    min-height: 48px;
    min-width: 100px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 24px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .option-button:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .option-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .option-button.selected {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: white;
  }

  .option-button.selected:hover {
    background: var(--theme-accent-hover, #4f46e5);
    border-color: var(--theme-accent-hover, #4f46e5);
  }

  .option-label {
    font-weight: 500;
  }

  .option-count {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.8;
  }

  .count-transition {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-sm, 8px);
    padding: var(--settings-spacing-sm, 8px);
    font-size: var(--font-size-md, 16px);
    font-weight: 600;
  }

  .count-before {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .arrow {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .count-after {
    color: var(--theme-text, #ffffff);
    transition: color var(--duration-emphasis) ease;
  }

  .count-after.decreased {
    color: var(--theme-accent, #6366f1);
  }

  .count-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 400;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .option-button,
    .count-after {
      transition: none;
    }
  }
</style>
