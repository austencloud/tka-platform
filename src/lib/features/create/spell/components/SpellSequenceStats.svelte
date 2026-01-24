<!--
SpellSequenceStats.svelte - Compact stats bar for generated sequences

Shows key metrics:
- Prop reversals count
- Dash motion count
- Hand path changes count

Designed to be minimal and informative without being intrusive.
-->
<script lang="ts">
  import type { SequenceStats } from "../domain/models/spell-models";

  let {
    stats,
  }: {
    stats: SequenceStats | null;
  } = $props();
</script>

{#if stats && stats.totalSteps > 0}
  <div class="stats-bar">
    <div class="stat" title="Prop reversals: prop changes rotation direction">
      <i class="fas fa-sync-alt" aria-hidden="true"></i>
      <span class="stat-value">{stats.propReversals}</span>
      <span class="stat-label">prop rev</span>
    </div>

    <div class="stat" title="Dashes: hand moves to opposite grid point">
      <i class="fas fa-arrows-alt-h" aria-hidden="true"></i>
      <span class="stat-value">{stats.dashCount}</span>
      <span class="stat-label">dashes</span>
    </div>

    <div class="stat" title="Hand reversals: hand changes travel direction around the grid">
      <i class="fas fa-route" aria-hidden="true"></i>
      <span class="stat-value">{stats.handPathChanges}</span>
      <span class="stat-label">hand rev</span>
    </div>
  </div>
{/if}

<style>
  .stats-bar {
    display: flex;
    justify-content: center;
    gap: 16px;
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 12px;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
  }

  .stat i {
    font-size: 12px;
    opacity: 0.7;
  }

  .stat-value {
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-min, 14px);
  }

  .stat-label {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  /* Responsive: stack on very narrow screens */
  @container spell-panel (max-width: 320px) {
    .stats-bar {
      flex-direction: column;
      gap: 8px;
      align-items: flex-start;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .stats-bar {
      transition: none;
    }
  }
</style>
