<!--
LOOPPresetCard.svelte - Compact preset card for quick LOOP selection
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { LOOPPreset } from "../../shared/domain/constants/loop-presets";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onMount } from "svelte";

  let { preset, onSelect, isFavorite = false, onToggleFavorite } = $props<{
    preset: LOOPPreset;
    onSelect: (preset: LOOPPreset) => void;
    isFavorite?: boolean;
    onToggleFavorite?: (presetId: string) => void;
  }>();

  let hapticService: HapticFeedback | null = null;

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  function handleSelect() {
    hapticService?.trigger("selection");
    onSelect(preset);
  }

  function handleToggleFavorite(event: MouseEvent) {
    event.stopPropagation();
    hapticService?.trigger("selection");
    onToggleFavorite?.(preset.id);
  }
</script>

<div class="preset-card-wrapper">
  <button
    class="preset-card"
    onclick={handleSelect}
    aria-label={`Apply ${preset.name}`}
  >
    <span class="preset-icon">{preset.icon}</span>
    <span class="preset-name">{preset.name}</span>
  </button>

  {#if onToggleFavorite}
    <button
      class="favorite-btn"
      class:active={isFavorite}
      onclick={handleToggleFavorite}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <svg viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" stroke-width="2">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </button>
  {/if}
</div>

<style>
  .preset-card-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }

  .preset-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 8px;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    text-align: left;
    width: 100%;
    color: var(--theme-text, white);
    font-family: inherit;
  }

  .preset-card:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.15));
  }

  .preset-card:active {
    transform: scale(0.98);
  }

  .preset-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .preset-name {
    flex: 1;
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: var(--theme-text, white);
  }

  .favorite-btn {
    position: absolute;
    right: 10px;
    flex-shrink: 0;
    background: transparent;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.4);
    transition: all var(--duration-fast) ease;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .favorite-btn:hover {
    color: var(--semantic-warning, #f59e0b);
  }

  .favorite-btn.active {
    color: var(--semantic-warning, #f59e0b);
  }

  .favorite-btn svg {
    width: 16px;
    height: 16px;
  }
</style>
