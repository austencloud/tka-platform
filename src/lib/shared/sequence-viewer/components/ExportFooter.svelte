<!--
  ExportFooter.svelte

  Footer for export mode showing progress, error states, or export button.
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";

  interface Props {
    viewMode: "animation" | "image" | "split";
    isExporting: boolean;
    exportProgress: VideoExportProgress | null;
    exportError: string | null;
    onExport: () => void;
    onCancelExport: () => void;
    onRetry: () => void;
  }

  let {
    viewMode,
    isExporting,
    exportProgress,
    exportError,
    onExport,
    onCancelExport,
    onRetry,
  }: Props = $props();

  // Human-readable stage names for export progress
  const EXPORT_STAGE_LABELS: Record<string, string> = {
    capturing: "Capturing frames",
    encoding: "Encoding video",
    complete: "Complete",
    error: "Error",
  };
</script>

<footer class="controls-footer">
  <div
    class="export-footer-content"
    in:fade={{ duration: 200, delay: 50, easing: cubicOut }}
    out:fade={{ duration: 100, easing: cubicOut }}
  >
    {#if exportError}
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
          onclick={onCancelExport}
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
        aria-label={isExporting ? "Export in progress" : `Export ${viewMode === "image" ? "image" : "video"}`}
      >
        <i class="fas fa-download" aria-hidden="true"></i>
        Export {viewMode === "image" ? "Image" : "Video"}
      </button>
    {/if}
  </div>
</footer>

<style>
  .controls-footer {
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .export-footer-content {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
  }

  /* Primary export button */
  .primary-export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    max-width: 320px;
    padding: 14px 24px;
    border: none;
    border-radius: 12px;
    background: var(--theme-accent, #6366f1);
    color: white;
    font-size: var(--font-size-md, 16px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .primary-export-btn:hover:not(:disabled) {
    background: var(--theme-accent-hover, #4f46e5);
    transform: translateY(-1px);
  }

  .primary-export-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .primary-export-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Error state */
  .export-error-state {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    max-width: 400px;
  }

  .error-content {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--semantic-error, #ef4444);
  }

  .error-content i {
    font-size: 18px;
  }

  .error-message {
    font-size: var(--font-size-sm, 14px);
  }

  .retry-export-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border: 1px solid var(--semantic-error, #ef4444);
    border-radius: 8px;
    background: transparent;
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease-out);
    white-space: nowrap;
  }

  .retry-export-btn:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  /* Progress state */
  .export-progress {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 400px;
  }

  .progress-stage {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    white-space: nowrap;
    min-width: 100px;
  }

  .progress-bar {
    flex: 1;
    height: 6px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--theme-accent, #6366f1);
    border-radius: 3px;
    transition: width var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .progress-text {
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    color: var(--theme-text, #fff);
    min-width: 40px;
    text-align: right;
  }

  .cancel-export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .cancel-export-btn:hover {
    background: var(--semantic-error, #ef4444);
    color: white;
  }

  /* Responsive */
  @media (max-width: 767px) {
    .controls-footer {
      padding: 10px 12px;
    }

    .primary-export-btn {
      padding: 12px 20px;
      font-size: var(--font-size-sm, 14px);
    }

    .progress-stage {
      font-size: var(--font-size-xs, 12px);
      min-width: 80px;
    }

    .export-error-state {
      flex-direction: column;
      gap: 12px;
    }

    .retry-export-btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>
