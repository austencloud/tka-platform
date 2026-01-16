<!--
  PresetChipBar.svelte - 10 preset slots with responsive layout

  Always shows a 5x2 grid. On very narrow screens the grid scrolls horizontally.
  Shows keyboard shortcut badges on desktop when keyboard detected.
-->
<script lang="ts">
  import type { PropPreset } from "../../../domain/AppSettings";
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
    gap: 12px;
    flex: 1;
    min-height: 0;
  }

  /* 5x2 grid - square chips that fill available space */
  .presets-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: clamp(6px, 2cqi, 12px);
    padding: 4px;
    max-width: 100%;
    flex: 1;
    min-height: 0;
    container-type: inline-size;
    container-name: presets-grid;
  }

  /* On narrow containers, use 4 columns (3 rows) for larger chips */
  @container presets-grid (max-width: 300px) {
    .presets-grid {
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(3, 1fr);
    }
  }

  /* Allow horizontal scroll on very narrow containers */
  @media (max-width: 380px) {
    .presets-grid {
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: thin;
      padding-bottom: 8px;
    }
  }

  .preset-hint {
    margin: 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .preset-hint i {
    font-size: var(--font-size-compact);
    opacity: 0.6;
  }
</style>
