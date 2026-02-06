<!--
StepNumber.svelte - Step Number Overlay Component

Renders step numbers as SVG text overlays on pictographs.
Georgia serif 100px at x=50,y=50. Shows "Start" for step 0.

Ported from scribe's StepNumber with config injection.
-->
<script lang="ts">
  import { getPictographConfig } from "../config/pictograph-context";

  let {
    stepNumber = null,
    showStepNumber = true,
    isStartPosition = false,
    hasValidData = true,
    darkMode = undefined,
  } = $props<{
    stepNumber?: number | null;
    showStepNumber?: boolean;
    isStartPosition?: boolean;
    hasValidData?: boolean;
    darkMode?: boolean;
  }>();

  const config = getPictographConfig();
  const effectiveDarkMode = $derived(darkMode ?? config.getDarkMode());

  const fillColor = $derived(
    effectiveDarkMode ? "#ffffff" : "#231f20"
  );

  const shouldRender = $derived.by(() => {
    return (
      showStepNumber &&
      !isStartPosition &&
      hasValidData &&
      stepNumber !== null &&
      stepNumber !== -1 &&
      stepNumber !== 0
    );
  });

  const shouldRenderStartText = $derived.by(() => {
    return hasValidData && stepNumber === 0;
  });

  const displayText = $derived.by(() => {
    if (stepNumber === 0) return "Start";
    return stepNumber?.toString() || "";
  });

  // Step number change animation
  let prevStepNumber = $state<number | null | undefined>(undefined);
  let isAnimating = $state(false);

  $effect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (prevStepNumber !== undefined && stepNumber !== prevStepNumber && stepNumber !== null) {
      isAnimating = true;
      timeout = setTimeout(() => { isAnimating = false; }, 180);
    }
    prevStepNumber = stepNumber;
    return () => { if (timeout) clearTimeout(timeout); };
  });
</script>

{#if shouldRender}
  <text
    class="beat-number"
    class:animating={isAnimating}
    x="50"
    y="50"
    dominant-baseline="hanging"
    text-anchor="start"
    font-size="100"
    font-family="Georgia, serif"
    font-weight="bold"
    fill={fillColor}
    style="transform-origin: 50px 50px"
  >
    {displayText}
  </text>
{:else if shouldRenderStartText}
  <text
    class="beat-number"
    class:animating={isAnimating}
    x="50"
    y="50"
    dominant-baseline="hanging"
    text-anchor="start"
    font-size="80"
    font-family="Georgia, serif"
    font-weight="bold"
    fill={fillColor}
    style="transform-origin: 50px 50px"
  >
    {displayText}
  </text>
{/if}

<style>
  .beat-number {
    transition: fill var(--duration-fast, 150ms) ease-out;
  }

  @keyframes step-number-pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(0.91);
    }
    100% {
      transform: scale(1);
    }
  }

  .beat-number.animating {
    animation: step-number-pulse 180ms ease-in-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .beat-number.animating {
      animation: none;
    }
  }
</style>
