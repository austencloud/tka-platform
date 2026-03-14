<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";

  const { state: trailsState } = getVideoTrailsContext();

  // Fast lookup sets for marker coloring
  let correctedFrameSet = $derived(
    new Set(Object.keys(trailsState.corrections).map(Number)),
  );
  let lowConfSet = $derived(new Set(trailsState.lowConfidenceFrames));
  let detectedFrameSet = $derived(
    new Set(Object.keys(trailsState.frameDetections).map(Number)),
  );

  // Sample up to 200 markers to keep DOM lightweight
  let markers = $derived.by(() => {
    const total = trailsState.totalFrames;
    if (total === 0) return [];

    const result: { frame: number; color: string }[] = [];
    const step = Math.max(1, Math.floor(total / 200));

    for (let f = 0; f < total; f += step) {
      if (correctedFrameSet.has(f)) {
        result.push({ frame: f, color: "#ef4444" });
      } else if (lowConfSet.has(f)) {
        result.push({ frame: f, color: "#eab308" });
      } else if (detectedFrameSet.has(f)) {
        result.push({ frame: f, color: "#22c55e" });
      }
    }
    return result;
  });

  // Sorted frame lists for skip navigation
  let sortedCorrectedFrames = $derived(
    [...correctedFrameSet].sort((a, b) => a - b),
  );
  let sortedLowConfFrames = $derived(
    [...trailsState.lowConfidenceFrames].sort((a, b) => a - b),
  );

  function skipTo(
    direction: "prev" | "next",
    type: "low-conf" | "corrected",
  ): void {
    const frames =
      type === "low-conf" ? sortedLowConfFrames : sortedCorrectedFrames;
    const current = trailsState.currentFrame;

    if (direction === "next") {
      const next = frames.find((f) => f > current);
      if (next !== undefined) trailsState.setCurrentFrame(next);
    } else {
      const prev = [...frames].reverse().find((f) => f < current);
      if (prev !== undefined) trailsState.setCurrentFrame(prev);
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      trailsState.setCurrentFrame(
        Math.max(0, trailsState.currentFrame - step),
      );
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      trailsState.setCurrentFrame(
        Math.min(trailsState.totalFrames - 1, trailsState.currentFrame + step),
      );
    }
  }

  function handleRangeInput(e: Event): void {
    const target = e.target as HTMLInputElement;
    trailsState.setCurrentFrame(Number(target.value));
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="timeline-scrubber" onkeydown={handleKeydown} tabindex="0">
  <div class="frame-counter">
    <span class="frame-label">Frame</span>
    <span class="frame-value">
      {trailsState.currentFrame + 1}
      <span class="frame-separator">/</span>
      {trailsState.totalFrames}
    </span>
  </div>

  <div class="scrubber-track">
    <input
      type="range"
      class="range-input"
      min="0"
      max={Math.max(0, trailsState.totalFrames - 1)}
      value={trailsState.currentFrame}
      oninput={handleRangeInput}
    />

    <div class="marker-bar" aria-hidden="true">
      {#each markers as marker (marker.frame)}
        <span
          class="marker-dot"
          style="left: {(marker.frame / Math.max(1, trailsState.totalFrames - 1)) * 100}%; background: {marker.color};"
        ></span>
      {/each}
    </div>
  </div>

  <div class="skip-controls">
    <div class="skip-group">
      <button
        class="skip-btn"
        onclick={() => skipTo("prev", "low-conf")}
        title="Previous low-confidence frame"
        disabled={sortedLowConfFrames.length === 0}
      >
        <i class="fas fa-angle-left" aria-hidden="true"></i>
        <span class="skip-dot yellow"></span>
      </button>
      <button
        class="skip-btn"
        onclick={() => skipTo("next", "low-conf")}
        title="Next low-confidence frame"
        disabled={sortedLowConfFrames.length === 0}
      >
        <span class="skip-dot yellow"></span>
        <i class="fas fa-angle-right" aria-hidden="true"></i>
      </button>
    </div>

    <div class="skip-group">
      <button
        class="skip-btn"
        onclick={() => skipTo("prev", "corrected")}
        title="Previous corrected frame"
        disabled={sortedCorrectedFrames.length === 0}
      >
        <i class="fas fa-angle-left" aria-hidden="true"></i>
        <span class="skip-dot red"></span>
      </button>
      <button
        class="skip-btn"
        onclick={() => skipTo("next", "corrected")}
        title="Next corrected frame"
        disabled={sortedCorrectedFrames.length === 0}
      >
        <span class="skip-dot red"></span>
        <i class="fas fa-angle-right" aria-hidden="true"></i>
      </button>
    </div>
  </div>

  <div class="legend">
    <span class="legend-item"><span class="legend-dot green"></span> Detected</span>
    <span class="legend-item"><span class="legend-dot yellow"></span> Low conf</span>
    <span class="legend-item"><span class="legend-dot red"></span> Corrected</span>
  </div>
</div>

<style>
  .timeline-scrubber {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
  }

  .timeline-scrubber:focus-visible {
    outline: 2px solid var(--theme-accent, #f43f5e);
    outline-offset: 2px;
  }

  .frame-counter {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .frame-value {
    font-variant-numeric: tabular-nums;
    color: var(--theme-text, #ffffff);
    font-weight: 500;
  }

  .frame-separator {
    opacity: 0.4;
    margin: 0 1px;
  }

  .scrubber-track {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .range-input {
    width: 100%;
    height: 20px;
    cursor: pointer;
    accent-color: var(--theme-accent, #f43f5e);
  }

  .marker-bar {
    position: relative;
    height: 6px;
    margin: 0 8px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.04);
  }

  .marker-dot {
    position: absolute;
    top: 1px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    transform: translateX(-50%);
  }

  .skip-controls {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .skip-group {
    display: flex;
    gap: 2px;
  }

  .skip-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 4px 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    background: transparent;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .skip-btn:hover:not(:disabled) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .skip-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .skip-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .skip-dot.yellow {
    background: #eab308;
  }

  .skip-dot.red {
    background: #ef4444;
  }

  .legend {
    display: flex;
    gap: 12px;
    justify-content: center;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .legend-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .legend-dot.green {
    background: #22c55e;
  }

  .legend-dot.yellow {
    background: #eab308;
  }

  .legend-dot.red {
    background: #ef4444;
  }
</style>
