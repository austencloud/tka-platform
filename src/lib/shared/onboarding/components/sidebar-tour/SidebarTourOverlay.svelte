<script lang="ts">
  /**
   * SidebarTourOverlay
   *
   * Orchestrates the desktop sidebar tour lifecycle.
   * - Shows prompt on first visit
   * - Manages tour state and step transitions
   * - Forces sidebar expanded during tour
   */

  import { onMount } from "svelte";
  import { sidebarTourState } from "../../state/sidebar-tour-state.svelte";
  import SidebarTourPrompt from "./SidebarTourPrompt.svelte";
  import SidebarTourTooltip from "./SidebarTourTooltip.svelte";
  import SidebarTourHighlight from "./SidebarTourHighlight.svelte";

  interface Props {
    /** Callback to force sidebar expanded */
    onExpandSidebar?: () => void;
    /** Callback to restore sidebar state */
    onRestoreSidebar?: (wasCollapsed: boolean) => void;
    /** Current sidebar collapsed state */
    sidebarCollapsed?: boolean;
  }

  const {
    onExpandSidebar,
    onRestoreSidebar,
    sidebarCollapsed = false,
  }: Props = $props();

  let targetElement = $state<HTMLElement | null>(null);
  let hasCheckedTour = $state(false);

  // Find the target element for current step
  $effect(() => {
    if (sidebarTourState.phase !== "touring") {
      targetElement = null;
      return;
    }

    const step = sidebarTourState.currentStepData;
    if (!step) return;

    // Find the module button by data attribute
    const selector = `[data-tour-module="${step.moduleId}"]`;
    const element = document.querySelector<HTMLElement>(selector);

    if (element) {
      targetElement = element;
      // Scroll into view if needed
      element.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      console.warn(`Tour target not found: ${selector}`);
      targetElement = null;
    }
  });

  // Check if tour should be shown on mount
  onMount(() => {
    // Small delay to ensure DOM is ready and user has had a moment to orient
    const timer = setTimeout(() => {
      if (sidebarTourState.shouldShowTour()) {
        sidebarTourState.showPrompt();
      }
      hasCheckedTour = true;
    }, 1000);

    return () => clearTimeout(timer);
  });

  function handleTakeTour() {
    // Force sidebar expanded during tour
    onExpandSidebar?.();
    sidebarTourState.startTour(sidebarCollapsed);
  }

  function handleExploreOwn() {
    sidebarTourState.skipTour();
  }

  function handleNext() {
    sidebarTourState.nextStep();
  }

  function handleBack() {
    sidebarTourState.prevStep();
  }

  function handleDismiss() {
    // Restore sidebar state
    onRestoreSidebar?.(sidebarTourState.wasCollapsed);
    sidebarTourState.dismissTour();
  }

  // Restore sidebar when tour completes
  $effect(() => {
    if (sidebarTourState.phase === "complete") {
      onRestoreSidebar?.(sidebarTourState.wasCollapsed);
    }
  });
</script>

{#if sidebarTourState.phase === "prompt"}
  <SidebarTourPrompt
    onTakeTour={handleTakeTour}
    onExploreOwn={handleExploreOwn}
  />
{/if}

{#if sidebarTourState.phase === "touring" && sidebarTourState.currentStepData}
  <!-- Highlight ring around current module -->
  <SidebarTourHighlight
    {targetElement}
    color={sidebarTourState.currentStepData.color}
  />

  <!-- Tooltip with content -->
  <SidebarTourTooltip
    step={sidebarTourState.currentStepData}
    currentIndex={sidebarTourState.currentStep}
    totalSteps={sidebarTourState.totalSteps}
    {targetElement}
    onNext={handleNext}
    onBack={handleBack}
    onDismiss={handleDismiss}
  />

  <!-- Semi-transparent backdrop (doesn't block sidebar) -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="tour-backdrop"
    onclick={handleDismiss}
    role="button"
    tabindex="0"
    aria-label="Dismiss tour"
  ></div>
{/if}

<style>
  .tour-backdrop {
    position: fixed;
    inset: 0;
    /* Leave sidebar area unobscured - positioned to the right of sidebar */
    left: var(--sidebar-width, 240px);
    background: rgba(0, 0, 0, 0.3);
    z-index: 9997;
    cursor: pointer;
  }
</style>
