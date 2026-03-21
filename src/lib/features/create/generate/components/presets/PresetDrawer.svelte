<!--
PresetDrawer - Bottom drawer for browsing and selecting generation presets
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import type { GenerationPreset } from "../../state/preset.svelte";

  let {
    isOpen = false,
    presets = [],
    activePresetId = null,
    onPresetSelect,
    onClose,
  } = $props<{
    isOpen: boolean;
    presets: GenerationPreset[];
    activePresetId?: string | null;
    onPresetSelect?: (preset: GenerationPreset) => void;
    onClose?: () => void;
  }>();

  function summarize(preset: GenerationPreset): string {
    const c = preset.config;
    const parts: string[] = [];
    parts.push(`L${c.level}`);
    parts.push(c.gridMode === "diamond" ? "Diamond" : "Box");
    parts.push(`${c.length}ct`);
    if (c.loopEnabled) parts.push("LOOP");
    return parts.join(" · ");
  }
</script>

<Drawer
  {isOpen}
  placement="bottom"
  respectLayoutMode={true}
  closeOnBackdrop={true}
  onclose={() => onClose?.()}
>
  <div class="preset-drawer">
    <h3 class="drawer-title">Presets</h3>

    <div class="preset-list">
      {#each presets as preset (preset.id)}
        <button
          class="preset-item"
          class:active={preset.id === activePresetId}
          onclick={() => onPresetSelect?.(preset)}
        >
          <span class="preset-icon">{preset.icon ?? "🎯"}</span>
          <div class="preset-info">
            <span class="preset-name">{preset.name}</span>
            <span class="preset-summary">{summarize(preset)}</span>
          </div>
          {#if preset.id === activePresetId}
            <span class="active-badge">Active</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</Drawer>

<style>
  .preset-drawer {
    padding: 1rem;
  }

  .drawer-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    margin: 0 0 0.75rem;
    text-align: center;
  }

  .preset-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .preset-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 8px);
    color: var(--theme-text, #fff);
    cursor: pointer;
    transition: border-color 150ms ease;
    min-height: var(--min-touch-target, 44px);
    text-align: left;
    width: 100%;
    font: inherit;
  }

  .preset-item:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .preset-item.active {
    border-color: var(--theme-accent, #3b82f6);
    background: rgba(59, 130, 246, 0.1);
  }

  .preset-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .preset-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1;
    min-width: 0;
  }

  .preset-name {
    font-weight: 600;
    font-size: var(--font-size-min, 14px);
  }

  .preset-summary {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.7;
  }

  .active-badge {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-accent, #3b82f6);
    flex-shrink: 0;
  }
</style>
