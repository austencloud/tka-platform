<script lang="ts">
  import { fly } from "svelte/transition";
  import type { SpinnerStats } from '$lib/features/landing/services/contracts/types';
  import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { SequenceHistoryEntry } from "./SequenceHistoryPanel.svelte";

  interface Props {
    sequenceHistory: SequenceHistoryEntry[];
    stats: SpinnerStats;
    gridMode: GridMode | null;
    isChainingEnabled: boolean;
  }

  let {
    sequenceHistory,
    stats,
    gridMode,
    isChainingEnabled = $bindable(),
  }: Props = $props();
</script>

<aside class="debug-panel" in:fly={{ y: 20, duration: 200 }}>
  <div class="debug-section">
    <h3>Sequence Chain</h3>
    <div class="history-list">
      {#each sequenceHistory as entry, i}
        <div class="history-item" class:current={i === 0}>{entry.sequence.word || "Generated"}</div>
      {/each}
    </div>
  </div>

  <div class="debug-section">
    <h3>Statistics</h3>
    <div class="debug-stats">
      <div class="debug-stat">
        <span>Played:</span>
        <span>{stats.sequencesPlayed}</span>
      </div>
      <div class="debug-stat">
        <span>Direct matches:</span>
        <span>{stats.directMatches}</span>
      </div>
      <div class="debug-stat">
        <span>Rotated:</span>
        <span>{stats.rotatedMatches}</span>
      </div>
      <div class="debug-stat">
        <span>Grid mode:</span>
        <span>{gridMode ?? "-"}</span>
      </div>
    </div>
  </div>

  <div class="debug-section">
    <h3>Controls</h3>
    <label class="toggle-row">
      <input type="checkbox" bind:checked={isChainingEnabled} />
      <span>Auto-chain sequences</span>
    </label>
  </div>
</aside>

<style>
  .debug-panel {
    position: fixed;
    bottom: 60px;
    right: 20px;
    width: 300px;
    max-height: 60vh;
    overflow-y: auto;
    background: rgba(10, 10, 20, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    backdrop-filter: blur(20px);
  }

  .debug-section h3 {
    margin: 0 0 8px;
    font-size: 0.7rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 150px;
    overflow-y: auto;
  }

  .history-item {
    font-size: 0.75rem;
    font-family: monospace;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.5);
  }

  .history-item.current {
    background: rgba(80, 200, 120, 0.15);
    color: #50c878;
  }

  .debug-stats {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .debug-stat {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
  }

  .debug-stat span:first-child {
    color: rgba(255, 255, 255, 0.4);
  }

  .debug-stat span:last-child {
    font-family: monospace;
    color: rgba(255, 255, 255, 0.8);
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
  }

  .toggle-row input {
    accent-color: #6366f1;
  }

  @media (max-width: 600px) {
    .debug-panel {
      width: calc(100vw - 40px);
      left: 20px;
      right: 20px;
    }
  }
</style>
