<script lang="ts">
  import type { TreeType } from "$lib/shared/background/firefly-forest/services/TreeSilhouetteSystem";
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";
  import ChipGroup from "$lib/shared/components/selection/ChipGroup.svelte";

  interface FeedbackStats {
    approved: number;
    rejected: number;
  }

  interface Props {
    treeTypes: TreeType[];
    selectedType: TreeType;
    feedbackStats: FeedbackStats;
    onTypeChange: (type: TreeType) => void;
    onGenerateNewSet: () => void;
  }

  let {
    treeTypes,
    selectedType,
    feedbackStats,
    onTypeChange,
    onGenerateNewSet,
  }: Props = $props();
</script>

<ChipGroup label="Tree Type" variant="row">
  {#each treeTypes as type}
    <ChipToggle
      label={type.charAt(0).toUpperCase() + type.slice(1)}
      active={selectedType === type}
      color="lime"
      onclick={() => onTypeChange(type)}
    />
  {/each}
</ChipGroup>

{#if selectedType !== "spruce"}
  <button class="action-btn" onclick={onGenerateNewSet}>
    <i class="fas fa-rotate"></i>
    Generate New Set
  </button>

  <div class="stats-section">
    <span class="label">Feedback Stats for {selectedType}</span>
    <div class="stats-grid">
      <div class="stat approved">
        <span class="stat-value">{feedbackStats.approved}</span>
        <span class="stat-label">Approved</span>
      </div>
      <div class="stat rejected">
        <span class="stat-value">{feedbackStats.rejected}</span>
        <span class="stat-label">Rejected</span>
      </div>
    </div>
  </div>

  <div class="legend">
    <span class="legend-item pending"><i class="fas fa-circle"></i> Pending</span>
    <span class="legend-item approved"><i class="fas fa-check-circle"></i> Approved</span>
    <span class="legend-item rejected"><i class="fas fa-times-circle"></i> Rejected</span>
  </div>

  <p class="hint">Click trees to cycle: Pending -> Approved -> Rejected</p>
{/if}

<style>
  .label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #84cc16, #65a30d);
    border: none;
    border-radius: 12px;
    color: #ffffff;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(132, 204, 22, 0.35);
  }

  .action-btn:active { transform: translateY(0); }

  .stats-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 600;
    color: #bef264;
  }

  .stat-label {
    font-size: 0.7rem;
    color: #6b7280;
    text-transform: uppercase;
  }

  .stat.approved { background: rgba(34, 197, 94, 0.1); }
  .stat.approved .stat-value { color: #22c55e; }
  .stat.rejected { background: rgba(239, 68, 68, 0.1); }
  .stat.rejected .stat-value { color: #ef4444; }

  .legend {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
  }

  .legend-item.pending { color: #6b7280; }
  .legend-item.approved { color: #22c55e; }
  .legend-item.rejected { color: #ef4444; }

  .hint {
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0;
  }
</style>
