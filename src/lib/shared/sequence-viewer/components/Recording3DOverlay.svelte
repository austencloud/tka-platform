<!--
  Recording3DOverlay.svelte

  Floating overlay for 3D video recording & export:
  - Countdown (3, 2, 1) before recording starts
  - Recording indicator (red dot + elapsed timer + stop button) during capture
  - Full-screen progress overlay during Pass 2 (deterministic render)
-->
<script lang="ts">
  import type { VideoExportProgress } from "$lib/shared/compose/domain/video-export-types";
  interface Props {
    countdownValue: number;
    isRecording: boolean;
    elapsed: number;
    onStop: () => void;
    /** Pass 2 export state - when non-null, show full progress overlay */
    exportProgress: VideoExportProgress | null;
    isExporting: boolean;
    onCancelExport: () => void;
  }

  let {
    countdownValue,
    isRecording,
    elapsed,
    onStop,
    exportProgress,
    isExporting,
    onCancelExport,
  }: Props = $props();

  const progressPercent = $derived(
    exportProgress ? Math.round(exportProgress.progress * 100) : 0
  );

  const stageLabel = $derived(() => {
    if (!exportProgress) return "";
    switch (exportProgress.stage) {
      case "capturing": return "Rendering frames";
      case "encoding": return "Encoding video";
      case "complete": return "Complete";
      default: return "Exporting";
    }
  });

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
  }
</script>

{#if countdownValue > 0}
  <div class="overlay countdown-overlay" aria-live="assertive">
    {#key countdownValue}
      <div class="countdown-number">
        {countdownValue}
      </div>
    {/key}
  </div>
{/if}

{#if isRecording}
  <div class="overlay recording-badge" aria-live="polite">
    <div class="rec-dot"></div>
    <span class="rec-label">REC</span>
    <span class="rec-timer">{formatTime(elapsed)}</span>
    <button class="stop-btn" onclick={onStop} aria-label="Stop recording">
      <div class="stop-icon"></div>
    </button>
  </div>
{/if}

{#if isExporting && exportProgress && !isRecording}
  <div class="overlay export-overlay" aria-live="polite">
    <div class="export-card">
      <div class="export-header">
        <span class="export-title">{stageLabel()}</span>
        <span class="export-percent">{progressPercent}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: {progressPercent}%"></div>
      </div>
      {#if exportProgress.currentFrame != null && exportProgress.totalFrames}
        <div class="export-detail">
          Frame {exportProgress.currentFrame} / {exportProgress.totalFrames}
        </div>
      {/if}
      <button class="cancel-btn" onclick={onCancelExport}>Cancel</button>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: absolute;
    z-index: 20;
    pointer-events: none;
  }

  .countdown-overlay {
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
  }

  .countdown-number {
    font-size: 6rem;
    font-weight: 800;
    color: white;
    text-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
    animation: countdown-pop 0.8s ease-out;
    font-variant-numeric: tabular-nums;
  }

  @keyframes countdown-pop {
    0% { transform: scale(1.6); opacity: 0; }
    30% { transform: scale(1); opacity: 1; }
    80% { opacity: 1; }
    100% { opacity: 0.3; }
  }

  .recording-badge {
    top: 16px;
    left: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    border-radius: 20px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    pointer-events: auto;
  }

  .rec-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ef4444;
    box-shadow: 0 0 8px #ef4444;
    animation: rec-pulse 1.2s ease-in-out infinite;
  }

  @keyframes rec-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .rec-label {
    font-size: 12px;
    font-weight: 700;
    color: #ef4444;
    letter-spacing: 0.5px;
  }

  .rec-timer {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
    font-variant-numeric: tabular-nums;
  }

  .stop-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background: #ef4444;
    cursor: pointer;
    margin-left: 4px;
    transition: background 0.15s;
  }

  .stop-btn:hover {
    background: #dc2626;
  }

  .stop-icon {
    width: 8px;
    height: 8px;
    background: white;
    border-radius: 1px;
  }

  .export-overlay {
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(12px);
    pointer-events: auto;
  }

  .export-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px 32px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 16px;
    min-width: 260px;
    max-width: 320px;
  }

  .export-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .export-title {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .export-percent {
    font-size: 14px;
    font-weight: 700;
    color: white;
    font-variant-numeric: tabular-nums;
  }

  .progress-track {
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
    border-radius: 3px;
    transition: width 0.15s ease-out;
  }

  .export-detail {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    font-variant-numeric: tabular-nums;
  }

  .cancel-btn {
    align-self: center;
    padding: 6px 20px;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .cancel-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.15));
    color: white;
  }

  @media (prefers-reduced-motion: reduce) {
    .countdown-number {
      animation: none;
    }
    .rec-dot {
      animation: none;
    }
  }
</style>
