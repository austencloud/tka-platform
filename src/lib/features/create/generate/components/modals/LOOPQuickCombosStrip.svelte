<!--
LOOPQuickCombosStrip.svelte - Compact preset chip row for the LOOP selector.
Tap a chip to apply the preset's LOOP combo; star to pin it (localStorage).
Renders the FontAwesome icon via FontAwesomeIcon (NOT raw {preset.icon} text,
which was the LOOPPresetCard bug this component supersedes).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { LOOP_PRESETS } from "../../shared/domain/constants/loop-presets";
  import type { LOOPPreset } from "../../shared/domain/constants/loop-presets";
  import { loopFavoritesManager } from "../../shared/services/loop-favorites-manager";
  import { orderQuickCombos } from "../../shared/services/loop-quick-combos";

  let { onApply } = $props<{ onApply: (preset: LOOPPreset) => void }>();

  let hapticService: HapticFeedback | null = null;
  let favorites = $state<string[]>([]);

  onMount(() => {
    hapticService = getHapticFeedback();
    favorites = loopFavoritesManager.getFavorites();
  });

  const combos = $derived(orderQuickCombos(LOOP_PRESETS, favorites));

  function handleApply(preset: LOOPPreset) {
    hapticService?.trigger("selection");
    onApply(preset);
  }

  function handleStar(event: MouseEvent, presetId: string) {
    event.stopPropagation();
    hapticService?.trigger("selection");
    loopFavoritesManager.toggleFavorite(presetId);
    favorites = loopFavoritesManager.getFavorites();
  }
</script>

<div class="quick-combos">
  <span class="quick-combos-label">Quick Combos</span>
  <div class="quick-combos-row">
    {#each combos as preset (preset.id)}
      <div class="combo-chip-wrap">
        <button
          class="combo-chip"
          onclick={() => handleApply(preset)}
          aria-label={`Apply ${preset.name}`}
        >
          <FontAwesomeIcon icon={preset.icon} size="0.9em" />
          <span class="combo-name">{preset.name}</span>
        </button>
        <button
          class="combo-star"
          class:active={favorites.includes(preset.id)}
          onclick={(e) => handleStar(e, preset.id)}
          aria-pressed={favorites.includes(preset.id)}
          aria-label={favorites.includes(preset.id)
            ? `Unpin ${preset.name}`
            : `Pin ${preset.name}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill={favorites.includes(preset.id) ? "currentColor" : "none"}
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            />
          </svg>
        </button>
      </div>
    {/each}
  </div>
</div>

<style>
  .quick-combos {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex-shrink: 0;
  }

  .quick-combos-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .quick-combos-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .combo-chip-wrap {
    display: inline-flex;
    align-items: stretch;
    border-radius: 999px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }

  .combo-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 4px 6px 12px;
    background: transparent;
    border: none;
    border-radius: 999px 0 0 999px;
    color: var(--theme-text, white);
    font-family: inherit;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: background var(--duration-fast, 120ms) ease;
    min-height: var(--min-touch-target, 44px);
  }

  .combo-chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.09));
  }

  .combo-name {
    white-space: nowrap;
  }

  .combo-star {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 10px 0 4px;
    background: transparent;
    border: none;
    border-radius: 0 999px 999px 0;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    transition: color var(--duration-fast, 120ms) ease;
  }

  .combo-star:hover,
  .combo-star.active {
    color: var(--semantic-warning, #f59e0b);
  }

  .combo-star svg {
    width: 15px;
    height: 15px;
  }

  @media (prefers-reduced-motion: reduce) {
    .combo-chip,
    .combo-star {
      transition: none;
    }
  }
</style>
