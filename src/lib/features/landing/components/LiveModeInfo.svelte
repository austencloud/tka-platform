<!--
  LiveModeInfo.svelte

  Displays information about the current live broadcast sequence.
  Shows LOOP type, slice size, sequence number, and viewer count.
-->
<script lang="ts">
  import type { BroadcastStateClient } from "../domain/models/broadcast-models";

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

  // Format slice size
  function formatSliceSize(sliceSize: string): string {
    return sliceSize.toLowerCase();
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
      <span class="slice-size">
        {formatSliceSize(broadcastState.currentSequence.sliceSize)}
      </span>
      <span class="separator">·</span>
      <span class="beat-count">
        {broadcastState.currentSequence.totalBeats} beats
      </span>
    </div>

    <div class="sequence-number">
      Sequence #{broadcastState.sequenceNumber}
    </div>
  {:else}
    <div class="connecting">
      <div class="connecting-spinner"></div>
      <span>Connecting to live broadcast...</span>
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
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 20px;
    padding: 6px 14px;
  }

  .live-dot {
    width: 8px;
    height: 8px;
    background: #ef4444;
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
    color: #ef4444;
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

  .connecting-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: #ef4444;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .live-dot,
    .connecting-spinner {
      animation: none;
    }
  }
</style>
