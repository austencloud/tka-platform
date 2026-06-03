<!--
  PresetChipBar.svelte - 10 preset slots with responsive layout

  Always shows a 5x2 grid. On very narrow screens the grid scrolls horizontally.
  Shows keyboard shortcut badges on desktop when keyboard detected.
-->
<script lang="ts">
  import type { PropPreset } from "../../../domain/app-settings";
  import PresetChip from "./PresetChip.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  const SLOT_COUNT = 10;

  let {
    presets = [],
    selectedIndex = -1,
    showKeyboardBadges = false,
    onSelectPreset,
    onSaveToSlot,
    onClearSlot,
  } = $props<{
    presets: (PropPreset | null)[];
    selectedIndex: number;
    showKeyboardBadges?: boolean;
    onSelectPreset?: (index: number) => void;
    onSaveToSlot?: (index: number) => void;
    onClearSlot?: (index: number) => void;
  }>();

  // The presets array already has nulls for empty slots - use directly
  // Ensure we always have SLOT_COUNT items
  const slots = $derived(
    Array.from({ length: SLOT_COUNT }, (_, i) => presets[i] ?? null)
  );

  // Count filled slots for hint text
  const filledCount = $derived(slots.filter(Boolean).length);
</script>

<div class="preset-bar">
  <div class="presets-grid">
    {#each slots as preset, i}
      <PresetChip
        {preset}
        index={i}
        selected={i === selectedIndex}
        showKeyboardBadge={showKeyboardBadges}
        onSelect={() => onSelectPreset?.(i)}
        onSave={() => onSaveToSlot?.(i)}
        onClear={() => onClearSlot?.(i)}
      />
    {/each}
  </div>

  <p class="preset-hint">
    <i class="fas fa-info-circle" aria-hidden="true"></i>
    <span>
      {#if filledCount === 0}
        {t("settings_preset_hint_empty")}
      {:else}
        {t("settings_preset_hint_filled")}
      {/if}
    </span>
  </p>
</div>

<style>
  .preset-bar {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* 5-column grid, chips are square with reasonable max */
  .presets-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    padding: 4px;
  }

  .preset-hint {
    margin: 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .preset-hint i {
    font-size: var(--font-size-compact);
    opacity: 0.6;
  }
</style>
