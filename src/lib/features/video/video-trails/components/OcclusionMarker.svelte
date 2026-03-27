<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";
  import type { EndpointCorrection } from "../domain/types";

  interface Props {
    selectedPropIndex: 0 | 1;
    selectedTipIndex: number;
  }

  let { selectedPropIndex, selectedTipIndex }: Props = $props();

  const { state: trailsState } = getVideoTrailsContext();

  let interpolateStart = $state(0);
  let interpolateEnd = $state(0);

  // Current frame's correction status for the selected endpoint
  let currentCorrection = $derived.by((): EndpointCorrection | undefined => {
    const frameCorrectionList = trailsState.corrections[trailsState.currentFrame];
    return frameCorrectionList?.find(
      (c) => c.propIndex === selectedPropIndex && c.tipIndex === selectedTipIndex,
    );
  });

  // All occluded frame ranges for the selected endpoint, grouped into contiguous runs
  let occludedRanges = $derived.by((): Array<{ start: number; end: number }> => {
    const occludedFrames: number[] = [];
    for (const [frameStr, correctionList] of Object.entries(trailsState.corrections)) {
      const frame = Number(frameStr);
      const match = correctionList.find(
        (c) => c.propIndex === selectedPropIndex && c.tipIndex === selectedTipIndex && c.status === "occluded",
      );
      if (match) occludedFrames.push(frame);
    }
    occludedFrames.sort((a, b) => a - b);

    const ranges: Array<{ start: number; end: number }> = [];
    for (const frame of occludedFrames) {
      const last = ranges[ranges.length - 1];
      if (last && frame === last.end + 1) {
        last.end = frame;
      } else {
        ranges.push({ start: frame, end: frame });
      }
    }
    return ranges;
  });

  const propLabel = $derived(selectedPropIndex === 0 ? "Blue" : "Red");
  const statusColorClass = $derived(
    currentCorrection?.status === "occluded"
      ? "status-occluded"
      : currentCorrection?.status === "interpolated"
        ? "status-interpolated"
        : currentCorrection?.status === "corrected"
          ? "status-corrected"
          : currentCorrection?.status === "accepted"
            ? "status-accepted"
            : "status-none",
  );

  function handleMarkOccluded() {
    trailsState.markOccluded(trailsState.currentFrame, selectedPropIndex, selectedTipIndex);
  }

  function handleInterpolate() {
    if (interpolateStart >= interpolateEnd) return;
    trailsState.interpolateGap(interpolateStart, interpolateEnd, selectedPropIndex, selectedTipIndex);
  }
</script>

<div class="occlusion-marker">
  <div class="section-header">
    <i class="fas fa-eye-slash" aria-hidden="true"></i>
    <span>Occlusion — {propLabel} tip {selectedTipIndex}</span>
  </div>

  <div class="current-status">
    <span class="label">Frame {trailsState.currentFrame}:</span>
    <span class="status {statusColorClass}">
      {currentCorrection?.status ?? "no correction"}
    </span>
  </div>

  <button class="mark-btn" onclick={handleMarkOccluded}>
    Mark Frame {trailsState.currentFrame} Occluded
  </button>

  <div class="interpolate-section">
    <span class="subsection-label">Interpolate gap</span>
    <div class="frame-inputs">
      <label>
        From
        <input type="number" bind:value={interpolateStart} min={0} max={trailsState.totalFrames} />
      </label>
      <label>
        To
        <input type="number" bind:value={interpolateEnd} min={0} max={trailsState.totalFrames} />
      </label>
    </div>
    <button
      class="interpolate-btn"
      onclick={handleInterpolate}
      disabled={interpolateStart >= interpolateEnd}
    >
      Interpolate
    </button>
  </div>

  {#if occludedRanges.length > 0}
    <div class="ranges-section">
      <span class="subsection-label">Occluded ranges</span>
      <ul class="ranges-list">
        {#each occludedRanges as range}
          <li>
            {#if range.start === range.end}
              Frame {range.start}
            {:else}
              Frames {range.start}–{range.end}
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .occlusion-marker {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, #fff);
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .section-header i {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .current-status {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .label {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .status {
    font-weight: 600;
    text-transform: capitalize;
  }

  .status-none { color: var(--theme-text-muted, rgba(255, 255, 255, 0.4)); }
  .status-occluded { color: var(--semantic-error, #ef4444); }
  .status-interpolated { color: var(--theme-accent, #f43f5e); }
  .status-corrected { color: var(--semantic-success, #22c55e); }
  .status-accepted { color: var(--theme-text-muted, rgba(255, 255, 255, 0.4)); }

  .mark-btn,
  .interpolate-btn {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: rgba(239, 68, 68, 0.15);
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: background 0.15s;
    text-align: left;
  }

  .mark-btn:hover {
    background: rgba(239, 68, 68, 0.25);
  }

  .interpolate-btn {
    background: rgba(244, 63, 94, 0.15);
    color: var(--theme-accent, #f43f5e);
  }

  .interpolate-btn:hover:not(:disabled) {
    background: rgba(244, 63, 94, 0.25);
  }

  .interpolate-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .subsection-label {
    display: block;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    margin-bottom: 4px;
  }

  .interpolate-section,
  .ranges-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .frame-inputs {
    display: flex;
    gap: 8px;
  }

  .frame-inputs label {
    display: flex;
    flex-direction: column;
    gap: 3px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-compact, 12px);
  }

  .frame-inputs input {
    width: 70px;
    padding: 4px 6px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 12px);
  }

  .frame-inputs input:focus {
    outline: none;
    border-color: var(--theme-accent, #f43f5e);
  }

  .ranges-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .ranges-list li {
    padding: 3px 8px;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 4px;
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-compact, 12px);
  }
</style>
