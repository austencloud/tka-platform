<!--
  TransformStepNavigation.svelte

  Progress dots and prev/next/exit buttons for step-through modal.
-->
<script lang="ts">
  type StepType = "intro" | "single" | "dual" | "timeline";

  interface Props {
    steps: StepType[];
    currentIndex: number;
    onPrev: () => void;
    onNext: () => void;
    onGoToStep: (index: number) => void;
    onExit: () => void;
  }

  let { steps, currentIndex, onPrev, onNext, onGoToStep, onExit }: Props = $props();

  const isFirst = $derived(currentIndex === 0);
  const isLast = $derived(currentIndex === steps.length - 1);

  // Human-readable step labels for accessibility
  const stepLabels: Record<StepType, string> = {
    intro: "Introduction",
    single: "Single Motion Example",
    dual: "Dual Motion Example",
    timeline: "Timeline Visualization",
  };
</script>

<div class="step-navigation">
  <!-- Progress dots -->
  <div class="progress-dots" role="tablist" aria-label="Step navigation">
    {#each steps as step, i}
      <button
        class="dot"
        class:active={i === currentIndex}
        class:completed={i < currentIndex}
        role="tab"
        aria-selected={i === currentIndex}
        aria-label="{stepLabels[step]} (step {i + 1} of {steps.length})"
        onclick={() => onGoToStep(i)}
      >
        <span class="dot-inner"></span>
      </button>
    {/each}
  </div>

  <!-- Navigation buttons -->
  <div class="nav-buttons">
    <button
      class="nav-btn prev"
      disabled={isFirst}
      onclick={onPrev}
      aria-label="Previous step"
    >
      <i class="fas fa-chevron-left" aria-hidden="true"></i>
      <span>Previous</span>
    </button>

    <button
      class="nav-btn exit"
      onclick={onExit}
      aria-label="Exit help"
    >
      <span>Exit</span>
    </button>

    <button
      class="nav-btn next"
      class:finish={isLast}
      onclick={isLast ? onExit : onNext}
      aria-label={isLast ? "Finish" : "Next step"}
    >
      <span>{isLast ? "Done" : "Next"}</span>
      {#if !isLast}
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      {:else}
        <i class="fas fa-check" aria-hidden="true"></i>
      {/if}
    </button>
  </div>
</div>

<style>
  .step-navigation {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px 20px 20px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: rgba(0, 0, 0, 0.2);
    flex-shrink: 0;
  }

  /* Progress dots */
  .progress-dots {
    display: flex;
    justify-content: center;
    gap: 8px;
  }

  .dot {
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .dot:focus-visible {
    outline: 2px solid rgba(59, 130, 246, 0.8);
    outline-offset: 2px;
  }

  .dot-inner {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    transition: all 0.2s ease;
  }

  .dot.completed .dot-inner {
    background: rgba(59, 130, 246, 0.6);
  }

  .dot.active .dot-inner {
    width: 12px;
    height: 12px;
    background: #3b82f6;
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
  }

  .dot:hover:not(.active) .dot-inner {
    background: rgba(255, 255, 255, 0.4);
  }

  /* Navigation buttons */
  .nav-buttons {
    display: flex;
    gap: 10px;
    justify-content: center;
  }

  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 20px;
    border-radius: 10px;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
    min-width: 100px;
  }

  .nav-btn.prev,
  .nav-btn.exit {
    background: rgba(255, 255, 255, 0.08);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .nav-btn.prev:hover:not(:disabled),
  .nav-btn.exit:hover {
    background: rgba(255, 255, 255, 0.12);
    color: white;
  }

  .nav-btn.prev:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .nav-btn.next {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  }

  .nav-btn.next:hover {
    background: linear-gradient(135deg, #60a5fa, #3b82f6);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  .nav-btn.next.finish {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
  }

  .nav-btn.next.finish:hover {
    background: linear-gradient(135deg, #4ade80, #22c55e);
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
  }

  .nav-btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  /* Mobile: stack buttons, hide exit */
  @media (max-width: 480px) {
    .nav-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .nav-btn.exit {
      display: none;
    }

    .nav-btn {
      min-width: unset;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dot,
    .dot-inner,
    .nav-btn {
      transition: none;
    }
  }
</style>
