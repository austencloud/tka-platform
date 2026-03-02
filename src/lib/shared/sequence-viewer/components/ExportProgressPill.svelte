<!--
  ExportProgressPill.svelte

  Floating non-blocking progress indicator during video export.
  Shows progress ring + percentage during capture/encoding, checkmark on complete.
-->
<script lang="ts">
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";

  interface Props {
    progress: VideoExportProgress;
    onCancel: () => void;
    onDownload?: () => void;
  }

  let { progress, onCancel, onDownload }: Props = $props();

  const STAGE_LABELS: Record<string, string> = {
    capturing: "Capturing",
    encoding: "Encoding",
    complete: "Ready",
    error: "Failed",
  };

  const percent = $derived(Math.round(progress.progress * 100));
  const isComplete = $derived(progress.stage === "complete");
  const isError = $derived(progress.stage === "error");
</script>

<div
  class="progress-pill"
  class:complete={isComplete}
  class:error={isError}
  transition:fly={{ y: 60, duration: 250, easing: cubicOut }}
  role="status"
  aria-live="polite"
>
  {#if isComplete}
    <i class="fas fa-check-circle pill-icon" aria-hidden="true"></i>
    <span class="pill-label">Export ready</span>
    {#if onDownload}
      <button type="button" class="pill-action" onclick={onDownload}>
        Download
      </button>
    {/if}
  {:else if isError}
    <i class="fas fa-exclamation-circle pill-icon" aria-hidden="true"></i>
    <span class="pill-label">Export failed</span>
  {:else}
    <ProgressRing percent={percent} size={24} strokeWidth={3} />
    <span class="pill-label"
      >{STAGE_LABELS[progress.stage] ?? "Exporting"} {percent}%</span
    >
    <button
      type="button"
      class="pill-cancel"
      onclick={onCancel}
      aria-label="Cancel export"
    >
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  {/if}
</div>

<style>
  .progress-pill {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.95));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 100px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    z-index: 100;
    min-height: 48px;
  }

  .progress-pill.complete {
    border-color: rgba(34, 197, 94, 0.4);
  }

  .progress-pill.error {
    border-color: rgba(248, 113, 113, 0.4);
  }

  .pill-icon {
    font-size: 20px;
  }

  .complete .pill-icon {
    color: #4ade80;
  }

  .error .pill-icon {
    color: #f87171;
  }

  .pill-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text, white);
    white-space: nowrap;
  }

  .pill-action {
    display: flex;
    align-items: center;
    padding: 6px 14px;
    border: none;
    border-radius: 100px;
    background: var(--theme-accent, #6366f1);
    color: white;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: filter 0.15s ease;
    min-height: 32px;
  }

  .pill-action:hover {
    filter: brightness(1.15);
  }

  .pill-cancel {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition: background 0.15s ease;
    font-size: 12px;
  }

  .pill-cancel:hover {
    background: rgba(255, 255, 255, 0.2);
    color: var(--theme-text, white);
  }

  @media (prefers-reduced-motion: reduce) {
    .pill-action,
    .pill-cancel {
      transition: none !important;
    }
  }
</style>
