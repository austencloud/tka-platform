<script lang="ts">
  /**
   * StatsTab - Condensed debug panel stats
   *
   * Compact horizontal layout with expandable details
   * 48px touch targets maintained for accessibility
   */
  import CopyForAIButton from "$lib/shared/foundation/ui/CopyForAIButton.svelte";

  interface ChunkStats {
    loaded: number;
    pending: number;
    loading: number;
  }

  interface VegetationStats {
    trees: number;
    rocks: number;
    bushes: number;
    grass: number;
  }

  interface Props {
    fps: number;
    chunkStats: ChunkStats;
    vegetationStats: VegetationStats;
    colliderCount: number;
    position: { x: number; y: number; z: number };
    biome: string;
    seed: string;
    fogEnabled: boolean;
    waterVisible: boolean;
  }

  let {
    fps,
    chunkStats,
    vegetationStats,
    colliderCount,
    position,
    biome,
    seed,
    fogEnabled,
    waterVisible,
  }: Props = $props();

  let showDetails = $state(false);

  const totalVegetation = $derived(
    vegetationStats.trees + vegetationStats.rocks + vegetationStats.bushes + vegetationStats.grass
  );

  function formatCoord(val: number): string {
    return val.toFixed(1);
  }

  function getDebugDataForAI(): string {
    return `Realm Debug State:
- Position: (${formatCoord(position.x)}, ${formatCoord(position.y)}, ${formatCoord(position.z)})
- Biome: ${biome}
- Fog: ${fogEnabled ? "enabled" : "disabled"}
- Water: ${waterVisible ? "visible" : "hidden"}
- Chunks: ${chunkStats.loaded} loaded, ${chunkStats.loading} loading, ${chunkStats.pending} pending
- Vegetation: ${totalVegetation} total (${vegetationStats.trees} trees, ${vegetationStats.rocks} rocks, ${vegetationStats.bushes} bushes, ${vegetationStats.grass} grass)
- Colliders: ${colliderCount}
- FPS: ${fps}
- Seed: ${seed}`;
  }

  async function copyPosition() {
    const text = `(${formatCoord(position.x)}, ${formatCoord(position.y)}, ${formatCoord(position.z)})`;
    await navigator.clipboard.writeText(text);
  }

  async function copySeed() {
    await navigator.clipboard.writeText(seed);
  }
</script>

