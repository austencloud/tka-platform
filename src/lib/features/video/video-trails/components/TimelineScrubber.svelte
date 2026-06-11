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

  function handleRangeInput(e: Event): void {
    const target = e.target as HTMLInputElement;
    trailsState.setCurrentFrame(Number(target.value));
  }
</script>

<div class="timeline-scrubber">
  <div class="scrubber-track">
    <input
      type="range"
      class="range-input"
      min="0"
      max={Math.max(0, trailsState.totalFrames - 1)}
      value={trailsState.currentFrame}
      oninput={handleRangeInput}
      aria-label="Timeline scrubber"
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
    gap: 3px;
  }

  .scrubber-track {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .range-input {
    width: 100%;
    height: 16px;
    cursor: pointer;
    accent-color: var(--theme-accent, #f43f5e);
  }

  .marker-bar {
    position: relative;
    height: 5px;
    margin: 0 8px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.03);
  }

  .marker-dot {
    position: absolute;
    top: 1px;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    transform: translateX(-50%);
  }

  .legend {
    display: flex;
    gap: 10px;
    justify-content: center;
    font-size: 11px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .legend-dot {
    display: inline-block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
  }

  .legend-dot.green {
    background: var(--semantic-success, #22c55e);
  }

  .legend-dot.yellow {
    background: var(--semantic-warning, #eab308);
  }

  .legend-dot.red {
    background: var(--semantic-error, #ef4444);
  }
</style>
