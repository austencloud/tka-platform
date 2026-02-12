<!--
  GuidedBuildOverlay.svelte

  Container component for the guided first-build walkthrough.
  Finds target elements, positions tooltips + highlights, and
  listens for state changes to auto-advance steps.

  Non-blocking: doesn't prevent interaction with anything.
  Renders at a high z-index but with pointer-events: none on the overlay itself.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { guidedBuildState } from "../../state/guided-build-state.svelte";
  import { appEntryState } from "../../state/app-entry-state.svelte.ts";
  import GuidedBuildTooltip from "./GuidedBuildTooltip.svelte";
  import GuidedBuildHighlight from "./GuidedBuildHighlight.svelte";

  let targetElement = $state<HTMLElement | null>(null);

  // Derived from guided build state
  const currentStep = $derived(guidedBuildState.currentStep);
  const isActive = $derived(guidedBuildState.isActive);

  // Find target element when step changes
  $effect(() => {
    if (!currentStep) {
      targetElement = null;
      return;
    }

    // Small delay to let DOM update after state change
    const timer = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(
        currentStep.targetSelector
      );
      targetElement = el;
    }, 100);

    return () => clearTimeout(timer);
  });

  // Listen for constructor state changes to auto-advance
  $effect(() => {
    if (!isActive) return;

    function handleGuidedBuildAdvance(event: Event) {
      const detail = (event as CustomEvent<{ key: string }>).detail;
      guidedBuildState.notifyStateChange(detail.key);
    }

    window.addEventListener(
      "guided-build-advance",
      handleGuidedBuildAdvance
    );

    return () => {
      window.removeEventListener(
        "guided-build-advance",
        handleGuidedBuildAdvance
      );
    };
  });

  function handleSkip() {
    guidedBuildState.skip();
    appEntryState.completeEntry();
  }

  function handleDismissStep() {
    guidedBuildState.dismissCurrent();
  }

  // When guided build finishes (all steps done), complete the entry
  $effect(() => {
    if (!guidedBuildState.isActive && !guidedBuildState.isSkipped && guidedBuildState.currentStepIndex > 0) {
      // All steps completed naturally
      appEntryState.completeEntry();
    }
  });

  onMount(() => {
    // Start the guided build
    guidedBuildState.start();

    return () => {
      guidedBuildState.cleanup();
    };
  });
</script>

{#if isActive && currentStep}
  <!-- Highlight ring around target -->
  <GuidedBuildHighlight {targetElement} />

  <!-- Tooltip with instruction -->
  <GuidedBuildTooltip
    step={currentStep}
    {targetElement}
    onDismiss={handleDismissStep}
  />

  <!-- Skip link -->
  <button
    class="guided-build-skip"
    onclick={handleSkip}
  >
    Skip
  </button>
{/if}

<style>
  .guided-build-skip {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 10002;
    padding: 6px 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(30, 30, 45, 0.9));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .guided-build-skip:hover {
    color: var(--theme-text, #fff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    background: var(--theme-card-hover-bg, rgba(40, 40, 55, 0.95));
  }

  .guided-build-skip:focus-visible {
    outline: 2px solid var(--theme-accent, #818cf8);
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    .guided-build-skip {
      bottom: 80px; /* Above bottom nav */
      right: 16px;
    }
  }
</style>
