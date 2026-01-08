<!--
FilterChips.svelte

Displays active filters as dismissible chips.
Modern, clean UI pattern used by Airbnb, Zillow, and modern e-commerce.
Shows visual feedback of active filters with easy removal.
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";
  import type { ExploreFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";

  const {
    currentFilter = { type: "all", value: null },
    onRemoveFilter = () => {},
  } = $props<{
    currentFilter?: { type: string; value: ExploreFilterValue };
    onRemoveFilter?: () => void;
  }>();

  let hapticService: IHapticFeedback;

  onMount(() => {
    hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  // Check if filter is active (not "all")
  const hasActiveFilter = $derived(currentFilter.type !== "all");

  // Format filter label for display
  const filterLabel = $derived.by((): string => {
    if (!hasActiveFilter) return "";

    const { type, value } = currentFilter;

    switch (type) {
      case "favorites":
        return "Favorites";
      case "recent":
        return "Recent";
      case "difficulty":
        return `Level ${value}`;
      case "startingPosition":
        return `Position: ${value}`;
      case "startingLetter":
        return `Starts: ${value}`;
      case "containsLetters":
        if (Array.isArray(value)) {
          return `Contains: ${value.join(", ")}`;
        }
        return `Contains: ${value}`;
      case "length":
        return `${value} beats`;
      case "gridMode":
        return `${value} mode`;
      default:
        return `${type}: ${value}`;
    }
  });

  // Get chip color based on filter type
  const chipColor = $derived.by((): string => {
    const { type } = currentFilter;

    switch (type) {
      case "favorites":
        return "#ec4899"; // Pink
      case "recent":
        return "#06b6d4"; // Cyan
      case "difficulty":
        const level = currentFilter.value as number;
        if (level === 1) return "var(--semantic-success)"; // Green
        if (level === 2) return "var(--semantic-warning)"; // Amber
        if (level === 3) return "var(--semantic-error)"; // Red
        return "var(--theme-accent-strong, var(--theme-accent-strong))"; // Purple
      case "startingPosition":
        return "var(--theme-accent-strong, var(--theme-accent-strong))"; // Purple
      case "startingLetter":
        return "var(--semantic-info)"; // Blue
      case "containsLetters":
        return "var(--semantic-info)"; // Blue
      case "length":
        return "#14b8a6"; // Teal
      case "gridMode":
        return "var(--semantic-warning)"; // Amber
      default:
        return "var(--theme-accent-strong)"; // Purple
    }
  });

  function handleRemove() {
    hapticService?.trigger("selection");
    onRemoveFilter();
  }
</script>

{#if hasActiveFilter}
  <div
    class="filter-chip"
    style="--chip-color: {chipColor};"
    role="status"
    aria-live="polite"
  >
    <span class="chip-label">{filterLabel}</span>
    <button
      class="chip-remove"
      onclick={handleRemove}
      aria-label="Remove {filterLabel} filter"
      type="button"
    >
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  </div>
{/if}

<style>
  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px 12px 20px;
    min-height: var(--min-touch-target);
    background: color-mix(in srgb, var(--chip-color) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--chip-color) 30%, transparent);
    border-radius: 100px;
    color: color-mix(in srgb, var(--theme-text, white) 95%, transparent);
    font-size: var(--font-size-sm);
    font-weight: 500;
    letter-spacing: -0.1px;
    white-space: nowrap;
    box-shadow: 0 2px 4px var(--theme-shadow);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-8px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateX(0) scale(1);
    }
  }

  .chip-label {
    font-size: var(--font-size-sm);
    line-height: 1;
  }

  .chip-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    min-height: 32px;
    padding: 0;
    background: color-mix(in srgb, var(--theme-text, white) 15%, transparent);
    border: none;
    border-radius: 50%;
    color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
    position: relative;
  }

  /* Expand touch target for remove button using pseudo-element */
  .chip-remove::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
  }

  .chip-remove:hover {
    background: color-mix(in srgb, var(--theme-text, white) 25%, transparent);
    transform: scale(1.1);
  }

  .chip-remove:active {
    transform: scale(0.95);
  }

  .chip-remove i {
    font-size: var(--font-size-compact);
    position: relative;
    z-index: 1;
  }

  /* Mobile adjustments - maintain accessibility */
  @media (max-width: 480px) {
    .filter-chip {
      padding: 12px 12px 12px 16px;
      font-size: var(--font-size-compact);
      gap: 10px;
      min-height: var(--min-touch-target);
    }

    .chip-label {
      font-size: var(--font-size-compact);
    }

    .chip-remove {
      min-width: 28px;
      min-height: 28px;
    }

    .chip-remove i {
      font-size: var(--font-size-compact);
    }

    .chip-remove::before {
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .filter-chip {
      animation: none;
      transition: none;
    }

    .chip-remove {
      transition: none;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .filter-chip {
      border-width: 2px;
      background: rgba(0, 0, 0, 0.8);
    }

    .chip-remove {
      background: rgba(255, 255, 255, 0.3);
      border: 1px solid white;
    }
  }
</style>
