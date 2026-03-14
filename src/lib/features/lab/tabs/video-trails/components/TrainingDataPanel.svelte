<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";
  import type { DetectedEndpoint, EndpointCorrection } from "../domain/types";

  interface TrainingExport {
    exportedAt: string;
    totalFrames: number;
    correctedFrames: number;
    corrections: Record<number, EndpointCorrection[]>;
    detections: Record<number, DetectedEndpoint[]>;
  }

  const { state: trailsState } = getVideoTrailsContext();

  const detectedFrameCount = $derived(Object.keys(trailsState.frameDetections).length);

  // Average pixel distance between detected and corrected positions across all corrections
  const avgCorrectionDrift = $derived.by((): number => {
    let total = 0;
    let count = 0;
    for (const correctionList of Object.values(trailsState.corrections)) {
      for (const c of correctionList) {
        if (c.detected && c.corrected) {
          const dx = c.corrected.x - c.detected.x;
          const dy = c.corrected.y - c.detected.y;
          total += Math.sqrt(dx * dx + dy * dy);
          count++;
        }
      }
    }
    return count > 0 ? total / count : 0;
  });

  function handleExport() {
    const data: TrainingExport = {
      exportedAt: new Date().toISOString(),
      totalFrames: trailsState.totalFrames,
      correctedFrames: trailsState.correctionCount,
      corrections: trailsState.corrections,
      detections: trailsState.frameDetections,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "video-trails-training-data.json";
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="training-panel">
  <div class="panel-header">
    <i class="fas fa-database" aria-hidden="true"></i>
    <span>Training Data</span>
  </div>

  <dl class="stats">
    <div class="stat-row">
      <dt>Frames with detections</dt>
      <dd>{detectedFrameCount}</dd>
    </div>
    <div class="stat-row">
      <dt>Corrected frames</dt>
      <dd class:has-data={trailsState.correctionCount > 0}>{trailsState.correctionCount}</dd>
    </div>
    <div class="stat-row">
      <dt>Low confidence frames</dt>
      <dd class:warning={trailsState.lowConfidenceFrames.length > 0}>
        {trailsState.lowConfidenceFrames.length}
      </dd>
    </div>
    <div class="stat-row">
      <dt>Avg correction drift</dt>
      <dd>
        {#if avgCorrectionDrift > 0}
          {avgCorrectionDrift.toFixed(1)} px
        {:else}
          —
        {/if}
      </dd>
    </div>
  </dl>

  <button
    class="export-btn"
    onclick={handleExport}
    disabled={detectedFrameCount === 0 && trailsState.correctionCount === 0}
  >
    <i class="fas fa-download" aria-hidden="true"></i>
    Export Training Data
  </button>
</div>

<style>
  .training-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #fff);
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
  }

  .panel-header i {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .stats {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--font-size-compact, 12px);
  }

  dt {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  dd {
    margin: 0;
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  dd.has-data {
    color: var(--semantic-success, #22c55e);
  }

  dd.warning {
    color: var(--semantic-error, #ef4444);
  }

  .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--theme-accent, #f43f5e);
    background: rgba(244, 63, 94, 0.15);
    color: var(--theme-accent, #f43f5e);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: background 0.15s;
  }

  .export-btn:hover:not(:disabled) {
    background: rgba(244, 63, 94, 0.25);
  }

  .export-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    background: transparent;
  }
</style>
