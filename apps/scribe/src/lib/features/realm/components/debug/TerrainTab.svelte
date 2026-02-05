<script lang="ts">
  /**
   * TerrainTab - Debug panel tab for terrain controls
   *
   * Controls: View distance, LOD, chunk stats
   */

  interface ChunkStats {
    loaded: number;
    pending: number;
    loading: number;
  }

  interface Props {
    chunkStats: ChunkStats;
    viewDistance: number;
    chunkSize: number;
    onViewDistanceChange?: (distance: number) => void;
  }

  let { chunkStats, viewDistance, chunkSize, onViewDistanceChange }: Props = $props();

  const totalChunks = $derived(chunkStats.loaded + chunkStats.pending + chunkStats.loading);

  function handleViewDistanceChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const value = parseInt(target.value, 10);
    onViewDistanceChange?.(value);
  }
</script>

<div class="tab-content">
  <div class="details-section">
    <!-- Chunk Stats -->
    <div class="detail-group">
      <div class="detail-title">
        <i class="fas fa-cube" style="color: #60a5fa" aria-hidden="true"></i>
        Chunks
      </div>
      <div class="detail-row">
        <span class="detail-label">Loaded</span>
        <span class="detail-value highlight">{chunkStats.loaded}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Loading</span>
        <span class="detail-value status" class:ok={chunkStats.loading === 0} class:pending={chunkStats.loading > 0}>
          {chunkStats.loading}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Pending</span>
        <span class="detail-value">{chunkStats.pending}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Total</span>
        <span class="detail-value">{totalChunks}</span>
      </div>
    </div>

    <!-- View Settings -->
    <div class="detail-group">
      <div class="detail-title">
        <i class="fas fa-eye" style="color: #22c55e" aria-hidden="true"></i>
        View Settings
      </div>
      <div class="slider-row">
        <span class="slider-label">View Distance</span>
        <span class="slider-value">{viewDistance}m</span>
      </div>
      <input
        type="range"
        min="64"
        max="512"
        step="32"
        value={viewDistance}
        oninput={handleViewDistanceChange}
        class="slider"
      />
      <div class="detail-row">
        <span class="detail-label">Chunk Size</span>
        <span class="detail-value">{chunkSize}m</span>
      </div>
    </div>
  </div>

  <div class="hint">
    Higher view distance = more chunks = lower FPS
  </div>
</div>

<style>
  .tab-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .details-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .detail-group {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
    border-radius: 12px;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .detail-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: white;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .detail-title i {
    font-size: 14px;
    filter: drop-shadow(0 0 8px currentColor);
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    font-size: 14px;
  }

  .detail-label {
    color: rgba(255, 255, 255, 0.6);
  }

  .detail-value {
    color: white;
    font-weight: 600;
  }

  .detail-value.highlight {
    color: #60a5fa;
  }

  .detail-value.status.ok {
    color: #4ade80;
  }

  .detail-value.status.pending {
    color: #fbbf24;
  }

  .slider-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
    margin-bottom: 6px;
  }

  .slider-label {
    color: rgba(255, 255, 255, 0.6);
  }

  .slider-value {
    color: #60a5fa;
    font-weight: 600;
    font-family: "SF Mono", "JetBrains Mono", monospace;
    font-size: 14px;
  }

  .slider {
    width: 100%;
    height: 48px;
    background: transparent;
    appearance: none;
    cursor: pointer;
    margin-bottom: 8px;
    position: relative;
  }

  .slider::-webkit-slider-runnable-track {
    height: 6px;
    background: linear-gradient(90deg, rgba(96, 165, 250, 0.3) 0%, rgba(255, 255, 255, 0.1) 100%);
    border-radius: 3px;
  }

  .slider::-webkit-slider-thumb {
    appearance: none;
    width: 24px;
    height: 24px;
    background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
    border-radius: 50%;
    cursor: pointer;
    margin-top: -9px;
    box-shadow: 0 0 12px rgba(96, 165, 250, 0.5);
  }

  .slider::-moz-range-track {
    height: 6px;
    background: linear-gradient(90deg, rgba(96, 165, 250, 0.3) 0%, rgba(255, 255, 255, 0.1) 100%);
    border-radius: 3px;
  }

  .slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
    background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 0 12px rgba(96, 165, 250, 0.5);
  }

  .hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    text-align: center;
    padding: 10px 0 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  /* Focus state */
  .slider:focus-visible {
    outline: 2px solid #60a5fa;
    outline-offset: 2px;
    border-radius: 4px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .slider::-webkit-slider-thumb,
    .slider::-moz-range-thumb {
      box-shadow: none;
    }
  }
</style>
