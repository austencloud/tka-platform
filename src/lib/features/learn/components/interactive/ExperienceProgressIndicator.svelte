<!--
ExperienceProgressIndicator - Shows step progress dots for learning experiences

Displays:
- Dot for each page/step
- Current step highlighted
- Completed steps with different style
- Inline in layout flow (parent controls positioning)
-->
<script lang="ts">
  let { currentStep, totalSteps } = $props<{
    currentStep: number;
    totalSteps: number;
  }>();

  // Calculate percentage for screen readers
  const progressPercent = $derived(
    Math.round((currentStep / totalSteps) * 100)
  );
</script>

<div
  class="progress-indicator"
  role="progressbar"
  aria-valuenow={currentStep}
  aria-valuemin={1}
  aria-valuemax={totalSteps}
  aria-label="Lesson progress: step {currentStep} of {totalSteps}"
>
  <div class="progress-dots">
    {#each Array(totalSteps) as _, i}
      <div
        class="progress-dot"
        class:active={i + 1 === currentStep}
        class:completed={i + 1 < currentStep}
        aria-hidden="true"
      ></div>
    {/each}
  </div>
  <span class="progress-text">{currentStep} / {totalSteps}</span>
</div>

<style>
  .progress-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
  }

  .progress-dots {
    display: flex;
    gap: 0.5rem;
  }

  .progress-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    transition:
      background var(--duration-emphasis) var(--ease-out),
      box-shadow var(--duration-emphasis) var(--ease-out),
      transform var(--duration-emphasis) var(--ease-out);
  }

  .progress-dot.active {
    background: var(--semantic-success, #50c878);
    transform: scale(1.25);
    box-shadow: 0 0 8px
      color-mix(in srgb, var(--semantic-success, #50c878) 50%, transparent);
  }

  .progress-dot.completed {
    background: color-mix(
      in srgb,
      var(--semantic-success, #50c878) 50%,
      transparent
    );
  }

  .progress-text {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-dot {
      transition: none;
    }
  }

  @media (min-width: 2400px) and (min-height: 1300px) {
    .progress-indicator {
      gap: 0.9rem;
      padding: 0.65rem 1.25rem;
    }

    .progress-dots {
      gap: 0.6rem;
    }

    .progress-dot {
      width: 10px;
      height: 10px;
    }

    .progress-text {
      font-size: 0.9rem;
    }
  }
</style>
