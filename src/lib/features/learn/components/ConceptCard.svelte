<!--
ConceptCard - Compact card for a single TKA concept

Displays:
- Left accent bar (status color)
- Concept icon
- Concept name
- Time estimate
- Checkmark for completed
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "../../../shared/application/services/haptic-feedback";
  import { CONCEPT_CATEGORIES } from "../domain/concepts";
  import type { LearnConcept, ConceptStatus } from "../domain/types";

  let {
    concept,
    status,
    premiumGated = false,
    onClick,
  }: {
    concept: LearnConcept;
    status: ConceptStatus;
    premiumGated?: boolean;
    onClick?: (concept: LearnConcept) => void;
  } = $props();

  const hapticService = getHapticFeedback();

  const isClickable = $derived(status !== "locked");

  // Status colors - referenced via --status-color CSS custom property
  const statusColors: Record<ConceptStatus, string> = {
    locked: "var(--theme-text-dim, #6B7280)",
    available: "var(--prop-blue, #4A90E2)",
    "in-progress": "var(--theme-accent, #7B68EE)",
    completed: "var(--semantic-success, #50C878)",
  };

  const statusColor = $derived(statusColors[status as ConceptStatus]);

  // Category color for icon styling
  const categoryColor = $derived(
    CONCEPT_CATEGORIES[concept.category]?.color ?? "#4A90E2"
  );

  function handleClick() {
    if (!isClickable) return;
    hapticService?.trigger("selection");
    onClick?.(concept);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  }
</script>

<button
  class="concept-card"
  class:locked={status === "locked"}
  class:completed={status === "completed"}
  class:available={status === "available"}
  class:in-progress={status === "in-progress"}
  style="--status-color: {statusColor}; --category-color: {categoryColor}"
  onclick={handleClick}
  onkeydown={handleKeydown}
  disabled={!isClickable}
  aria-label="{concept.name} - {status}"
  tabindex={isClickable ? 0 : -1}
>
  <div class="card-content">
    <span class="icon"
      ><i class="fa-solid {concept.icon}" aria-hidden="true"></i></span
    >
    <span class="name">{concept.shortName}</span>
  </div>
  {#if status === "completed"}
    <span class="check"
      ><i class="fa-solid fa-check" aria-hidden="true"></i></span
    >
  {:else if premiumGated}
    <span class="premium-crown" title="Premium feature">
      <i class="fas fa-crown" aria-hidden="true"></i>
    </span>
  {/if}
</button>

<style>
  .concept-card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 0.75rem;
    min-height: 80px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    position: relative;
    overflow: hidden;
    transition: all var(--duration-normal) ease;
    width: 100%;
    text-align: center;
    cursor: pointer;
  }

  .card-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    flex: 1;
  }

  .concept-card:hover:not(.locked) {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong, var(--theme-stroke-strong));
    transform: translateY(-2px);
  }

  .concept-card.locked {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .concept-card.available {
    border-color: color-mix(in srgb, var(--status-color) 30%, transparent);
  }

  .concept-card.in-progress {
    background: color-mix(in srgb, var(--status-color) 10%, rgba(0, 0, 0, 0.2));
    border-color: color-mix(in srgb, var(--status-color) 40%, transparent);
  }

  .concept-card.completed {
    background: color-mix(in srgb, var(--semantic-success, #50c878) 8%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success, #50c878) 20%, transparent);
  }

  .icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    color: var(--category-color);
    opacity: 0.9;
  }

  .name {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: -0.01em;
    width: 100%;
  }

  .check {
    position: absolute;
    top: 0.375rem;
    right: 0.375rem;
    width: 16px;
    height: 16px;
    background: var(--status-color);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-compact, 12px);
    color: white;
    flex-shrink: 0;
  }

  .premium-crown {
    --premium-gold: #fbbf24;
    position: absolute;
    top: 0.375rem;
    right: 0.375rem;
    font-size: 0.625rem;
    color: var(--premium-gold);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Focus state */
  .concept-card:focus-visible {
    outline: 2px solid var(--status-color);
    outline-offset: 2px;
  }

  .concept-card[disabled] {
    cursor: not-allowed;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .concept-card {
      transition: none;
    }
    .concept-card:hover:not(.locked) {
      transform: none;
    }
  }
</style>
