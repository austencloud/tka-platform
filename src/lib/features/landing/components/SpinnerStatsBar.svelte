<!--
  SpinnerStatsBar.svelte

  Displays statistics that adapt based on the current spinner mode.
  - Library mode: transitions, unique sequences, in session
  - Infinite mode: total generated globally, this session
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { SpinnerMode, SpinnerMetrics } from "../domain/models/spinner-models";
  import type { SpinnerStats } from "$lib/shared/landing/domain/types";

  let {
    mode,
    libraryStats,
    transitionCount = 0,
    globalMetrics,
    sessionGeneratedCount = 0,
  }: {
    mode: SpinnerMode;
    libraryStats?: SpinnerStats;
    transitionCount?: number;
    globalMetrics?: SpinnerMetrics | null;
    sessionGeneratedCount?: number;
  } = $props();

  // Format large numbers with commas
  function formatNumber(num: number): string {
    return num.toLocaleString();
  }
</script>

<div class="stats-bar">
  {#key mode}
    <div class="stats-content" in:fade={{ duration: 150 }} out:fade={{ duration: 100 }}>
      {#if mode === "library"}
        <!-- Library mode stats -->
        <div class="stat">
          <span class="stat-value">{transitionCount}</span>
          <span class="stat-label">{t('landing_stats_transitions')}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{libraryStats?.uniqueSequencesUsed ?? 0}</span>
          <span class="stat-label">{t('landing_stats_unique')}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{libraryStats?.sequencesPlayed ?? 0}</span>
          <span class="stat-label">{t('landing_stats_in_session')}</span>
        </div>
      {:else}
        <!-- Infinite mode stats -->
        <div class="stat highlight">
          <span class="stat-value">{formatNumber(globalMetrics?.totalGenerated ?? 0)}</span>
          <span class="stat-label">{t('landing_stats_ever_generated')}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{sessionGeneratedCount}</span>
          <span class="stat-label">{t('landing_stats_this_session')}</span>
        </div>
      {/if}
    </div>
  {/key}
</div>

<style>
  .stats-bar {
    display: flex;
    justify-content: center;
    padding: 16px 32px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    min-height: 72px;
  }

  .stats-content {
    display: flex;
    gap: 32px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 600;
    font-family: monospace;
    color: #fff;
  }

  .stat-label {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Highlight for the global counter — brand accent gradient */
  .stat.highlight .stat-value {
    background: linear-gradient(
      135deg,
      var(--theme-accent, #6366f1),
      var(--theme-accent-strong, #8b5cf6)
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-size: 1.5rem;
  }

  .stat.highlight .stat-label {
    color: color-mix(in srgb, var(--theme-accent, #6366f1) 70%, transparent);
  }

  @media (max-width: 600px) {
    .stats-bar {
      padding: 12px 20px;
    }

    .stats-content {
      gap: 20px;
    }

    .stat-value {
      font-size: 1.125rem;
    }

    .stat.highlight .stat-value {
      font-size: 1.25rem;
    }

    .stat-label {
      font-size: var(--font-size-compact, 12px);
    }
  }
</style>
