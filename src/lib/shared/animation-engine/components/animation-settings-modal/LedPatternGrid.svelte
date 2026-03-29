<script lang="ts">
  import { onDestroy } from "svelte";
  import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";
  import {
    CATEGORY_LABELS,
    type PatternCategory,
    getPatternsByCategory,
    getPatternDescriptor,
  } from "../../domain/patterns/registry";

  const vm = getAnimationVisibilityManager();

  let activePatternId = $state(vm.getLedPatternId());
  let expandedCategory = $state<PatternCategory | null>(null);

  function handleVisibilityChange(): void {
    activePatternId = vm.getLedPatternId();
  }

  vm.registerObserver(handleVisibilityChange);
  onDestroy(() => vm.unregisterObserver(handleVisibilityChange));

  // Derive which category the active pattern belongs to
  const activeCategory = $derived(() => {
    const desc = getPatternDescriptor(activePatternId);
    return desc?.category ?? "solid";
  });

  function selectPattern(id: string) {
    vm.setLedPatternId(id);
  }

  function toggleCategory(category: PatternCategory) {
    if (expandedCategory === category) {
      expandedCategory = null;
    } else {
      expandedCategory = category;
    }
  }

  function isCategoryVisible(category: PatternCategory): boolean {
    return expandedCategory === category || activeCategory() === category;
  }

  const categories = Object.keys(CATEGORY_LABELS) as PatternCategory[];
</script>

<div class="pattern-grid">
  {#each categories as category}
    {@const patterns = getPatternsByCategory(category)}
    {@const isActive = activeCategory() === category}
    {@const isExpanded = isCategoryVisible(category)}
    <div class="category-group">
      <button
        type="button"
        class="category-header"
        class:has-active={isActive}
        onclick={() => toggleCategory(category)}
        aria-expanded={isExpanded}
      >
        <span class="category-label">{CATEGORY_LABELS[category]}</span>
        {#if !isExpanded}
          <span class="active-indicator">
            {getPatternDescriptor(activePatternId)?.category === category
              ? getPatternDescriptor(activePatternId)?.name ?? ""
              : ""}
          </span>
        {/if}
        <span class="chevron" class:open={isExpanded}>
          <i class="fas fa-chevron-down" aria-hidden="true"></i>
        </span>
      </button>
      {#if isExpanded}
        <div class="pattern-row">
          {#each patterns as pattern (pattern.id)}
            <button
              type="button"
              class="pattern-btn"
              class:active={activePatternId === pattern.id}
              aria-pressed={activePatternId === pattern.id}
              onclick={() => selectPattern(pattern.id)}
            >
              {pattern.name}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .pattern-grid {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .category-group {
    display: flex;
    flex-direction: column;
  }

  .category-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 4px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    min-height: 32px;
  }

  .category-header:hover {
    color: var(--theme-text, white);
  }

  .category-header.has-active {
    color: var(--theme-text, white);
  }

  .category-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .active-indicator {
    font-size: 11px;
    font-weight: 400;
    color: var(--theme-accent, #8b5cf6);
    margin-left: auto;
  }

  .chevron {
    font-size: 9px;
    transition: transform 150ms ease;
    margin-left: auto;
  }

  .active-indicator + .chevron {
    margin-left: 0;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .pattern-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    padding: 4px 0 8px;
  }

  .pattern-btn {
    flex: 1 1 auto;
    min-width: 60px;
    min-height: 36px;
    padding: 6px 8px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 100ms ease;
  }

  .pattern-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .pattern-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, white);
  }

  .pattern-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .pattern-btn,
    .chevron {
      transition: none;
    }
  }
</style>
