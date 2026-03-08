<!--
  ExportFooter.svelte

  Footer for export mode showing export button, progress, or error state.
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";

  type ExportType = "animation" | "image" | "both";

  interface Props {
    exportType: ExportType | null;
    isExporting: boolean;
    exportProgress: VideoExportProgress | null;
    exportError: string | null;
    isFullscreen: boolean;
    previewBlobUrl?: string | null;
    sequenceWord?: string;
    onExport: () => void;
    onCancel: () => void;
    onRetry: () => void;
    onDismissPreview?: () => void;
  }

  let {
    exportType,
    isExporting,
    exportProgress,
    exportError,
    isFullscreen,
    previewBlobUrl = null,
    sequenceWord = "sequence",
    onExport,
    onCancel,
    onRetry,
    onDismissPreview,
  }: Props = $props();

  function handleRedownload() {
    if (!previewBlobUrl) return;
    const a = document.createElement("a");
    a.href = previewBlobUrl;
    a.download = `${sequenceWord}.mp4`;
    a.click();
  }

  // Human-readable stage names for export progress
  const EXPORT_STAGE_LABELS: Record<string, string> = {
    capturing: "Capturing frames",
    encoding: "Encoding video",
    complete: "Complete",
    error: "Error",
  };
</script>

{#if exportType}
  <!-- Export mode: prominent export button with progress -->
  <footer class="controls-footer" data-hidden={isFullscreen}>
    <div
      class="export-footer-content"
      in:fade={{ duration: 200, delay: 50, easing: cubicOut }}
      out:fade={{ duration: 100, easing: cubicOut }}
    >
      {#if previewBlobUrl && onDismissPreview}
        <!-- Post-export preview actions -->
        <div class="preview-actions-row">
          <button
            type="button"
            class="preview-action-btn secondary"
            onclick={handleRedownload}
            aria-label="Download video again"
          >
            <i class="fas fa-download" aria-hidden="true"></i>
            Save Again
          </button>
          <button
            type="button"
            class="preview-action-btn primary"
            onclick={onDismissPreview}
            aria-label="Done, return to viewer"
          >
            <i class="fas fa-check" aria-hidden="true"></i>
            Done
          </button>
        </div>
      {:else if exportError}
        <!-- Error state with retry button -->
        <div class="export-error-state" role="alert">
          <div class="error-content">
            <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
            <span class="error-message">{exportError}</span>
          </div>
          <button
            type="button"
            class="retry-export-btn"
            onclick={onRetry}
          >
            <i class="fas fa-redo" aria-hidden="true"></i>
            Retry
          </button>
        </div>
      {:else if isExporting && exportProgress}
        <!-- Progress display during export -->
        <div class="export-progress" role="status" aria-live="polite">
          <span class="progress-stage">{EXPORT_STAGE_LABELS[exportProgress.stage] || exportProgress.stage}</span>
          <div
            class="progress-bar"
            role="progressbar"
            aria-valuenow={Math.round(exportProgress.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Export progress"
          >
            <div class="progress-fill" style="width: {exportProgress.progress * 100}%"></div>
          </div>
          <span class="progress-text" aria-live="polite" aria-atomic="true">{Math.round(exportProgress.progress * 100)}%</span>
          <button
            type="button"
            class="cancel-export-btn"
            onclick={onCancel}
            aria-label="Cancel export"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
      {:else}
        <!-- Prominent export button -->
        <button
          type="button"
          class="primary-export-btn"
          onclick={onExport}
          disabled={isExporting}
          aria-label={isExporting ? "Export in progress" : `Export ${exportType === "image" ? "image" : "video"}`}
        >
          <i class="fas fa-download" aria-hidden="true"></i>
          Export {exportType === "image" ? "Image" : "Video"}
        </button>
      {/if}
    </div>
  </footer>
{:else}
  <!-- Export type selection mode: no footer needed -->
  <footer class="controls-footer export-type-footer" data-hidden={isFullscreen}>
    <p class="footer-hint">Select an export format above</p>
  </footer>
{/if}

<style>
  .controls-footer {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    transition:
      opacity var(--duration-normal, 200ms) var(--ease-out, ease-out),
      transform var(--duration-normal, 200ms) var(--ease-out, ease-out);
  }

  .controls-footer[data-hidden="true"] {
    opacity: 0;
    transform: translateY(100%);
    pointer-events: none;
  }

  .export-footer-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .primary-export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    max-width: 320px;
    height: 56px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 16px;
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .primary-export-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 85%, white);
    transform: scale(1.02);
  }

  .primary-export-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .primary-export-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .primary-export-btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .primary-export-btn i {
    font-size: 18px;
  }

  /* Export progress display */
  .export-progress {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 320px;
  }

  .progress-bar {
    flex: 1;
    height: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--theme-accent, #6366f1);
    border-radius: 4px;
    transition: width 0.2s ease;
  }

  .progress-text {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text, white);
    min-width: 40px;
    text-align: right;
  }

  .progress-stage {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    min-width: 100px;
    white-space: nowrap;
  }

  .cancel-export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .cancel-export-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--semantic-error, #f87171);
    color: var(--semantic-error, #f87171);
  }

  /* Export error state */
  .export-error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 320px;
    padding: 16px;
    background: color-mix(in srgb, var(--semantic-error, #f87171) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error, #f87171) 30%, transparent);
    border-radius: 12px;
  }

  .export-error-state .error-content {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--semantic-error, #f87171);
  }

  .export-error-state .error-content i {
    font-size: 16px;
  }

  .export-error-state .error-message {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    text-align: center;
  }

  .retry-export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 100px;
    height: 44px;
    padding: 0 20px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 10px;
    color: white;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .retry-export-btn:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 85%, white);
    transform: scale(1.02);
  }

  .retry-export-btn:active {
    transform: scale(0.98);
  }

  .retry-export-btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  /* Preview actions */
  .preview-actions-row {
    display: flex;
    gap: 8px;
    width: 100%;
    max-width: 320px;
  }

  .preview-action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--min-touch-target);
    padding: 12px 16px;
    border-radius: 12px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .preview-action-btn.secondary {
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .preview-action-btn.secondary:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
  }

  .preview-action-btn.primary {
    background: var(--theme-accent, #6366f1);
    border: none;
    color: white;
  }

  .preview-action-btn.primary:hover {
    filter: brightness(1.1);
  }

  .preview-action-btn:active {
    transform: scale(0.98);
    transition-duration: 50ms;
  }

  .preview-action-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Export type footer hint */
  .export-type-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .footer-hint {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-align: center;
  }

  @media (max-width: 767px) {
    .controls-footer {
      padding: 12px;
      gap: 8px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .controls-footer,
    .primary-export-btn,
    .cancel-export-btn,
    .retry-export-btn,
    .progress-fill {
      transition: none !important;
    }
  }
</style>
