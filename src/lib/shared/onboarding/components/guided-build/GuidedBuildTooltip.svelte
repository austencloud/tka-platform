<!--
  GuidedBuildTooltip.svelte

  A small card with instruction text and a CSS arrow pointing at the target element.
  Positions itself via getBoundingClientRect() and repositions on window resize.
  pointer-events: none on the highlight ring so user can interact through it.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import type { GuidedBuildStep } from "../../config/guided-build-steps";

  let {
    step,
    targetElement = null,
    onDismiss,
  } = $props<{
    step: GuidedBuildStep;
    targetElement: HTMLElement | null;
    onDismiss?: () => void;
  }>();

  let tooltipX = $state(0);
  let tooltipY = $state(0);
  let arrowPlacement = $state<"top" | "bottom" | "left" | "right">("top");
  let visible = $state(false);

  function updatePosition() {
    if (!targetElement) {
      visible = false;
      return;
    }

    const rect = targetElement.getBoundingClientRect();
    const TOOLTIP_GAP = 12;

    // Determine best placement based on available space
    arrowPlacement = step.placement;

    switch (arrowPlacement) {
      case "top":
        tooltipX = rect.left + rect.width / 2;
        tooltipY = rect.top - TOOLTIP_GAP;
        break;
      case "bottom":
        tooltipX = rect.left + rect.width / 2;
        tooltipY = rect.bottom + TOOLTIP_GAP;
        break;
      case "left":
        tooltipX = rect.left - TOOLTIP_GAP;
        tooltipY = rect.top + rect.height / 2;
        break;
      case "right":
        tooltipX = rect.right + TOOLTIP_GAP;
        tooltipY = rect.top + rect.height / 2;
        break;
    }

    visible = true;
  }

  $effect(() => {
    // Re-run when target changes
    if (targetElement) {
      updatePosition();
    } else {
      visible = false;
    }
  });

  onMount(() => {
    updatePosition();

    const handleResize = () => updatePosition();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  });
</script>

{#if visible}
  <div
    class="guided-tooltip"
    class:arrow-top={arrowPlacement === "top"}
    class:arrow-bottom={arrowPlacement === "bottom"}
    class:arrow-left={arrowPlacement === "left"}
    class:arrow-right={arrowPlacement === "right"}
    style="
      --tooltip-x: {tooltipX}px;
      --tooltip-y: {tooltipY}px;
    "
    transition:fade={{ duration: 200 }}
    role="status"
    aria-live="polite"
  >
    <span class="tooltip-text">{step.text}</span>
    {#if step.advanceOn.type === "timer"}
      <button
        class="tooltip-dismiss"
        onclick={onDismiss}
      >
        Got it
      </button>
    {/if}
  </div>
{/if}

<style>
  .guided-tooltip {
    position: fixed;
    z-index: 10001;
    pointer-events: auto;
    padding: 10px 16px;
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(30, 30, 45, 0.95));
    border: 1px solid var(--theme-accent, #818cf8);
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.4),
      0 0 0 1px rgba(255, 255, 255, 0.05) inset;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 280px;
  }

  /* Position based on arrow placement */
  .guided-tooltip.arrow-top {
    left: var(--tooltip-x);
    top: var(--tooltip-y);
    transform: translate(-50%, -100%);
  }

  .guided-tooltip.arrow-bottom {
    left: var(--tooltip-x);
    top: var(--tooltip-y);
    transform: translate(-50%, 0);
  }

  .guided-tooltip.arrow-left {
    left: var(--tooltip-x);
    top: var(--tooltip-y);
    transform: translate(-100%, -50%);
  }

  .guided-tooltip.arrow-right {
    left: var(--tooltip-x);
    top: var(--tooltip-y);
    transform: translate(0, -50%);
  }

  /* Arrow triangles */
  .guided-tooltip::after {
    content: "";
    position: absolute;
    width: 0;
    height: 0;
    border: 6px solid transparent;
  }

  .guided-tooltip.arrow-top::after {
    bottom: -12px;
    left: 50%;
    transform: translateX(-50%);
    border-top-color: var(--theme-accent, #818cf8);
  }

  .guided-tooltip.arrow-bottom::after {
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    border-bottom-color: var(--theme-accent, #818cf8);
  }

  .guided-tooltip.arrow-left::after {
    right: -12px;
    top: 50%;
    transform: translateY(-50%);
    border-left-color: var(--theme-accent, #818cf8);
  }

  .guided-tooltip.arrow-right::after {
    left: -12px;
    top: 50%;
    transform: translateY(-50%);
    border-right-color: var(--theme-accent, #818cf8);
  }

  .tooltip-text {
    flex: 1;
  }

  .tooltip-dismiss {
    padding: 4px 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms ease;
    white-space: nowrap;
  }

  .tooltip-dismiss:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  /* Gentle pulse animation on the arrow */
  .guided-tooltip::after {
    animation: arrow-pulse 2s ease-in-out infinite;
  }

  @keyframes arrow-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @media (prefers-reduced-motion: reduce) {
    .guided-tooltip::after {
      animation: none;
    }
  }
</style>
