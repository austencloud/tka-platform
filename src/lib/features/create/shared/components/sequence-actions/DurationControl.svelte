<!--
  DurationControl.svelte

  Controls for adjusting beat duration using the musical subdivision system.
  Dual controls: fine (±¼) and coarse (±1) stepping.
  Display uses Unicode fractions for universal understanding.

  Compact mode: Smaller buttons and tighter spacing for mobile.
-->
<script lang="ts">
  import {
    formatDurationDisplay,
  } from "../../utils/duration-display";
  import {
    MIN_DURATION,
    MAX_DURATION,
    DURATION_STEP_FINE,
    DURATION_STEP_COARSE,
  } from "../../services/implementations/step-operations/DurationHandler";

  interface Props {
    duration: number;
    /** Compact mode: smaller buttons and tighter layout */
    compact?: boolean;
    onDurationChange: (newDuration: number) => void;
  }

  let { duration, compact = false, onDurationChange }: Props = $props();

  const displayDuration = $derived(formatDurationDisplay(duration));
  const canDecrease = $derived(duration > MIN_DURATION);
  const canIncrease = $derived(duration < MAX_DURATION);

  function handleChange(delta: number) {
    const newDuration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, duration + delta));
    if (newDuration !== duration) {
      onDurationChange(newDuration);
    }
  }
</script>

<div class="duration-control" class:compact>
  <span class="duration-label">Duration</span>

  <div class="duration-row">
    <!-- Coarse decrease (−1 beat) -->
    <button
      class="ctrl-btn coarse"
      aria-label="Decrease duration by 1 beat"
      onclick={() => handleChange(-DURATION_STEP_COARSE)}
      disabled={!canDecrease}
    >
      <i class="fas fa-angles-left" aria-hidden="true"></i>
    </button>

    <!-- Fine decrease (−¼ beat) -->
    <button
      class="ctrl-btn fine"
      aria-label="Decrease duration by quarter beat"
      onclick={() => handleChange(-DURATION_STEP_FINE)}
      disabled={!canDecrease}
    >
      <i class="fas fa-minus" aria-hidden="true"></i>
    </button>

    <!-- Current value display -->
    <span class="duration-value">{displayDuration}</span>

    <!-- Fine increase (+¼ beat) -->
    <button
      class="ctrl-btn fine"
      aria-label="Increase duration by quarter beat"
      onclick={() => handleChange(DURATION_STEP_FINE)}
      disabled={!canIncrease}
    >
      <i class="fas fa-plus" aria-hidden="true"></i>
    </button>

    <!-- Coarse increase (+1 beat) -->
    <button
      class="ctrl-btn coarse"
      aria-label="Increase duration by 1 beat"
      onclick={() => handleChange(DURATION_STEP_COARSE)}
      disabled={!canIncrease}
    >
      <i class="fas fa-angles-right" aria-hidden="true"></i>
    </button>
  </div>
</div>

<style>
  .duration-control {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    margin-top: 12px;
  }

  /* Compact mode: tighter layout */
  .duration-control.compact {
    gap: 4px;
    padding: 8px;
    border-radius: 10px;
    margin-top: 6px;
  }

  .duration-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .duration-control.compact .duration-label {
    font-size: var(--font-size-compact, 12px);
    letter-spacing: 0.03em;
  }

  .duration-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .duration-control.compact .duration-row {
    gap: 4px;
  }

  .duration-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
    min-width: 64px;
    text-align: center;
    font-feature-settings: "tnum"; /* Tabular numbers for consistent width */
  }

  .duration-control.compact .duration-value {
    font-size: 1.1rem;
    min-width: 48px;
  }

  /* ============================================================================
     CONTROL BUTTONS - Neutral theme (not blue/red)
     ============================================================================ */

  .ctrl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    border-radius: 10px;
    border: 1px solid;
    cursor: pointer;
    font-size: 1rem;
    transition: all var(--duration-fast) ease;
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.7);
  }

  .ctrl-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
    color: rgba(255, 255, 255, 0.9);
  }

  .ctrl-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .ctrl-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* Coarse buttons (±1) - slightly more prominent */
  .ctrl-btn.coarse {
    background: rgba(var(--theme-accent-rgb, 249, 115, 22), 0.15);
    border-color: rgba(var(--theme-accent-rgb, 249, 115, 22), 0.3);
    color: var(--theme-accent, #f97316);
  }

  .ctrl-btn.coarse:hover:not(:disabled) {
    background: rgba(var(--theme-accent-rgb, 249, 115, 22), 0.25);
    border-color: rgba(var(--theme-accent-rgb, 249, 115, 22), 0.5);
    box-shadow: 0 2px 8px rgba(var(--theme-accent-rgb, 249, 115, 22), 0.2);
  }

  /* Fine buttons (±¼) - subtle */
  .ctrl-btn.fine {
    width: 36px;
    height: 36px;
    font-size: 0.9rem;
  }

  /* ============================================================================
     COMPACT MODE - Smaller buttons
     ============================================================================ */

  .duration-control.compact .ctrl-btn {
    width: 34px;
    height: 34px;
    font-size: 0.85rem;
    border-radius: 8px;
  }

  .duration-control.compact .ctrl-btn.fine {
    width: 28px;
    height: 28px;
    font-size: 0.75rem;
  }

  /* ============================================================================
     RESPONSIVE
     ============================================================================ */

  @media (max-width: 360px) {
    .duration-row {
      gap: 4px;
    }

    .ctrl-btn {
      width: 40px;
      height: 40px;
    }

    .ctrl-btn.fine {
      width: 32px;
      height: 32px;
    }

    .duration-value {
      min-width: 56px;
      font-size: 1.25rem;
    }
  }

  /* ============================================================================
     REDUCED MOTION
     ============================================================================ */

  @media (prefers-reduced-motion: reduce) {
    .ctrl-btn {
      transition: none;
    }

    .ctrl-btn:active:not(:disabled) {
      transform: none;
    }
  }
</style>
