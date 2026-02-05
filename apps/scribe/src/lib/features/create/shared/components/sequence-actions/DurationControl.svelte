<!--
  DurationControl.svelte

  Full-width integrated banner for adjusting beat duration.
  Dual controls: fine (±0.25) and coarse (±1) stepping.
  Display uses decimals with × suffix (0.5×, 1×, 1.25×, 2×, etc.).

  Visually integrates with prop control cards via matching padding and border-bottom divider.
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
  /* ============================================================================
     DURATION CONTROL - Full-width integrated banner
     Visually connects to prop control cards below
     ============================================================================ */

  .duration-control {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 14px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin: 0 0 12px 0; /* Bottom margin creates separation from prop cards */
  }

  /* Compact mode: tighter layout matching prop cards */
  .duration-control.compact {
    gap: 6px;
    padding: 8px;
    margin-bottom: 6px;
  }

  /* Duration label - matches BLUE/RED label styling */
  .duration-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.8);
    text-transform: uppercase;
    letter-spacing: 0.75px;
  }

  .duration-control.compact .duration-label {
    font-size: 0.65rem;
    letter-spacing: 0.5px;
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
     CONTROL BUTTONS - Neutral theme matching the integrated design
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

  /* Coarse buttons (±1) - neutral styling, no orange accent */
  .ctrl-btn.coarse {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.8);
  }

  .ctrl-btn.coarse:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    box-shadow: 0 2px 8px rgba(255, 255, 255, 0.1);
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
