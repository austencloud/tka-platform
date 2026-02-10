<!--
  CaptureProgress — Shows a progress bar and count during active captures.
  Auto-polls the capture job status endpoint every 2 seconds.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import type {
    CaptureJobStatus,
    IScreenshotOrchestrator,
  } from "../../services/contracts/IScreenshotOrchestrator";

  interface Props {
    jobId: string | null;
    orchestrator: IScreenshotOrchestrator;
    onPollStatus?: (status: CaptureJobStatus) => void;
    onComplete?: () => void;
  }

  let { jobId, orchestrator, onPollStatus, onComplete }: Props = $props();

  let status = $state<CaptureJobStatus | null>(null);
  // Not reactive — infrastructure-only, no rendering depends on this ref
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const progressPercent = $derived(
    status && status.total > 0
      ? Math.round((status.completed / status.total) * 100)
      : 0
  );

  const elapsed = $derived(() => {
    if (!status) return "";
    const ms = (status.finishedAt ?? Date.now()) - status.startedAt;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  });

  // Poll job status when jobId is set
  $effect(() => {
    const id = jobId;

    if (!id) {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      status = null;
      return;
    }

    // Start polling via orchestrator service
    async function poll() {
      if (!id) return;
      try {
        const data = await orchestrator.getJobStatus(id);
        status = data;
        onPollStatus?.(data);

        if (data.status === "completed" || data.status === "failed") {
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
          onComplete?.();
        }
      } catch {
        // Network error, keep polling
      }
    }

    untrack(() => {
      poll(); // Immediate first poll
      pollTimer = setInterval(poll, 2000);
    });

    return () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
  });
</script>

{#if status}
  <div class="capture-progress" class:failed={status.status === "failed"}>
    <div class="progress-header">
      {#if status.status === "running"}
        <i class="fas fa-circle-notch fa-spin"></i>
        <span class="progress-text">
          Capturing {status.completed} / {status.total}
        </span>
      {:else if status.status === "completed"}
        <i class="fas fa-check-circle"></i>
        <span class="progress-text">
          Captured {status.completed} screenshots
        </span>
      {:else}
        <i class="fas fa-exclamation-triangle"></i>
        <span class="progress-text">Capture failed</span>
      {/if}
      <span class="elapsed">{elapsed()}</span>
    </div>

    <div class="progress-bar-track">
      <div
        class="progress-bar-fill"
        class:complete={status.status === "completed"}
        class:error={status.status === "failed"}
        style="width: {progressPercent}%"
      ></div>
    </div>

    {#if status.status === "failed" && status.error}
      <p class="error-detail">{status.error}</p>
    {/if}
  </div>
{/if}

<style>
  .capture-progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
  }

  .capture-progress.failed {
    border-color: var(--semantic-error, #ef4444);
  }

  .progress-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #fff);
  }

  .progress-header i {
    font-size: var(--font-size-compact, 12px);
  }

  .progress-header .fa-check-circle {
    color: var(--semantic-success, #22c55e);
  }

  .progress-header .fa-exclamation-triangle {
    color: var(--semantic-error, #ef4444);
  }

  .progress-text {
    font-weight: 500;
  }

  .elapsed {
    margin-left: auto;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-variant-numeric: tabular-nums;
  }

  .progress-bar-track {
    height: 6px;
    border-radius: 3px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    border-radius: 3px;
    background: var(--theme-accent, #3b82f6);
    transition: width 0.3s ease;
  }

  .progress-bar-fill.complete {
    background: var(--semantic-success, #22c55e);
  }

  .progress-bar-fill.error {
    background: var(--semantic-error, #ef4444);
  }

  .error-detail {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-error, #ef4444);
    font-family: "SF Mono", "Fira Code", monospace;
    white-space: pre-wrap;
    max-height: 80px;
    overflow-y: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-bar-fill {
      transition: none;
    }
  }
</style>