<div class="tab-content">
  <!-- Compact Stats Row -->
  <div class="stats-row">
    <div class="stat-item">
      <i class="fas fa-cube" aria-hidden="true"></i>
      <span class="stat-value">{chunkStats.loaded}</span>
      <span class="stat-label">chunks</span>
    </div>
    <div class="stat-item">
      <i class="fas fa-tree" aria-hidden="true"></i>
      <span class="stat-value">{totalVegetation.toLocaleString()}</span>
      <span class="stat-label">veg</span>
    </div>
    <div class="stat-item">
      <i class="fas fa-shapes" aria-hidden="true"></i>
      <span class="stat-value">{colliderCount}</span>
      <span class="stat-label">colliders</span>
    </div>
  </div>

  <!-- Position Row -->
  <div class="position-row">
    <button class="position-display" onclick={copyPosition} title="Copy position">
      <span class="coord"><span class="coord-label">X</span>{formatCoord(position.x)}</span>
      <span class="coord"><span class="coord-label">Y</span>{formatCoord(position.y)}</span>
      <span class="coord"><span class="coord-label">Z</span>{formatCoord(position.z)}</span>
      <i class="fas fa-copy copy-icon" aria-hidden="true"></i>
    </button>
    <div class="biome-badge" title="Current biome">
      <i class="fas fa-globe" aria-hidden="true"></i>
      {biome}
    </div>
  </div>

  <!-- Expandable Details -->
  <button class="details-toggle" onclick={() => (showDetails = !showDetails)}>
    <span>Details</span>
    <i class="fas fa-chevron-{showDetails ? 'up' : 'down'}" aria-hidden="true"></i>
  </button>

  {#if showDetails}
    <div class="details-panel">
      <div class="details-grid">
        <div class="detail-col">
          <div class="detail-header">Chunks</div>
          <div class="detail-item">
            <span>Loaded</span>
            <span class="val">{chunkStats.loaded}</span>
          </div>
          <div class="detail-item">
            <span>Loading</span>
            <span class="val" class:loading={chunkStats.loading > 0}>{chunkStats.loading}</span>
          </div>
          <div class="detail-item">
            <span>Pending</span>
            <span class="val">{chunkStats.pending}</span>
          </div>
        </div>
        <div class="detail-col">
          <div class="detail-header">Vegetation</div>
          <div class="detail-item">
            <span>Trees</span>
            <span class="val">{vegetationStats.trees.toLocaleString()}</span>
          </div>
          <div class="detail-item">
            <span>Rocks</span>
            <span class="val">{vegetationStats.rocks.toLocaleString()}</span>
          </div>
          <div class="detail-item">
            <span>Bushes</span>
            <span class="val">{vegetationStats.bushes.toLocaleString()}</span>
          </div>
          <div class="detail-item">
            <span>Grass</span>
            <span class="val">{vegetationStats.grass.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div class="seed-row">
        <span class="seed-label">Seed</span>
        <button class="seed-copy" onclick={copySeed} title="Copy seed">
          {seed}
          <i class="fas fa-copy" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  {/if}

  <!-- Copy for AI -->
  <CopyForAIButton
    getData={getDebugDataForAI}
    variant="icon-text"
    size="sm"
    fullWidth
    labels={{ idle: "Copy for AI", success: "Copied!" }}
  />
</div>

<style>
  .tab-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Compact Stats Row */
  .stats-row {
    display: flex;
    gap: 8px;
  }

  .stat-item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
  }

  .stat-item i {
    font-size: 12px;
    color: #60a5fa;
  }

  .stat-value {
    font-family: "SF Mono", "JetBrains Mono", monospace;
    font-size: 14px;
    font-weight: 600;
    color: white;
  }

  .stat-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  /* Position Row */
  .position-row {
    display: flex;
    gap: 8px;
  }

  .position-display {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 12px;
    min-height: 48px;
    background: rgba(96, 165, 250, 0.1);
    border: 1px solid rgba(96, 165, 250, 0.2);
    border-radius: 10px;
    color: #93c5fd;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .position-display:hover {
    background: rgba(96, 165, 250, 0.15);
    border-color: rgba(96, 165, 250, 0.3);
  }

  .coord {
    display: flex;
    align-items: baseline;
    gap: 2px;
    font-family: "SF Mono", "JetBrains Mono", monospace;
    font-size: 13px;
    font-weight: 500;
  }

  .coord-label {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 600;
  }

  .copy-icon {
    margin-left: auto;
    font-size: 12px;
    opacity: 0.6;
  }

  .biome-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 14px;
    min-height: 48px;
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.2);
    border-radius: 10px;
    color: #86efac;
    font-size: 13px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .biome-badge i {
    font-size: 12px;
    opacity: 0.8;
  }

  /* Details Toggle */
  .details-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0;
    min-height: 48px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .details-toggle:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.9);
  }

  .details-toggle i {
    font-size: 10px;
  }

  /* Expanded Details */
  .details-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
  }

  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .detail-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .detail-header {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
  }

  .detail-item .val {
    color: white;
    font-weight: 500;
  }

  .detail-item .val.loading {
    color: #fbbf24;
  }

  .seed-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .seed-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 600;
    text-transform: uppercase;
  }

  .seed-copy {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 6px;
    color: #fcd34d;
    font-family: "SF Mono", "JetBrains Mono", monospace;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .seed-copy:hover {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.3);
  }

  .seed-copy i {
    font-size: 10px;
    opacity: 0.7;
  }

  /* Focus states */
  .position-display:focus-visible,
  .details-toggle:focus-visible,
  .seed-copy:focus-visible {
    outline: 2px solid #60a5fa;
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .position-display,
    .details-toggle,
    .seed-copy {
      transition: none;
    }
  }
</style>
