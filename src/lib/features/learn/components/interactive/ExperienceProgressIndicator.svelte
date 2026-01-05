<!--
ExperienceProgressIndicator - Shows step progress dots for learning experiences

Displays:
- Dot for each page/step
- Current step highlighted
- Completed steps with different style
- Fixed position at bottom of screen
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
    position: fixed;
    bottom: 5rem;
    /* Center within content area, accounting for desktop sidebar */
    left: calc(50% + var(--desktop-sidebar-width, 0px) / 2);
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    background: var(--theme-panel-bg, rgba(0, 0, 0, 0.7));
    backdrop-filter: blur(12px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    z-index: 100;
  }

  .progress-dots {
    display: flex;
    gap: 0.5rem;
  }

  .progress-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
  }

  .progress-dot.active {
    background: #50c878;
    transform: scale(1.25);
    box-shadow: 0 0 8px rgba(80, 200, 120, 0.5);
  }

  .progress-dot.completed {
    background: rgba(80, 200, 120, 0.5);
  }

  .progress-text {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  /* Adjust for mobile - no sidebar, center on viewport */
  @media (max-width: 768px) {
    .progress-indicator {
      left: 50%;
      bottom: 5.5rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-dot {
      transition: none;
    }
  }
</style>
