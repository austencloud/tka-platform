<!--
AccordionItem.svelte - Single accordion row for settings

Collapsed: Shows label + current value + chevron
Expanded: Shows options list below header

Behavior:
- Tap header to toggle
- Tap option to select and collapse
- Parent controls which item is expanded (mutual exclusivity)
-->
<script lang="ts">
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  interface Option {
    value: string | null;
    label: string;
  }

  let {
    label,
    options,
    value,
    expanded = false,
    onToggle,
    onSelect,
  }: {
    label: string;
    options: Option[];
    value: string | null | boolean;
    expanded: boolean;
    onToggle: () => void;
    onSelect: (value: string | null | boolean) => void;
  } = $props();

  // Find current selection label
  const currentLabel = $derived(
    options.find((o) => o.value === value)?.label || options[0]?.label || "—"
  );

  function handleSelect(optionValue: string | null | boolean) {
    onSelect(optionValue);
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

<div class="accordion-item" class:expanded>
  <!-- Header row - always visible -->
  <button
    class="accordion-header"
    onclick={onToggle}
    onkeydown={handleKeydown}
    aria-expanded={expanded}
  >
    <span class="accordion-label">{label}</span>
    <span class="accordion-value">
      <span>{currentLabel}</span>
      <i
        class="fas fa-chevron-down chevron"
        class:rotated={expanded}
        aria-hidden="true"
      ></i>
    </span>
  </button>

  <!-- Expanded options -->
  {#if expanded}
    <div
      class="accordion-options"
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
          <span class="option-radio" aria-hidden="true">
            {#if value === option.value}
              <i class="fas fa-circle"></i>
            {:else}
              <i class="far fa-circle"></i>
            {/if}
          </span>
          <span class="option-label">{option.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .accordion-item {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 12px);
    overflow: hidden;
    transition: border-color 150ms ease;
  }

  .accordion-item.expanded {
    border-color: var(--theme-accent, #6366f1);
  }

  /* Header */
  .accordion-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 48px;
    padding: 12px 16px;
    background: transparent;
    border: none;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .accordion-header:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
  }

  .accordion-label {
    font-weight: 600;
  }

  .accordion-value {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
  }

  .chevron {
    font-size: var(--font-size-compact, 12px);
    transition: transform 200ms ease;
  }

  .chevron.rotated {
    transform: rotate(180deg);
  }

  /* Options */
  .accordion-options {
    display: flex;
    flex-direction: column;
    padding: 0 12px 12px;
    gap: 6px;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 48px;
    padding: 12px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid transparent;
    border-radius: var(--settings-radius-sm, 8px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-min, 14px);
    text-align: left;
    cursor: pointer;
    transition: all 150ms ease;
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
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-text, #ffffff);
  }

  .option-radio {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-accent, #6366f1);
    width: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .option-label {
    font-weight: 500;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .accordion-item,
    .chevron,
    .option {
      transition: none;
    }
  }
</style>
