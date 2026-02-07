<script lang="ts">
  /**
   * VegetationTab - Debug panel tab for vegetation controls
   *
   * Controls: Tree, grass, rock, bush visibility and counts
   */
  import { ChipToggle } from '@austencloud/chip-toggle';

  interface VegetationStats {
    trees: number;
    rocks: number;
    bushes: number;
    grass: number;
  }

  interface Props {
    vegetationStats: VegetationStats;
    treesEnabled: boolean;
    grassEnabled: boolean;
    rocksEnabled: boolean;
    bushesEnabled: boolean;
    onToggleTrees: () => void;
    onToggleGrass: () => void;
    onToggleRocks: () => void;
    onToggleBushes: () => void;
  }

  let {
    vegetationStats,
    treesEnabled,
    grassEnabled,
    rocksEnabled,
    bushesEnabled,
    onToggleTrees,
    onToggleGrass,
    onToggleRocks,
    onToggleBushes,
  }: Props = $props();

  const totalVegetation = $derived(
    vegetationStats.trees + vegetationStats.rocks + vegetationStats.bushes + vegetationStats.grass
  );
</script>

<div class="tab-content">
  <div class="toggle-row">
    <ChipToggle
      label="Trees"
      icon="fa-tree"
      active={treesEnabled}
      color="lime"
      size="sm"
      onclick={onToggleTrees}
    />
    <ChipToggle
      label="Grass"
      icon="fa-seedling"
      active={grassEnabled}
      color="lime"
      size="sm"
      onclick={onToggleGrass}
    />
    <ChipToggle
      label="Rocks"
      icon="fa-gem"
      active={rocksEnabled}
      color="gray"
      size="sm"
      onclick={onToggleRocks}
    />
    <ChipToggle
      label="Bushes"
      icon="fa-leaf"
      active={bushesEnabled}
      color="cyan"
      size="sm"
      onclick={onToggleBushes}
    />
  </div>

  <div class="details-section">
    <div class="detail-group">
      <div class="detail-title">
        <i class="fas fa-tree" style="color: #22c55e" aria-hidden="true"></i>
        Instance Counts
      </div>
      <div class="detail-row">
        <span class="detail-label">
          <i class="fas fa-tree icon-inline" aria-hidden="true"></i>
          Trees
        </span>
        <span class="detail-value" class:disabled={!treesEnabled}>
          {vegetationStats.trees.toLocaleString()}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">
          <i class="fas fa-seedling icon-inline" aria-hidden="true"></i>
          Grass
        </span>
        <span class="detail-value" class:disabled={!grassEnabled}>
          {vegetationStats.grass.toLocaleString()}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">
          <i class="fas fa-gem icon-inline" aria-hidden="true"></i>
          Rocks
        </span>
        <span class="detail-value" class:disabled={!rocksEnabled}>
          {vegetationStats.rocks.toLocaleString()}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">
          <i class="fas fa-leaf icon-inline" aria-hidden="true"></i>
          Bushes
        </span>
        <span class="detail-value" class:disabled={!bushesEnabled}>
          {vegetationStats.bushes.toLocaleString()}
        </span>
      </div>
      <div class="detail-row total">
        <span class="detail-label">Total</span>
        <span class="detail-value highlight">{totalVegetation.toLocaleString()}</span>
      </div>
    </div>
  </div>

  <div class="hint">
    Toggle types to reduce GPU load
  </div>
</div>

<style>
  .tab-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .toggle-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
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

  .detail-row.total {
    margin-top: 8px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .detail-label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.6);
  }

  .icon-inline {
    font-size: 12px;
    width: 16px;
    text-align: center;
    opacity: 0.8;
  }

  .detail-value {
    color: white;
    font-weight: 600;
  }

  .detail-value.disabled {
    color: rgba(255, 255, 255, 0.3);
    text-decoration: line-through;
  }

  .detail-value.highlight {
    color: #4ade80;
    text-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
  }

  .hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    text-align: center;
    padding: 10px 0 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
</style>
