<!--
PresetGrid.svelte - Grid layout for preset cards
Displays a list of presets in a scrollable grid layout
-->
<script lang="ts">
  import type { GenerationPreset } from "../../state/preset.svelte";
  import PresetCard from "./PresetCard.svelte";

  let { presets, onPresetSelect, onPresetEdit, onPresetDelete } = $props<{
    presets: GenerationPreset[];
    onPresetSelect: (preset: GenerationPreset) => void;
    onPresetEdit: (preset: GenerationPreset) => void;
    onPresetDelete: (presetId: string) => void;
  }>();
</script>

{#if presets.length === 0}
  <div class="empty-state">
    <div class="empty-icon">📋</div>
    <div class="empty-text">No saved presets yet</div>
    <div class="empty-hint">Save your current settings to create a preset</div>
  </div>
{:else}
  <div class="preset-list">
    {#each presets as preset (preset.id)}
      <PresetCard
        {preset}
        onSelect={onPresetSelect}
        onEdit={onPresetEdit}
        onDelete={onPresetDelete}
      />
    {/each}
  </div>
{/if}

<style>
  .preset-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px 24px;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }

  /* Scrollbar styling */
  .preset-list::-webkit-scrollbar {
    width: 8px;
  }

  .preset-list::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
    border-radius: 4px;
  }

  .preset-list::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
  }

  .preset-list::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 24px;
    text-align: center;
    color: var(--theme-text, white);
  }

  .empty-icon {
    font-size: var(--font-size-3xl);
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .empty-text {
    font-size: var(--font-size-xl);
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--theme-text, var(--theme-text));
  }

  .empty-hint {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  @media (max-width: 640px) {
    .preset-list {
      padding: 16px;
      gap: 10px;
    }

    .empty-state {
      padding: 40px 16px;
    }

    .empty-icon {
      font-size: var(--font-size-3xl);
      margin-bottom: 12px;
    }

    .empty-text {
      font-size: var(--font-size-lg);
    }

    .empty-hint {
      font-size: var(--font-size-compact);
    }
  }

  /* Optimize for very narrow devices (Z Fold, narrow foldables) */
  @media (max-width: 380px) {
    .preset-list {
      padding: 12px;
      gap: 8px;
    }

    .preset-list::-webkit-scrollbar {
      width: 6px;
    }

    .empty-state {
      padding: 32px 12px;
    }

    .empty-icon {
      font-size: var(--font-size-3xl);
      margin-bottom: 10px;
    }

    .empty-text {
      font-size: var(--font-size-base);
    }

    .empty-hint {
      font-size: var(--font-size-compact);
    }
  }
</style>
