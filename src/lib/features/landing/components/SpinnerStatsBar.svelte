<!--
  SpinnerStatsBar.svelte

  Displays statistics that adapt based on the current spinner mode.
  - Library mode: transitions, unique sequences, in session
  - Infinite mode: total generated globally, this session
-->
<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type {
    SpinnerMode,
    SpinnerMetrics,
  } from "../domain/models/spinner-models";
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
  <Crossfade key={mode} duration={DURATION.fast}>
    <div class="stats-content">
      {#if mode === "library"}
        <!-- Library mode stats -->
        <div class="stat">
          <span class="stat-value">{transitionCount}</span>
          <span class="stat-label">{t("landing_stats_transitions")}</span>
        </div>
        <div class="stat">
          <span class="stat-value"
            >{libraryStats?.uniqueSequencesUsed ?? 0}</span
          >
          <span class="stat-label">{t("landing_stats_unique")}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{libraryStats?.sequencesPlayed ?? 0}</span>
          <span class="stat-label">{t("landing_stats_in_session")}</span>
        </div>
      {:else if mode === "infinite"}
        <!-- Infinite mode stats -->
        <div class="stat highlight">
          <span class="stat-value"
            >{formatNumber(globalMetrics?.totalGenerated ?? 0)}</span
          >
          <span class="stat-label">{t("landing_stats_ever_generated")}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{sessionGeneratedCount}</span>
          <span class="stat-label">{t("landing_stats_this_session")}</span>
        </div>
      {/if}
    </div>
  </Crossfade>
</div>

<style>
  .stats-bar {
    display: flex;
    justify-content: center;
    width: 100%;
    min-width: 0;
    min-height: 4.5rem;
    padding: 0.875rem clamp(1rem, 2vw, 2rem);
    box-sizing: border-box;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.07));
    border-radius: 0.875rem;
  }

  .stats-content {
    display: flex;
    justify-content: space-around;
    gap: clamp(1rem, 3vw, 3rem);
    width: 100%;
  }

  .stats-bar :global(.crossfade) {
    width: 100%;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 600;
    font-family: monospace;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text, #fff);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
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
      min-height: 4rem;
      padding: 0.75rem;
    }

    .stats-content {
      gap: 0.75rem;
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

  @media (min-width: 700px) and (max-height: 600px) {
    .stats-bar {
      min-height: 3.5rem;
      padding: 0.5rem 1rem;
    }

    .stat {
      gap: 0.125rem;
    }

    .stat-value,
    .stat.highlight .stat-value {
      font-size: 1rem;
    }

    .stat-label {
      font-size: var(--font-size-compact, 0.75rem);
    }
  }

</style>
