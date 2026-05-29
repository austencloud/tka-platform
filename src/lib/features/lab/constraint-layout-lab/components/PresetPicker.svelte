<!--
  PresetPicker.svelte

  Grid of preset buttons for quickly applying common layouts.
  Supports both built-in presets and custom user presets.
-->
<script lang="ts">
  import { LAYOUT_PRESETS } from "../services/layout-presets";
  import type { LayoutPreset } from "../domain/types";

  let {
    presets = LAYOUT_PRESETS,
    onSelectPreset,
    onDeletePreset,
  }: {
    presets?: LayoutPreset[];
    onSelectPreset: (preset: LayoutPreset) => void;
    onDeletePreset?: (presetId: string) => void;
  } = $props();

  // Separate built-in from custom presets
  const builtInPresets = $derived(presets.filter((p) => !p.id.startsWith("custom-")));
  const customPresets = $derived(presets.filter((p) => p.id.startsWith("custom-")));
</script>

<div class="preset-picker">
  <h3 class="section-title">Layout Presets</h3>
  <div class="preset-grid">
    {#each builtInPresets as preset}
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

  {#if customPresets.length > 0}
    <h3 class="section-title custom-title">Custom Presets</h3>
    <div class="preset-grid">
      {#each customPresets as preset}
        <div class="custom-preset-wrapper">
          <button
            class="preset-btn custom"
            onclick={() => onSelectPreset(preset)}
            title={preset.description}
          >
            <i class="fas fa-{preset.icon}" aria-hidden="true"></i>
            <span class="preset-name">{preset.name}</span>
          </button>
          {#if onDeletePreset}
            <button
              class="delete-btn"
              onclick={(e) => {
                e.stopPropagation();
                onDeletePreset(preset.id);
              }}
              title="Delete preset"
              aria-label="Delete {preset.name} preset"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
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

  .custom-title {
    margin-top: var(--spacing-md, 12px);
    padding-top: var(--spacing-md, 12px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-sm, 8px);
  }

  .custom-preset-wrapper {
    position: relative;
  }

  .preset-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs, 4px);
    padding: var(--spacing-md, 12px) var(--spacing-sm, 8px);
    min-height: 64px;
    width: 100%;
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

  .preset-btn.custom {
    border-color: var(--theme-accent, #8b5cf6);
    border-style: dashed;
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

  .delete-btn {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--semantic-error, #ef4444);
    border: none;
    border-radius: 50%;
    color: white;
    font-size: 12px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .custom-preset-wrapper:hover .delete-btn,
  .delete-btn:focus-visible {
    opacity: 1;
  }

  .delete-btn:hover {
    background: #dc2626;
  }

  .delete-btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .preset-btn,
    .delete-btn {
      transition: none;
    }
  }
</style>
