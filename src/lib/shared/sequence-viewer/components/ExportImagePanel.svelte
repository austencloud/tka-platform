<!--
  ExportImagePanel.svelte

  Image export settings panel.
  Desktop: side panel next to choreo card preview.
  Mobile: compact bottom panel below the choreo card.
-->
<script lang="ts">
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { ExportOptionsStateManager } from "../state/export-options-state.svelte";

  type PanelLayout = "sidebar" | "bottom";

  interface Props {
    exportOptions: ExportOptionsStateManager;
    isExporting: boolean;
    onExport: () => void;
  }

  let {
    exportOptions,
    isExporting,
    onExport,
  }: Props = $props();
</script>

<div
  class="export-panel"
  transition:slide={{ duration: 250, easing: cubicOut, axis: "y" }}
  role="region"
  aria-label="Image export settings"
>
  <div class="panel-body">
    <!-- Include toggles -->
    <div class="setting-row">
      <span class="setting-label">Include</span>
      <div class="chip-group">
        <button
          type="button"
          class="chip"
          class:active={exportOptions.imageShowWord}
          onclick={() => exportOptions.setImageShowWord(!exportOptions.imageShowWord)}
          aria-pressed={exportOptions.imageShowWord}
        >Word</button>
        <button
          type="button"
          class="chip"
          class:active={exportOptions.imageIncludeStartPosition}
          onclick={() => exportOptions.setImageIncludeStartPosition(!exportOptions.imageIncludeStartPosition)}
          aria-pressed={exportOptions.imageIncludeStartPosition}
        >Start</button>
        <button
          type="button"
          class="chip"
          class:active={exportOptions.imageShowDifficulty}
          onclick={() => exportOptions.setImageShowDifficulty(!exportOptions.imageShowDifficulty)}
          aria-pressed={exportOptions.imageShowDifficulty}
        >Level</button>
        <button
          type="button"
          class="chip"
          class:active={exportOptions.imageShowCreatorName}
          onclick={() => exportOptions.setImageShowCreatorName(!exportOptions.imageShowCreatorName)}
          aria-pressed={exportOptions.imageShowCreatorName}
        >Name</button>
        <button
          type="button"
          class="chip"
          class:active={exportOptions.imageShowNotes}
          onclick={() => exportOptions.setImageShowNotes(!exportOptions.imageShowNotes)}
          aria-pressed={exportOptions.imageShowNotes}
        >Notes</button>
      </div>
    </div>

    <!-- Theme -->
    <div class="setting-row">
      <span class="setting-label">Theme</span>
      <div class="chip-group">
        <button
          type="button"
          class="chip"
          class:active={!exportOptions.imageDarkMode}
          onclick={() => exportOptions.setImageDarkMode(false)}
          aria-pressed={!exportOptions.imageDarkMode}
        >
          <i class="fas fa-sun" aria-hidden="true"></i>
          Light
        </button>
        <button
          type="button"
          class="chip"
          class:active={exportOptions.imageDarkMode}
          onclick={() => exportOptions.setImageDarkMode(true)}
          aria-pressed={exportOptions.imageDarkMode}
        >
          <i class="fas fa-moon" aria-hidden="true"></i>
          Dark
        </button>
      </div>
    </div>
  </div>

  <div class="panel-footer">
    <button
      type="button"
      class="export-btn"
      onclick={onExport}
      disabled={isExporting}
      aria-label="Export image"
    >
      {#if isExporting}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        Exporting...
      {:else}
        <i class="fas fa-download" aria-hidden="true"></i>
        Export Image
      {/if}
    </button>
  </div>
</div>

<style>
  .export-panel {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    display: flex;
    flex-direction: column;
    z-index: 10;
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow-y: auto;
  }

  .panel-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 12px 16px;
    overflow-y: auto;
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .setting-label {
    min-width: 72px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  .chip-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    min-width: 40px;
    padding: 6px 14px;
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .chip:active {
    transform: scale(0.92);
    transition-duration: 50ms;
  }

  .chip.active {
    background: color-mix(
      in srgb,
      var(--theme-accent, #6366f1) 35%,
      var(--theme-card-bg, rgba(0, 0, 0, 0.4))
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #6366f1) 60%,
      transparent
    );
    color: white;
    box-shadow: 0 2px 8px
      color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
  }

  .chip:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
  }

  .chip i {
    font-size: 12px;
  }

  .panel-footer {
    padding: 8px 16px 12px;
    flex-shrink: 0;
  }

  .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 12px 24px;
    border: none;
    border-radius: 12px;
    background: var(--theme-accent, #6366f1);
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .export-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
  }

  .export-btn:active:not(:disabled) {
    transform: scale(0.98);
    transition-duration: 50ms;
  }

  .export-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .chip,
    .export-btn {
      transition: none !important;
    }

    .chip:active,
    .export-btn:active {
      transform: none !important;
    }
  }
</style>
