<!--
ActiveFilterBar.svelte - Dismissible active filter chips + "Clear all" button.
Only renders when at least one filter is active.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onMount } from "svelte";
  import type { ActiveFilter } from "$lib/shared/browse/domain/multi-filter-models";
  import { t } from "$lib/shared/i18n/i18n.svelte";

  interface Props {
    filters: ActiveFilter[];
    onRemoveFilter: (type: string) => void;
    onClearAll: () => void;
  }

  let { filters, onRemoveFilter, onClearAll }: Props = $props();

  let hapticService: HapticFeedback | null = null;

  onMount(() => {
    hapticService = getHapticFeedback() ?? null;
  });

  function handleRemove(type: string) {
    hapticService?.trigger("selection");
    onRemoveFilter(type);
  }

  function handleClearAll() {
    hapticService?.trigger("selection");
    onClearAll();
  }
</script>

{#if filters.length > 0}
  <div class="active-filter-bar" role="status" aria-live="polite" aria-label={t('browse_active_filters')}>
    <div class="filter-chips-scroll">
      {#each filters as filter (filter.type)}
        <span
          class="active-chip"
          style="--chip-color: {filter.chipColor};"
        >
          <span class="chip-label">{filter.label}</span>
          <button
            class="chip-dismiss"
            type="button"
            aria-label={t('browse_remove_filter', { label: filter.label })}
            onmousedown={(e) => {
              // Keep focus where it is so an open input doesn't blur-close before the click lands
              e.stopPropagation();
              e.preventDefault();
            }}
            onclick={(e) => {
              e.stopPropagation();
              handleRemove(filter.type);
            }}
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </span>
      {/each}

      {#if filters.length > 1}
        <button
          class="clear-all-btn"
          type="button"
          onmousedown={(e) => {
            // Keep focus where it is so an open input doesn't blur-close before the click lands
            e.stopPropagation();
            e.preventDefault();
          }}
          onclick={(e) => {
            e.stopPropagation();
            handleClearAll();
          }}
        >
          {t('browse_clear_all')}
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .active-filter-bar {
    padding: 4px 0;
    animation: barSlideIn var(--duration-fast, 150ms) ease;
  }

  @keyframes barSlideIn {
    from {
      opacity: 0;
      max-height: 0;
    }
    to {
      opacity: 1;
      max-height: 48px;
    }
  }

  .filter-chips-scroll {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .filter-chips-scroll::-webkit-scrollbar {
    display: none;
  }

  .active-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px 4px 12px;
    min-height: 28px;
    background: color-mix(in srgb, var(--chip-color) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--chip-color) 30%, transparent);
    border-radius: 100px;
    color: var(--theme-text);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
    animation: chipIn var(--duration-fast, 150ms) ease;
  }

  @keyframes chipIn {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .chip-label {
    line-height: 1;
  }

  .chip-dismiss {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    background: color-mix(in srgb, var(--theme-text, white) 15%, transparent);
    border: none;
    border-radius: 50%;
    color: var(--theme-text);
    font-size: 9px;
    cursor: pointer;
    position: relative;
    flex-shrink: 0;
    transition:
      background var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
  }

  /* Expanded touch target */
  .chip-dismiss::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    min-width: 32px;
    min-height: 32px;
  }

  .chip-dismiss:hover {
    background: color-mix(in srgb, var(--theme-text, white) 25%, transparent);
    transform: scale(1.1);
  }

  .chip-dismiss:active {
    transform: scale(0.9);
  }

  .clear-all-btn {
    padding: 4px 12px;
    min-height: 28px;
    background: transparent;
    border: 1px solid var(--theme-stroke);
    border-radius: 100px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition:
      background var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease;
  }

  .clear-all-btn:hover {
    background: color-mix(in srgb, var(--semantic-error) 10%, transparent);
    color: var(--semantic-error);
    border-color: color-mix(in srgb, var(--semantic-error) 30%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .active-filter-bar,
    .active-chip,
    .chip-dismiss,
    .clear-all-btn {
      animation: none;
      transition: none;
    }
  }
</style>
