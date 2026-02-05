<script lang="ts">
  import { fly } from "svelte/transition";

  interface UserRanks {
    xp: number | null;
    level: number | null;
    sequences: number | null;
    achievements: number | null;
    streak: number | null;
  }

  let {
    userRanks,
    hasRanks = false,
    isLoadingRanks = false,
  }: {
    userRanks: UserRanks;
    hasRanks?: boolean;
    isLoadingRanks?: boolean;
  } = $props();
</script>

{#if hasRanks}
  <div
    class="rankings-section"
    transition:fly={{ y: 20, duration: 300, delay: 150 }}
  >
    <h3 class="rankings-title">
      <i class="fas fa-chart-line" aria-hidden="true"></i>
      Rankings
    </h3>
    <div class="rankings-badges">
      {#if userRanks.xp !== null}
        <div class="rank-badge">
          <span class="rank-value">#{userRanks.xp}</span>
          <span class="rank-label">XP</span>
        </div>
      {/if}
      {#if userRanks.level !== null}
        <div class="rank-badge">
          <span class="rank-value">#{userRanks.level}</span>
          <span class="rank-label">Level</span>
        </div>
      {/if}
      {#if userRanks.sequences !== null}
        <div class="rank-badge">
          <span class="rank-value">#{userRanks.sequences}</span>
          <span class="rank-label">Sequences</span>
        </div>
      {/if}
      {#if userRanks.achievements !== null}
        <div class="rank-badge">
          <span class="rank-value">#{userRanks.achievements}</span>
          <span class="rank-label">Achievements</span>
        </div>
      {/if}
      {#if userRanks.streak !== null}
        <div class="rank-badge">
          <span class="rank-value">#{userRanks.streak}</span>
          <span class="rank-label">Streak</span>
        </div>
      {/if}
    </div>
  </div>
{:else if isLoadingRanks}
  <div
    class="rankings-section"
    transition:fly={{ y: 20, duration: 300, delay: 150 }}
  >
    <h3 class="rankings-title">
      <i class="fas fa-chart-line" aria-hidden="true"></i>
      Rankings
    </h3>
    <div class="rankings-loading">
      <span>Loading rankings...</span>
    </div>
  </div>
{/if}

<style>
  .rankings-section {
    container-type: inline-size;
    container-name: rankings;

    margin-bottom: 24px;
    text-align: center;
  }

  .rankings-title {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 0 0 12px 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .rankings-title i {
    font-size: var(--font-size-sm);
  }

  .rankings-badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }

  .rank-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    min-width: 72px;
    flex: 0 1 auto;
  }

  .rank-value {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--theme-text, white);
    line-height: 1.2;
  }

  .rank-label {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 2px;
  }

  .rankings-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }

  /* Narrow: compact badges */
  @container rankings (max-width: 400px) {
    .rankings-badges {
      gap: 8px;
    }

    .rank-badge {
      padding: 10px 12px;
      min-width: 64px;
    }

    .rank-value {
      font-size: var(--font-size-base);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rankings-section {
      transition: none;
    }
  }
</style>
