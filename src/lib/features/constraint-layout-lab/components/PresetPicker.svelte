<!--
  PresetPicker.svelte

  Grid of preset buttons for quickly applying common layouts.
-->
<script lang="ts">
  import { LAYOUT_PRESETS } from "../services/LayoutPresets";
  import type { LayoutPreset } from "../domain/types";

  let {
    onSelectPreset,
  }: {
    onSelectPreset: (preset: LayoutPreset) => void;
  } = $props();
</script>

<div class="preset-picker">
  <h3 class="section-title">Layout Presets</h3>
  <div class="preset-grid">
    {#each LAYOUT_PRESETS as preset}
      <button
        class="preset-btn"
        onclick={() => onSelectPreset(preset)}
        title={preset.description}
      >
        <i class="fas fa-{preset.icon}" aria-hidden="true"></i>
        <span class="preset-name">{preset.name}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .preset-picker {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
  }

  .section-title {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-sm, 8px);
  }

  .preset-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs, 4px);
    padding: var(--spacing-md, 12px) var(--spacing-sm, 8px);
    min-height: 64px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .preset-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, white);
  }

  .preset-btn:active {
    transform: scale(0.98);
  }

  .preset-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .preset-btn i {
    font-size: 1.25rem;
    opacity: 0.8;
  }

  .preset-name {
    font-size: var(--font-size-compact, 12px);
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .preset-btn {
      transition: none;
    }
  }
</style>
