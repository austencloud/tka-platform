<!--
  ReplayTransport.svelte - Replay controls + re-record timing button.
  Visible only when timing data exists.
-->
<script lang="ts">
  import type { AssembleState } from "../state/assemble-state.svelte";
  import type { TimingState } from "../state/timing-state.svelte";

  let {
    builderState,
    timingState,
    onReplay,
    onReRecord,
  }: {
    builderState: AssembleState;
    timingState: TimingState;
    onReplay: () => void;
    onReRecord: () => void;
  } = $props();

  const isComplete = $derived(builderState.phase === "complete");
  const canReplay = $derived(timingState.hasTimingData && isComplete);
  const canReRecord = $derived(
    (builderState.blueSteps.length > 0 || builderState.redSteps.length > 0) &&
    !timingState.isReRecording
  );
</script>

{#if timingState.hasTimingData || canReRecord}
  <div class="transport" aria-label="Replay controls">
    <button
      class="transport-btn play"
      disabled={!canReplay}
      aria-label="Replay sequence with timing"
      onclick={onReplay}
    >
      <i class="fas fa-play" aria-hidden="true"></i>
      <span>Replay</span>
    </button>

    <button
      class="transport-btn re-record"
      disabled={!canReRecord}
      aria-label="Re-record timing for existing positions"
      onclick={onReRecord}
    >
      <i class="fas fa-circle" aria-hidden="true"></i>
      <span>Re-record</span>
    </button>

    {#if timingState.hasTimingData}
      <button
        class="transport-btn clear"
        aria-label="Clear timing data"
        onclick={() => timingState.clearTiming()}
      >
        <i class="fas fa-xmark" aria-hidden="true"></i>
      </button>
    {/if}
  </div>
{/if}

<style>
  .transport {
    display: flex;
    gap: 6px;
    align-items: center;
    justify-content: center;
    padding: 6px 0;
  }

  .transport-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .transport-btn:hover:not(:disabled) {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #fff);
  }

  .transport-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .transport-btn.play i {
    color: var(--theme-success, #22c55e);
    font-size: 10px;
  }

  .transport-btn.re-record i {
    color: var(--prop-red, #ed1c24);
    font-size: 10px;
  }

  .transport-btn.clear {
    padding: 8px 10px;
  }

  .transport-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    .transport {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .transport-btn {
      transition: none;
    }
  }
</style>
