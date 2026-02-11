<!--
  ArenaPersonalStats.svelte - Voter's personal stats

  Shows total votes and first vote date.
  Auth-gated: only shown when signed in.
-->
<script lang="ts">
  import type { ArenaUserStats } from "../../domain/models/arena-models";

  let { stats }: { stats: ArenaUserStats | null } = $props();
</script>

{#if stats && stats.totalVotes > 0}
  <div class="personal-stats">
    <div class="stat-item">
      <span class="stat-value">{stats.totalVotes}</span>
      <span class="stat-label">votes cast</span>
    </div>
    {#if stats.firstVoteDate}
      <div class="stat-item">
        <span class="stat-value">
          {stats.firstVoteDate.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <span class="stat-label">first vote</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .personal-stats {
    display: flex;
    gap: 24px;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-value {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
  }

  .stat-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }
</style>
