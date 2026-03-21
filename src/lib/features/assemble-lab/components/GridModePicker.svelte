<!--
  GridModePicker.svelte - Grid mode pills + center toggle.
  Used in both the assemble flow and the orientation explainer.
-->
<script lang="ts">
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

  let {
    gridMode,
    showCenter,
    disabled = false,
    onGridModeChange,
    onCenterChange,
  }: {
    gridMode: GridMode;
    showCenter: boolean;
    disabled?: boolean;
    onGridModeChange: (mode: GridMode) => void;
    onCenterChange: (show: boolean) => void;
  } = $props();

  const MODES = [
    { value: GridMode.DIAMOND, label: "Diamond" },
    { value: GridMode.BOX, label: "Box" },
    { value: GridMode.SKEWED, label: "Merged" },
  ] as const;
</script>

<div class="grid-mode-picker" class:disabled>
  <div class="mode-pills" role="radiogroup" aria-label="Grid mode">
    {#each MODES as mode}
      <button
        class="mode-pill"
        class:active={gridMode === mode.value}
        role="radio"
        aria-checked={gridMode === mode.value}
        {disabled}
        onclick={() => onGridModeChange(mode.value)}
      >
        {mode.label}
      </button>
    {/each}
  </div>

  <button
    class="center-chip"
    class:active={showCenter}
    {disabled}
    aria-pressed={showCenter}
    aria-label="Include center point"
    onclick={() => onCenterChange(!showCenter)}
  >
    + Center
  </button>
</div>

<style>
  .grid-mode-picker {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .grid-mode-picker.disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .mode-pills {
    display: flex;
    gap: 2px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 10px;
    padding: 3px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .mode-pill {
    padding: 6px 12px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    transition: background 0.15s ease, color 0.15s ease;
  }

  .mode-pill.active {
    background: var(--theme-accent-subtle, rgba(99, 102, 241, 0.12));
    color: var(--theme-accent, #6366f1);
  }

  .mode-pill:focus-visible {
    outline: 2px solid var(--theme-text, #fff);
    outline-offset: 2px;
  }

  .center-chip {
    padding: 6px 12px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }

  .center-chip.active {
    background: var(--theme-accent-subtle, rgba(99, 102, 241, 0.12));
    color: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
  }

  .center-chip:focus-visible {
    outline: 2px solid var(--theme-text, #fff);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-pill,
    .center-chip {
      transition: none;
    }
  }
</style>
