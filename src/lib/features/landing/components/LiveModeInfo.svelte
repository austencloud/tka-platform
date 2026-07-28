<!--
  LiveModeInfo.svelte

  Displays information about the current live broadcast sequence.
  Shows LOOP type, slice size, and sequence number.
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { BroadcastStateClient } from "$lib/shared/landing/domain/broadcast-models";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";

  let {
    broadcastState,
  }: {
    broadcastState: BroadcastStateClient | null;
  } = $props();

  // A live payload can arrive partially formed (the converter has failed on
  // real broadcasts), so the formatters must not crash the page over a
  // missing field — they render blanks and the indicator still shows LIVE.
  function formatLoopType(loopType: string | undefined | null): string {
    return (loopType ?? "")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace("Strict ", "");
  }

  function formatPeriod(period: string | undefined | null): string {
    return (period ?? "").toLowerCase();
  }
</script>

<div class="live-info">
  {#if broadcastState}
    <div class="live-indicator">
      <span class="live-dot"></span>
      <span class="live-label">{t("landing_spinner_live_label")}</span>
    </div>

    {#if broadcastState.currentSequence}
      <div class="sequence-info">
        <span class="loop-type">
          {formatLoopType(broadcastState.currentSequence.loopType)}
        </span>
        <span class="separator">·</span>
        <span class="period">
          {formatPeriod(broadcastState.currentSequence.period)}
        </span>
        <span class="separator">·</span>
        <span class="step-count">
          {t("landing_live_steps", {
            count: broadcastState.currentSequence.totalSteps ?? 0,
          })}
        </span>
      </div>
    {/if}

    <div class="sequence-number">
      {t("landing_live_sequence_number", {
        number: broadcastState.sequenceNumber,
      })}
    </div>
  {:else}
    <div class="connecting">
      <ProgressRing percent={-1} size={24} strokeWidth={2} />
      <span>{t("landing_live_connecting")}</span>
    </div>
  {/if}
</div>

<style>
  /* No own padding: the route's fixed-height mode-info stage owns spacing. */
  .live-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .live-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: color-mix(
      in srgb,
      var(--color-status-live, #ef4444) 15%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--color-status-live, #ef4444) 30%, transparent);
    border-radius: 1.25rem;
    padding: 0.375rem 0.875rem;
  }

  .live-dot {
    width: 0.5rem;
    height: 0.5rem;
    background: var(--color-status-live, #ef4444);
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.2);
    }
  }

  .live-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-status-live, #ef4444);
    letter-spacing: 0.1em;
  }

  .sequence-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .loop-type {
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .separator {
    color: var(--theme-text-tertiary, rgba(255, 255, 255, 0.3));
  }

  .sequence-number {
    font-size: 0.75rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .connecting {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.875rem;
  }

  @media (min-width: 700px) and (max-height: 600px) {
    .live-info {
      flex-direction: row;
      justify-content: center;
      gap: 0.75rem;
    }

    .live-indicator {
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .live-dot {
      animation: none;
    }
  }
</style>
