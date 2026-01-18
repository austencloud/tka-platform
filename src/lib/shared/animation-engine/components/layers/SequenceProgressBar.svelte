<!--
SequenceProgressBar.svelte

Linear progress indicator for animation sequences.
Shows current position within the sequence and resets on loop.

Design:
- Thin horizontal bar (3px height)
- Smooth CSS transitions for fluid updates
- Theme-aware colors with subtle glow
- Respects prefers-reduced-motion
- Fully accessible with ARIA labels
-->
<script lang="ts">
  let {
    currentStep = 0,
    totalSteps = 0,
    visible = true,
    darkMode = false,
  }: {
    /** Current beat/step number (can exceed totalSteps for looping sequences) */
    currentStep?: number;
    /** Total number of steps in the sequence */
    totalSteps?: number;
    /** Whether the progress bar should be visible */
    visible?: boolean;
    /** Dark mode override (matches WordHeader pattern) */
    darkMode?: boolean;
  } = $props();

  /**
   * Progress within current loop (0-1)
   * Wraps using modulo so progress resets on each loop iteration
   */
  const progress = $derived.by(() => {
    if (totalSteps <= 0) return 0;
    // Use modulo to wrap progress on loop (e.g., step 5 of 4-step sequence = 25% progress)
    const normalizedStep = currentStep % totalSteps;
    return Math.max(0, Math.min(1, normalizedStep / totalSteps));
  });

  /**
   * Percentage string for CSS (0% to 100%)
   */
  const progressPercent = $derived(`${(progress * 100).toFixed(2)}%`);

  /**
   * Format for screen readers
   */
  const ariaLabel = $derived.by(() => {
    if (totalSteps <= 0) return "Sequence progress: no sequence loaded";
    const step = Math.floor(currentStep % totalSteps) + 1; // 1-indexed for humans
    return `Sequence progress: step ${step} of ${totalSteps}`;
  });
</script>

{#if visible && totalSteps > 0}
  <div
    class="progress-bar-container"
    class:dark-mode={darkMode}
    role="progressbar"
    aria-label={ariaLabel}
    aria-valuenow={Math.floor(progress * 100)}
    aria-valuemin={0}
    aria-valuemax={100}
  >
    <div class="progress-track">
      <div class="progress-fill" style="--progress: {progressPercent}"></div>
    </div>
  </div>
{/if}

<style>
  /* Container: full-width, minimal padding */
  .progress-bar-container {
    width: 100%;
    padding: 0 clamp(8px, 4cqw, 16px);
    padding-top: clamp(4px, 2cqw, 8px);
    padding-bottom: clamp(6px, 3cqw, 12px);
    box-sizing: border-box;
    /* Match WordHeader background for seamless integration */
    background: linear-gradient(
      to bottom,
      rgba(248, 248, 248, 0.98),
      rgba(240, 240, 240, 0.98)
    );
    transition: background 150ms ease-out;
  }

  /* Dark mode background */
  .progress-bar-container.dark-mode {
    background: linear-gradient(
      to bottom,
      rgba(15, 15, 20, 0.98),
      rgba(10, 10, 15, 0.98)
    );
  }

  /* Global dark class fallback */
  :global(:root.dark) .progress-bar-container:not(.dark-mode) {
    background: linear-gradient(
      to bottom,
      rgba(15, 15, 20, 0.98),
      rgba(10, 10, 15, 0.98)
    );
  }

  /* Progress track: rounded pill background */
  .progress-track {
    width: 100%;
    height: 3px;
    background: rgba(0, 0, 0, 0.08); /* Light mode: subtle dark track */
    border-radius: 999px; /* Pill shape */
    overflow: hidden; /* Clip fill to rounded corners */
    position: relative;
    transition: background 150ms ease-out;
  }

  .dark-mode .progress-track {
    background: rgba(255, 255, 255, 0.08); /* Dark mode: subtle light track */
  }

  :global(:root.dark) .progress-bar-container:not(.dark-mode) .progress-track {
    background: rgba(255, 255, 255, 0.08);
  }

  /* Progress fill: animated gradient with glow */
  .progress-fill {
    height: 100%;
    width: var(--progress, 0%);
    background: linear-gradient(
      90deg,
      #3b82f6 0%,
      #60a5fa 50%,
      #3b82f6 100%
    ); /* Light mode: blue gradient */
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.4); /* Subtle glow */
    border-radius: 999px;
    /* NO transition on width - let browser render smooth float updates directly from requestAnimationFrame */
    /* Only transition theme changes (background, shadow) */
    transition:
      background 150ms ease-out,
      box-shadow 150ms ease-out;
  }

  .dark-mode .progress-fill {
    background: linear-gradient(
      90deg,
      #00b8b8 0%,
      #00e5e5 50%,
      #00b8b8 100%
    ); /* Dark mode: cyan gradient matching border */
    box-shadow: 0 0 12px rgba(0, 184, 184, 0.5); /* Stronger glow in dark mode */
  }

  :global(:root.dark) .progress-bar-container:not(.dark-mode) .progress-fill {
    background: linear-gradient(90deg, #00b8b8 0%, #00e5e5 50%, #00b8b8 100%);
    box-shadow: 0 0 12px rgba(0, 184, 184, 0.5);
  }

  /* Accessibility: respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .progress-fill {
      transition: none;
    }
    .progress-track,
    .progress-bar-container {
      transition: none;
    }
  }
</style>
