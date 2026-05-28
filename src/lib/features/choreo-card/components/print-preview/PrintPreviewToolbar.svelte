<script lang="ts">
  import CardSizeToggle from "../card-preview/CardSizeToggle.svelte";
  import type { CardSizeId } from "../../domain/card-sizes";

  interface Props {
    cardSize: CardSizeId;
    totalCards: number;
    isRendering: boolean;
    isExporting: boolean;
    exportStatus?: string;
    exportError?: string;
    renderProgress: number;
    renderTotal: number;
    onCardSizeChange: (size: CardSizeId) => void;
    onExportPDF: () => void;
    onExportZIP: () => void;
    onRerender?: () => void;
  }

  let {
    cardSize,
    totalCards,
    isRendering,
    isExporting,
    exportStatus = "",
    exportError = "",
    renderProgress,
    renderTotal,
    onCardSizeChange,
    onExportPDF,
    onExportZIP,
    onRerender,
  }: Props = $props();

  const progressText = $derived(
    renderTotal > 0
      ? `Rendering ${renderProgress} / ${renderTotal}…`
      : "Rendering…"
  );
</script>

<div class="toolbar" role="toolbar" aria-label="Print preview controls">
  <div class="toolbar-section size-section">
    <CardSizeToggle selected={cardSize} onchange={onCardSizeChange} />
  </div>

  <div class="toolbar-section export-section">
    {#if exportError}
      <span class="error-text" aria-live="assertive">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
        {exportError}
      </span>
    {/if}

    {#if isRendering}
      <span class="progress-text" aria-live="polite" aria-atomic="true">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        {progressText}
      </span>
    {:else if isExporting}
      <span class="progress-text" aria-live="polite" aria-atomic="true">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        {exportStatus || "Exporting…"}
      </span>
    {:else}
      {#if onRerender}
        <button
          class="export-btn"
          onclick={onRerender}
          aria-label="Re-render all cards"
          title="Re-render all cards"
        >
          <i class="fas fa-sync-alt" aria-hidden="true"></i>
        </button>
      {/if}
      <button
        class="export-btn"
        disabled={totalCards === 0}
        onclick={onExportPDF}
        aria-label="Export as print-ready PDF"
        title={totalCards === 0 ? "Load a deck first" : `Export ${totalCards} cards as PDF`}
      >
        <i class="fas fa-file-pdf" aria-hidden="true"></i>
        <span>PDF</span>
      </button>
      <button
        class="export-btn"
        disabled={totalCards === 0}
        onclick={onExportZIP}
        aria-label="Export as ZIP of images"
        title={totalCards === 0 ? "Load a deck first" : `Export ${totalCards} card images as ZIP`}
      >
        <i class="fas fa-file-archive" aria-hidden="true"></i>
        <span>ZIP</span>
      </button>
    {/if}
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .toolbar-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .export-section {
    margin-left: auto;
  }

  .export-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 14px;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text, #ffffff);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, border-color 0.15s, opacity 0.15s;
  }

  .export-btn:hover:not(:disabled) {
    background: var(--theme-accent-muted, rgba(74, 158, 255, 0.15));
    border-color: var(--theme-accent, #4a9eff);
  }

  .export-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #4a9eff);
    outline-offset: 2px;
  }

  .export-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .progress-text {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    white-space: nowrap;
  }

  .error-text {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-min, 14px);
    color: #f87171;
    white-space: nowrap;
  }

  @media (max-width: 767px) {
    .toolbar {
      flex-wrap: wrap;
      row-gap: 8px;
    }

    .export-section {
      margin-left: 0;
      width: 100%;
      justify-content: flex-end;
    }
  }
</style>
