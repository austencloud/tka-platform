<!--
  RampProgressIndicator.svelte

  Shows ramp training progress inline (desktop) or as a floating pill (mobile).

  Desktop: 60 BPM  |  Round 3/5  |  [====-----]  |  [Stop]
  Mobile:  60 BPM  Round 3/5  [Stop]  + progress bar below
-->
<script lang="ts">
  import type { TempoRampProgress } from "../services/contracts/ITempoRampOrchestrator";

  interface Props {
    progress: TempoRampProgress;
    onStop: () => void;
    variant?: "inline" | "floating";
  }

  let {
    progress,
    onStop,
    variant = "inline",
  }: Props = $props();

  // BPM intensity color
  let bpmColor = $derived.by(() => {
    const bpm = progress.currentBpm;
    if (bpm <= 30) return "var(--semantic-success, #22c55e)";
    if (bpm <= 75) return "var(--theme-accent, #8b5cf6)";
    if (bpm <= 120) return "var(--semantic-warning, #f59e0b)";
    return "var(--semantic-error, #ef4444)";
  });

  // Progress percentage within current level
  let levelProgress = $derived(
    (progress.currentRound / progress.roundsPerLevel) * 100
  );
</script>

<div
  class="ramp-progress"
  class:floating={variant === "floating"}
  role="status"
  aria-live="polite"
  aria-label="Ramp training progress: {progress.currentBpm} BPM, round {progress.currentRound} of {progress.roundsPerLevel}"
>
  <div class="ramp-info">
    <span class="ramp-bpm" style="color: {bpmColor}">
      {progress.currentBpm}
      <span class="ramp-bpm-label">BPM</span>
    </span>

    <span class="ramp-divider" aria-hidden="true"></span>

    <span class="ramp-round">
      Round {progress.currentRound}/{progress.roundsPerLevel}
    </span>

    {#if variant === "inline"}
      <span class="ramp-divider" aria-hidden="true"></span>

      <div
        class="ramp-bar"
        role="progressbar"
        aria-valuenow={levelProgress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          class="ramp-bar-fill"
          style="width: {levelProgress}%; background: {bpmColor}"
        ></div>
      </div>
    {/if}

    <button
      class="ramp-stop-btn"
      onclick={onStop}
      type="button"
      aria-label="Stop ramp training"
    >
      <i class="fas fa-stop" aria-hidden="true"></i>
      {#if variant === "inline"}
        <span>Stop</span>
      {/if}
    </button>
  </div>

  {#if variant === "floating"}
    <div
      class="ramp-bar floating-bar"
      role="progressbar"
      aria-valuenow={levelProgress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        class="ramp-bar-fill"
        style="width: {levelProgress}%; background: {bpmColor}"
      ></div>
    </div>
  {/if}
</div>

<style>
  .ramp-progress {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ramp-progress.floating {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    padding: 10px 16px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.95));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    min-width: 240px;
    z-index: 10;
    animation: ramp-slide-in 200ms cubic-bezier(0.32, 0.72, 0, 1);
  }

  @keyframes ramp-slide-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .ramp-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .ramp-bpm {
    font-size: 1.1rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    white-space: nowrap;
  }

  .ramp-bpm-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    opacity: 0.6;
    text-transform: uppercase;
    margin-left: 2px;
  }

  .ramp-divider {
    width: 1px;
    height: 20px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    flex-shrink: 0;
  }

  .ramp-round {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* ===========================
     PROGRESS BAR
     =========================== */

  .ramp-bar {
    flex: 1;
    min-width: 60px;
    height: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border-radius: 3px;
    overflow: hidden;
  }

  .ramp-bar.floating-bar {
    height: 4px;
    border-radius: 2px;
  }

  .ramp-bar-fill {
    height: 100%;
    border-radius: inherit;
    transition: width 300ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* ===========================
     STOP BUTTON
     =========================== */

  .ramp-stop-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 10px 16px;
    min-height: 48px;
    min-width: 48px;
    flex-shrink: 0;
    background: rgba(239, 68, 68, 0.12);
    border: 1.5px solid rgba(239, 68, 68, 0.3);
    border-radius: 10px;
    color: #f87171;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .ramp-stop-btn i {
    font-size: 12px;
  }

  @media (hover: hover) and (pointer: fine) {
    .ramp-stop-btn:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: rgba(239, 68, 68, 0.5);
      color: #fca5a5;
    }
  }

  .ramp-stop-btn:active {
    transform: scale(0.95);
  }

  .ramp-stop-btn:focus-visible {
    outline: 2px solid var(--semantic-error, #ef4444);
    outline-offset: 2px;
  }

  /* ===========================
     ACCESSIBILITY
     =========================== */

  @media (prefers-reduced-motion: reduce) {
    .ramp-progress.floating {
      animation: none;
    }

    .ramp-bar-fill {
      transition: none;
    }

    .ramp-stop-btn {
      transition: none;
    }

    .ramp-stop-btn:active {
      transform: none;
    }
  }
</style>
