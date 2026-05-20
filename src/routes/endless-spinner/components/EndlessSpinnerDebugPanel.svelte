<script lang="ts">
  import { fly } from "svelte/transition";
  import type { SpinnerStats } from '$lib/shared/landing/domain/types';
  import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PlaybackHistoryEntry } from "$lib/shared/animation-engine/domain/chaining-types";

  interface Props {
    sequenceHistory: readonly PlaybackHistoryEntry[];
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
        <div class="history-item" class:current={i === 0}>{entry.word ?? entry.sequence.word ?? "Generated"}</div>
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
    <button
      class="toggle-row"
      aria-pressed={isChainingEnabled}
      onclick={() => (isChainingEnabled = !isChainingEnabled)}
    >
      <span class="toggle-indicator" class:active={isChainingEnabled}></span>
      <span>Auto-chain sequences</span>
    </button>
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
    background: none;
    border: none;
    padding: 6px 4px;
    width: 100%;
    text-align: left;
  }

  .toggle-row:hover {
    color: rgba(255, 255, 255, 0.9);
  }

  .toggle-row:focus-visible {
    outline: 2px solid #6366f1;
    outline-offset: 2px;
    border-radius: 4px;
  }

  .toggle-indicator {
    width: 32px;
    height: 18px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.15);
    position: relative;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .toggle-indicator::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.6);
    transition: transform 0.15s;
  }

  .toggle-indicator.active {
    background: rgba(99, 102, 241, 0.6);
  }

  .toggle-indicator.active::after {
    transform: translateX(14px);
    background: #fff;
  }

  @media (max-width: 600px) {
    .debug-panel {
      width: calc(100vw - 40px);
      left: 20px;
      right: 20px;
    }
  }
</style>
