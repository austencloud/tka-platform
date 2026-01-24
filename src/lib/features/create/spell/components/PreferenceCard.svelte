<!--
PreferenceCard.svelte - Expandable preference selector

A card that:
- Shows label + current value when collapsed
- Expands smoothly to reveal options when tapped
- Collapses when an option is selected or user taps elsewhere
- Feels organic and fluid, not jarring
-->
<script lang="ts">
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  interface Option {
    value: string | null;
    label: string;
    icon?: string;
    description?: string;
  }

  let {
    label,
    options,
    value,
    onSelect,
    expanded = false,
    onToggle,
  }: {
    label: string;
    options: Option[];
    value: string | null;
    onSelect: (value: string | null) => void;
    expanded?: boolean;
    onToggle: () => void;
  } = $props();

  // Find current selection label
  const currentLabel = $derived(
    options.find((o) => o.value === value)?.label || options[0]?.label || "Select"
  );

  const currentIcon = $derived(options.find((o) => o.value === value)?.icon);

  function handleSelect(optionValue: string | null) {
    onSelect(optionValue);
    // Collapse card after selection for smooth flow
    onToggle();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle();
    }
    if (event.key === "Escape" && expanded) {
      event.preventDefault();
      onToggle();
    }
  }
</script>

<div class="preference-card" class:expanded>
  <!-- Collapsed Header (always visible) -->
  <button
    class="card-header"
    onclick={onToggle}
    onkeydown={handleKeydown}
    aria-expanded={expanded}
    aria-controls="options-{label.toLowerCase().replace(/\s+/g, '-')}"
  >
    <span class="card-label">{label}</span>
    <span class="card-value">
      {#if currentIcon}
        <i class="fas {currentIcon}" aria-hidden="true"></i>
      {/if}
      <span>{currentLabel}</span>
      <i
        class="fas fa-chevron-down chevron"
        class:rotated={expanded}
        aria-hidden="true"
      ></i>
    </span>
  </button>

  <!-- Expanded Options -->
  {#if expanded}
    <div
      class="card-options"
      id="options-{label.toLowerCase().replace(/\s+/g, '-')}"
      transition:slide={{ duration: 200, easing: cubicOut }}
      role="radiogroup"
      aria-label="{label} options"
    >
      {#each options as option}
        <button
          class="option"
          class:selected={value === option.value}
          onclick={() => handleSelect(option.value)}
          role="radio"
          aria-checked={value === option.value}
        >
          <span class="option-content">
            {#if option.icon}
              <i class="fas {option.icon}" aria-hidden="true"></i>
            {/if}
            <span class="option-label">{option.label}</span>
          </span>
          {#if option.description}
            <span class="option-description">{option.description}</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .preference-card {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 12px);
    overflow: hidden;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .preference-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .preference-card.expanded {
    border-color: var(--theme-accent, #6366f1);
    box-shadow: 0 0 0 1px var(--theme-accent, #6366f1);
  }

  /* Header */
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 56px;
    padding: var(--settings-spacing-md, 16px);
    background: transparent;
    border: none;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-md, 16px);
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .card-header:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
    border-radius: var(--settings-radius-md, 12px);
  }

  .card-label {
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .card-value {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-xs, 4px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-weight: 500;
  }

  .card-value i:first-child {
    color: var(--theme-accent, #6366f1);
  }

  .chevron {
    margin-left: var(--settings-spacing-xs, 4px);
    font-size: var(--font-size-compact, 12px);
    opacity: 0.5;
    transition: transform 0.2s ease;
  }

  .chevron.rotated {
    transform: rotate(180deg);
  }

  /* Options Panel */
  .card-options {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-xs, 4px);
    padding: 0 var(--settings-spacing-md, 16px) var(--settings-spacing-md, 16px);
  }

  .option {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--settings-spacing-xs, 4px);
    width: 100%;
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    min-height: 48px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid transparent;
    border-radius: var(--settings-radius-sm, 8px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-min, 14px);
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .option:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .option:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .option.selected {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 20%, transparent);
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-text, #ffffff);
  }

  .option-content {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
    font-weight: 500;
  }

  .option-content i {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-accent, #6366f1);
    width: 20px;
    text-align: center;
  }

  .option-label {
    flex: 1;
  }

  .option-description {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    padding-left: 28px; /* Align with label when icon present */
  }

  .option:not(:has(.option-content i)) .option-description {
    padding-left: 0;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .preference-card,
    .chevron,
    .option {
      transition: none;
    }
  }
</style>
