<!--
  LiveModeInfo.svelte

  Displays information about the current live broadcast sequence.
  Shows LOOP type, slice size, sequence number, and viewer count.
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { BroadcastStateClient } from "$lib/shared/landing/domain/broadcast-models";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";

  let {
    broadcastState,
    serverTimeOffset = 0,
  }: {
    broadcastState: BroadcastStateClient | null;
    serverTimeOffset?: number;
  } = $props();

  // Format LOOP type for display
  function formatLoopType(loopType: string): string {
    return loopType
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace("Strict ", "");
  }

  // Format period
  function formatPeriod(period: string): string {
    return period.toLowerCase();
  }
</script>

<div class="live-info">
  {#if broadcastState}
    <div class="live-indicator">
      <span class="live-dot"></span>
      <span class="live-label">LIVE</span>
    </div>

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
        {t('landing_live_steps', { count: broadcastState.currentSequence.totalSteps })}
      </span>
    </div>

    <div class="sequence-number">
      {t('landing_live_sequence_number', { number: broadcastState.sequenceNumber })}
    </div>
  {:else}
    <div class="connecting">
      <ProgressRing percent={-1} size={24} strokeWidth={2} />
      <span>{t('landing_live_connecting')}</span>
    </div>
  {/if}
</div>

<style>
  .live-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
  }

  .live-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    background: color-mix(in srgb, var(--color-status-live, #ef4444) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-status-live, #ef4444) 30%, transparent);
    border-radius: 20px;
    padding: 6px 14px;
  }

  .live-dot {
    width: 8px;
    height: 8px;
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
    gap: 8px;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .loop-type {
    font-weight: 600;
    color: #fff;
  }

  .separator {
    color: rgba(255, 255, 255, 0.3);
  }

  .sequence-number {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
  }

  .connecting {
    display: flex;
    align-items: center;
    gap: 12px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.875rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .live-dot {
      animation: none;
    }
  }
</style>
