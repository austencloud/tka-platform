<!--
ReversalIndicators.svelte - Reversal indicator dots

Shows blue/red reversal indicator dots for prop reversals.
Uses PictographConfig context for dark mode and motion colors.
-->
<script lang="ts">
  import { MotionColor } from "@tka/types";
  import { getPictographConfig } from "../config/pictograph-context";
  import { getMotionColor } from "../utils/svg-color-utils";

  let {
    blueReversal = false,
    redReversal = false,
    blueVisible = true,
    redVisible = true,
    visible = true,
    previewMode = false,
    onToggle = undefined,
    darkMode = undefined,
  } = $props<{
    blueReversal?: boolean;
    redReversal?: boolean;
    blueVisible?: boolean;
    redVisible?: boolean;
    visible?: boolean;
    previewMode?: boolean;
    onToggle?: () => void;
    darkMode?: boolean;
  }>();

  const config = getPictographConfig();
  const effectiveDarkMode = $derived(darkMode ?? config.getDarkMode());

  const blueColor = getMotionColor(MotionColor.BLUE, "dark");
  const redColor = getMotionColor(MotionColor.RED, "dark");

  // Positioning constants
  const DOT_RADIUS = 12;
  const DOT_Y = 890;
  const BLUE_DOT_X = 380;
  const RED_DOT_X = 570;

  const hasAnyReversal = $derived(blueReversal || redReversal);

  // Animation state for reversal changes
  let prevBlueReversal = $state<boolean | undefined>(undefined);
  let prevRedReversal = $state<boolean | undefined>(undefined);
  let blueAnimating = $state(false);
  let redAnimating = $state(false);

  $effect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (prevBlueReversal !== undefined && blueReversal !== prevBlueReversal) {
      blueAnimating = true;
      timeout = setTimeout(() => { blueAnimating = false; }, 200);
    }
    prevBlueReversal = blueReversal;
    return () => { if (timeout) clearTimeout(timeout); };
  });

  $effect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (prevRedReversal !== undefined && redReversal !== prevRedReversal) {
      redAnimating = true;
      timeout = setTimeout(() => { redAnimating = false; }, 200);
    }
    prevRedReversal = redReversal;
    return () => { if (timeout) clearTimeout(timeout); };
  });
</script>

{#if hasAnyReversal}
  <g
    class="reversal-indicators"
    class:visible
    class:preview-mode={previewMode}
    class:interactive={onToggle !== undefined}
    onclick={onToggle}
    {...onToggle
      ? {
          role: "button",
          tabindex: 0,
          "aria-label": "Toggle reversal indicators visibility",
        }
      : {}}
  >
    <!-- Blue reversal dot -->
    {#if blueReversal && blueVisible}
      <circle
        cx={BLUE_DOT_X}
        cy={DOT_Y}
        r={DOT_RADIUS}
        fill={blueColor}
        class="reversal-dot"
        class:animating={blueAnimating}
        aria-label="Blue prop reversal"
      />
    {/if}

    <!-- Red reversal dot -->
    {#if redReversal && redVisible}
      <circle
        cx={RED_DOT_X}
        cy={DOT_Y}
        r={DOT_RADIUS}
        fill={redColor}
        class="reversal-dot"
        class:animating={redAnimating}
        aria-label="Red prop reversal"
      />
    {/if}
  </g>
{/if}

<style>
  .reversal-indicators {
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }

  .reversal-indicators.visible {
    opacity: 1;
  }

  .reversal-indicators.preview-mode:not(.visible) {
    opacity: 0.4;
  }

  .reversal-indicators.interactive {
    cursor: pointer;
    pointer-events: auto;
  }

  .reversal-indicators.visible.interactive:hover {
    opacity: 0.9;
  }

  .reversal-indicators.preview-mode:not(.visible).interactive:hover {
    opacity: 0.5;
  }

  @keyframes reversal-pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.4);
      opacity: 0.7;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .reversal-dot.animating {
    animation: reversal-pulse 200ms ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .reversal-dot.animating {
      animation: none;
    }
  }
</style>
