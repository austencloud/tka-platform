<!--
  PresetDrawer - Preset selection drawer
  Desktop: right-side panel matching other create module drawers.
  Mobile: bottom sheet.
  Follows CustomizeDrawer pattern: portal + Drawer always in DOM.
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { portal } from "../modals/portal";
  import SheetDragHandle from "$lib/shared/foundation/ui/SheetDragHandle.svelte";
  import type { GenerationPreset } from "../../state/preset.svelte";

  let {
    isOpen,
    presets = [],
    activePresetId = null,
    onPresetSelect,
    onClose,
  }: {
    isOpen: boolean;
    presets: GenerationPreset[];
    activePresetId?: string | null;
    onPresetSelect?: (preset: GenerationPreset) => void;
    onClose?: () => void;
  } = $props();

  function summarize(preset: GenerationPreset): string {
    const c = preset.config;
    const parts: string[] = [];
    parts.push(`L${c.level}`);
    parts.push(c.gridMode === "diamond" ? "Diamond" : "Box");
    parts.push(`${c.length}ct`);
    if (c.loopEnabled) parts.push("LOOP");
    return parts.join(" \u00B7 ");
  }
</script>

<div use:portal>
  <Drawer
    {isOpen}
    placement="right"
    respectLayoutMode={true}
    showHandle={false}
    closeOnBackdrop={true}
    ariaLabel="Browse presets"
    class="preset-drawer-sheet"
    onclose={onClose}
  >
    <div class="preset-drawer-content">
      <SheetDragHandle />

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
</div>

<style>
  :global(.drawer-content.preset-drawer-sheet) {
    --sheet-bg: transparent;
    --sheet-border: none;
    --sheet-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5);
  }

  :global(.drawer-content.preset-drawer-sheet[data-placement="right"]) {
    --sheet-width: min(400px, 90vw);
  }

  .preset-drawer-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    background: linear-gradient(
      135deg,
      color-mix(in srgb, #e11d48 20%, #1a1a2e) 0%,
      color-mix(in srgb, #be123c 12%, #1a1a2e) 50%,
      color-mix(in srgb, #e11d48 16%, #1a1a2e) 100%
    );
    gap: 12px;
  }

  .drawer-title {
    font-size: var(--font-size-base, 16px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    margin: 0;
    text-align: center;
  }

  .preset-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  .preset-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1.5px solid rgba(255, 255, 255, 0.12);
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
    border-color: rgba(255, 255, 255, 0.25);
  }

  .preset-item.active {
    border-color: var(--theme-accent, #3b82f6);
    background: rgba(59, 130, 246, 0.15);
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

  @media (prefers-reduced-motion: reduce) {
    .preset-item {
      transition: none;
    }
  }
</style>
