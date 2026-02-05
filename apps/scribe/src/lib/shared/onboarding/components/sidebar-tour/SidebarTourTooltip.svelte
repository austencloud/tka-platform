<script lang="ts">
  /**
   * SidebarTourTooltip
   *
   * Anchored tooltip showing module info, progress dots, and nav controls.
   * Positioned to the right of the target sidebar element.
   */

  import type { TourStep } from "../../config/sidebar-tour-content";

  interface Props {
    step: TourStep;
    currentIndex: number;
    totalSteps: number;
    targetElement: HTMLElement | null;
    onNext: () => void;
    onBack: () => void;
    onDismiss: () => void;
  }

  const {
    step,
    currentIndex,
    totalSteps,
    targetElement,
    onNext,
    onBack,
    onDismiss,
  }: Props = $props();

  const isFirstStep = $derived(currentIndex === 0);
  const isLastStep = $derived(currentIndex === totalSteps - 1);

  let position = $state({ top: 0, left: 0 });

  $effect(() => {
    if (!targetElement) return;

    function updatePosition() {
      const rect = targetElement!.getBoundingClientRect();
      position = {
        top: rect.top + rect.height / 2,
        left: rect.right + 16, // 16px gap from sidebar
      };
    }

    updatePosition();

    // Update on scroll/resize
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  });

  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case "Escape":
        onDismiss();
        break;
      case "ArrowRight":
      case "Enter":
        onNext();
        break;
      case "ArrowLeft":
        if (!isFirstStep) onBack();
        break;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if targetElement}
  <div
    class="tour-tooltip"
    style="
      top: {position.top}px;
      left: {position.left}px;
      --step-color: {step.color};
    "
    role="tooltip"
    aria-live="polite"
  >
    <!-- Arrow pointing to sidebar -->
    <div class="tooltip-arrow"></div>

    <!-- Close button -->
    <button class="tooltip-close" onclick={onDismiss} aria-label="Close tour">
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>

    <!-- Content -->
    <div class="tooltip-content">
      <div class="tooltip-header">
        <div class="step-icon" style="background: {step.color};">
          <i class="fas fa-{step.icon}" aria-hidden="true"></i>
        </div>
        <h3 class="step-heading">{step.heading}</h3>
      </div>

      <p class="step-description">{step.description}</p>

      <!-- Progress dots -->
      <div class="progress-dots" role="group" aria-label="Tour progress">
        {#each Array(totalSteps) as _, i}
          <div
            class="dot"
            class:active={i === currentIndex}
            class:completed={i < currentIndex}
            style={i === currentIndex ? `background: ${step.color};` : ""}
            aria-label={i === currentIndex
              ? `Step ${i + 1} of ${totalSteps}, current`
              : `Step ${i + 1} of ${totalSteps}`}
          ></div>
        {/each}
      </div>

      <!-- Navigation -->
      <div class="tooltip-nav">
        <button
          class="nav-button back"
          onclick={onBack}
          disabled={isFirstStep}
          aria-label="Previous step"
        >
          Back
        </button>
        <button
          class="nav-button next"
          onclick={onNext}
          style="background: {step.color};"
          aria-label={isLastStep ? "Finish tour" : "Next step"}
        >
          {isLastStep ? "Done" : "Next"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .tour-tooltip {
    position: fixed;
    transform: translateY(-50%);
    background: rgba(15, 15, 25, 0.98);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 12px;
    padding: 1rem;
    width: 280px;
    z-index: 9999;
    animation: tooltipIn var(--duration-normal) ease-out;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(12px);
  }

  .tooltip-arrow {
    position: absolute;
    left: -8px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-top: 8px solid transparent;
    border-bottom: 8px solid transparent;
    border-right: 8px solid rgba(15, 15, 25, 0.98);
  }

  .tooltip-close {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    border-radius: 4px;
    transition: all var(--duration-fast) ease;
    font-size: 0.75rem;
  }

  .tooltip-close:hover {
    color: var(--theme-text, #ffffff);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .tooltip-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .tooltip-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .step-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1rem;
    flex-shrink: 0;
  }

  .step-heading {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    margin: 0;
  }

  .step-description {
    font-size: var(--font-size-min, 14px);
    line-height: 1.5;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    margin: 0;
  }

  .progress-dots {
    display: flex;
    justify-content: center;
    gap: 6px;
    padding: 0.25rem 0;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    transition: all var(--duration-normal) ease;
  }

  .dot.completed {
    background: var(--step-color, #3b82f6);
    opacity: 0.5;
  }

  .dot.active {
    width: 20px;
    border-radius: 4px;
  }

  .tooltip-nav {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .nav-button {
    flex: 1;
    padding: 0.625rem 1rem;
    border-radius: 8px;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    border: none;
  }

  .nav-button.back {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
  }

  .nav-button.back:hover:not(:disabled) {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .nav-button.back:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .nav-button.next {
    color: white;
  }

  .nav-button.next:hover {
    filter: brightness(1.1);
  }

  @keyframes tooltipIn {
    from {
      opacity: 0;
      transform: translateY(-50%) translateX(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .tour-tooltip {
      animation: none;
    }
  }
</style>
