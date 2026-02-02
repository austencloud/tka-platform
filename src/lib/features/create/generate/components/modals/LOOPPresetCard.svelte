<!--
LOOPPresetCard.svelte - Compact preset card for quick LOOP selection
-->
<script lang="ts">
  import type { LOOPPreset } from "../../shared/domain/constants/loop-presets";
  import { LOOP_COMPONENT_MAP } from "../../shared/domain/constants/loop-constants";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  let { preset, onSelect, isFavorite = false, onToggleFavorite, variant = 'row' } = $props<{
    preset: LOOPPreset;
    onSelect: (preset: LOOPPreset) => void;
    isFavorite?: boolean;
    onToggleFavorite?: (presetId: string) => void;
    variant?: 'row' | 'card';
  }>();

  let hapticService: IHapticFeedback | null = null;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  function handleSelect() {
    hapticService?.trigger("selection");
    onSelect(preset);
  }

  // Resolve icon color from the preset's first component
  const iconColor = $derived.by(() => {
    const firstComponent = preset.components[0];
    if (!firstComponent) return "var(--theme-text, white)";
    return LOOP_COMPONENT_MAP.get(firstComponent)?.color ?? "var(--theme-text, white)";
  });

  function handleToggleFavorite(event: MouseEvent) {
    event.stopPropagation();
    hapticService?.trigger("selection");
    onToggleFavorite?.(preset.id);
  }
</script>

<div class="preset-card-wrapper" class:card-variant={variant === 'card'}>
  <button
    class="preset-card"
    class:card-layout={variant === 'card'}
    onclick={handleSelect}
    aria-label={`Apply ${preset.name}`}
  >
    <i class="fas fa-{preset.icon} preset-icon" style="color: {iconColor};" aria-hidden="true"></i>
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
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    text-align: left;
    width: 100%;
    color: var(--theme-text, white);
    font-family: inherit;
  }

  .preset-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
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

  /* Card variant: vertical layout */
  .preset-card.card-layout {
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 12px 8px;
    min-height: 64px;
    gap: 6px;
  }

  .preset-card.card-layout .preset-icon {
    font-size: 22px;
  }

  .preset-card.card-layout .preset-name {
    flex: none;
    font-size: var(--font-size-compact, 12px);
    line-height: 1.2;
  }

  .preset-card-wrapper.card-variant {
    position: relative;
  }

  .preset-card-wrapper.card-variant .favorite-btn {
    position: absolute;
    top: 4px;
    right: 4px;
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
