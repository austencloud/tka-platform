<script lang="ts">
  import { flyFade } from "$lib/shared/transitions/motion";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import type { SpinnerStats } from "$lib/shared/landing/domain/types";
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

<aside class="debug-panel themed-scrollbar" in:flyFade={{ y: 20, duration: 200 }}>
  <div class="debug-section">
    <h3>Sequence Chain</h3>
    <div class="history-list themed-scrollbar">
      {#each sequenceHistory as entry, i}
        <div class="history-item" class:current={i === 0}>
          {simplifyRepeatedWord(entry.word ?? entry.sequence.word ?? "") ||
            "Generated"}
        </div>
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
      type="button"
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
    bottom: 5rem;
    right: 1.25rem;
    width: 20rem;
    max-height: 60vh;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(10, 10, 20, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 0.875rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.4);
  }

  .debug-section h3 {
    margin: 0 0 0.5rem;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 9.375rem;
    overflow-y: auto;
  }

  .history-item {
    font-size: 0.75rem;
    font-family: monospace;
    padding: 0.375rem 0.625rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 0.375rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .history-item.current {
    background: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 15%,
      transparent
    );
    color: var(--semantic-success, #22c55e);
  }

  .debug-stats {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
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
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.8);
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.5rem 0.625rem;
    box-sizing: border-box;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 0.5rem;
    font-size: var(--font-size-min, 0.875rem);
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    width: 100%;
    text-align: left;
  }

  .toggle-row:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: rgba(255, 255, 255, 0.9);
  }

  .toggle-row:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
    border-radius: 0.25rem;
  }

  .toggle-indicator {
    width: 2rem;
    height: 1.125rem;
    border-radius: 0.5625rem;
    background: rgba(255, 255, 255, 0.15);
    position: relative;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .toggle-indicator::after {
    content: "";
    position: absolute;
    top: 0.125rem;
    left: 0.125rem;
    width: 0.875rem;
    height: 0.875rem;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.6);
    transition: transform 0.15s;
  }

  .toggle-indicator.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 60%, transparent);
  }

  .toggle-indicator.active::after {
    transform: translateX(0.875rem);
    background: #fff;
  }

  @media (max-width: 600px) {
    .debug-panel {
      width: calc(100vw - 2rem);
      left: 1rem;
      right: 1rem;
    }
  }

</style>
