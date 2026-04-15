<script lang="ts">
  /**
   * RecordSceneExportPopover
   *
   * Export-domain settings for the 3D Record Scene chrome. These settings
   * affect the file that gets written, not what the viewer sees on screen.
   *
   * Opens from a film-strip button in the top-right overlay bar.
   */

  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";
  import type {
    ExportOptionsStateManager,
    VideoResolution,
  } from "../../state/export-options-state.svelte";
  import { estimateExportTime, hasDeviceMetrics } from "../../state/export-timing-tracker";

  interface Props {
    exportOptions: ExportOptionsStateManager;
    singlePlayDuration?: number;
  }

  let { exportOptions, singlePlayDuration = 0 }: Props = $props();

  let open = $state(false);
  let rootEl = $state<HTMLDivElement | null>(null);

  // 3D exports are always square, so the label shows actual pixel dimensions.
  const resOptions: { value: VideoResolution; label: string }[] = [
    { value: 720, label: "720x720" },
    { value: 1080, label: "1080x1080" },
    { value: 2160, label: "4K" },
    { value: 4320, label: "8K" },
  ];

  function toggleOpen(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
  }

  function handleOutsideClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target as Node;
    if (rootEl && !rootEl.contains(target)) {
      open = false;
    }
  }

  function formatDuration(seconds: number): string {
    if (seconds <= 0) return "";
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }

  const estimatedTime = $derived.by(() => {
    if (singlePlayDuration <= 0) return null;
    return estimateExportTime(
      exportOptions.videoResolution,
      exportOptions.videoFps,
      singlePlayDuration,
      exportOptions.videoLoopCount,
    );
  });

  const timeEstimateLabel = $derived.by(() => {
    if (estimatedTime === null) return "";
    const label = formatDuration(estimatedTime);
    if (!label) return "";
    const isEstimate = !hasDeviceMetrics(exportOptions.videoResolution);
    return isEstimate ? `~${label} est.` : `~${label}`;
  });

  const totalVideoDuration = $derived.by(() => {
    if (singlePlayDuration <= 0) return "";
    const total = singlePlayDuration * exportOptions.videoLoopCount;
    return formatDuration(total);
  });
</script>

<svelte:window onclick={handleOutsideClick} />

<div class="popover-root" bind:this={rootEl}>
  <button
    type="button"
    class="trigger"
    class:active={open}
    onclick={toggleOpen}
    aria-label="Export settings"
    aria-expanded={open}
    aria-haspopup="true"
    title="Export"
  >
    <i class="fas fa-film" aria-hidden="true"></i>
    <span class="trigger-label">Export</span>
  </button>

  {#if open}
    <div
      class="popover"
      role="dialog"
      aria-label="Export settings"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        if (e.key === "Escape") open = false;
      }}
      in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
      out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}
    >
      <div class="row stacked">
        <span class="row-label">Resolution</span>
        <div class="chip-group wrap">
          {#each resOptions as opt}
            <button
              type="button"
              class="chip"
              class:active={exportOptions.videoResolution === opt.value}
              onclick={() => exportOptions.setVideoResolution(opt.value)}
              aria-pressed={exportOptions.videoResolution === opt.value}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="row stacked">
        <span class="row-label">Quality</span>
        <div class="chip-group">
          <button
            type="button"
            class="chip"
            class:active={exportOptions.videoQuality === "standard"}
            onclick={() => exportOptions.setVideoQuality("standard")}
            aria-pressed={exportOptions.videoQuality === "standard"}
          >
            Standard
          </button>
          <button
            type="button"
            class="chip"
            class:active={exportOptions.videoQuality === "cinema"}
            onclick={() => exportOptions.setVideoQuality("cinema")}
            aria-pressed={exportOptions.videoQuality === "cinema"}
          >
            <i class="fas fa-film" aria-hidden="true"></i>
            Cinema
          </button>
        </div>
      </div>

      <div class="row stacked">
        <span class="row-label">Timing</span>
        <div class="chip-group">
          <button
            type="button"
            class="chip"
            class:active={exportOptions.videoIncludeStartPosition}
            onclick={() =>
              exportOptions.setVideoIncludeStartPosition(!exportOptions.videoIncludeStartPosition)}
            aria-pressed={exportOptions.videoIncludeStartPosition}
          >
            Start Pos
          </button>
          <button
            type="button"
            class="chip"
            class:active={exportOptions.videoIncludeEndHold}
            onclick={() =>
              exportOptions.setVideoIncludeEndHold(!exportOptions.videoIncludeEndHold)}
            aria-pressed={exportOptions.videoIncludeEndHold}
          >
            End Hold
          </button>
        </div>
      </div>

      <div class="row">
        <span class="row-label">Loops</span>
        <div class="loop-control">
          <button
            type="button"
            class="stepper-btn"
            onclick={() => exportOptions.setVideoLoopCount(exportOptions.videoLoopCount - 1)}
            disabled={exportOptions.videoLoopCount <= 1}
            aria-label="Decrease loop count"
          >
            <i class="fas fa-minus" aria-hidden="true"></i>
          </button>
          <span class="loop-value">{exportOptions.videoLoopCount}x</span>
          <button
            type="button"
            class="stepper-btn"
            onclick={() => exportOptions.setVideoLoopCount(exportOptions.videoLoopCount + 1)}
            disabled={exportOptions.videoLoopCount >= 10}
            aria-label="Increase loop count"
          >
            <i class="fas fa-plus" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      {#if totalVideoDuration || timeEstimateLabel}
        <div class="estimates">
          {#if totalVideoDuration}
            <div class="estimate-line">
              <i class="fas fa-film" aria-hidden="true"></i>
              <span>Video length: {totalVideoDuration}</span>
            </div>
          {/if}
          {#if timeEstimateLabel}
            <div class="estimate-line">
              <i class="fas fa-clock" aria-hidden="true"></i>
              <span>Render time: {timeEstimateLabel}</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .popover-root {
    position: relative;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 14px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.75);
    font-size: var(--font-size-min, 13px);
    font-weight: 500;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
  }

  .trigger:hover {
    background: rgba(0, 0, 0, 0.7);
    color: rgba(255, 255, 255, 0.95);
  }

  .trigger.active {
    background: rgba(139, 139, 255, 0.2);
    border-color: rgba(139, 139, 255, 0.35);
    color: #fff;
  }

  .trigger i {
    font-size: 12px;
  }

  .popover {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 100;
    width: 300px;
    padding: 12px;
    border-radius: 12px;
    transform-origin: top right;
    background: rgba(14, 14, 24, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 32px;
  }

  .row.stacked {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .row-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.55);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .chip-group {
    display: inline-flex;
    gap: 4px;
    flex-wrap: nowrap;
    width: 100%;
  }

  .chip-group.wrap {
    flex-wrap: wrap;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    padding: 0 10px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.55);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    flex: 1;
    justify-content: center;
  }

  .chip:hover:not(.active) {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.85);
  }

  .chip.active {
    background: rgba(139, 139, 255, 0.25);
    border-color: rgba(139, 139, 255, 0.45);
    color: #fff;
  }

  .chip i {
    font-size: 10px;
  }

  .loop-control {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .stepper-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: background 150ms ease;
  }

  .stepper-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .stepper-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .stepper-btn i {
    font-size: 10px;
  }

  .loop-value {
    min-width: 32px;
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    color: #fff;
    font-size: var(--font-size-min, 13px);
  }

  .estimates {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .estimate-line {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.55);
  }

  .estimate-line i {
    font-size: 10px;
    opacity: 0.8;
  }
</style>
