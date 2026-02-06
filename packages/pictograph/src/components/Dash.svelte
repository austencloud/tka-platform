<!--
Dash.svelte - Letter Dash Component

Renders the dash suffix for Type3 and Type5 letters (e.g., "X-", "Φ-").
Positioned to the right of the letter with a small gap.

Dark mode: This component is rendered INSIDE TKAGlyph's group, which applies
filter: invert(0.9) for dark mode. Therefore, Dash should ALWAYS be black
and let the parent's filter handle the inversion.

Ported from scribe's Dash.svelte.
-->
<script lang="ts">
  const DASH_WIDTH = 70;
  const DASH_HEIGHT = 20;
  const DASH_GAP = 10;
  const DASH_FILL = "#231f20";

  let {
    letterWidth = 100,
    letterHeight = 100,
    visible = true,
    previewMode = false,
  } = $props<{
    letterWidth: number;
    letterHeight: number;
    visible?: boolean;
    previewMode?: boolean;
  }>();

  const dashX = $derived(letterWidth + DASH_GAP);
  const dashY = $derived((letterHeight - DASH_HEIGHT) / 2);

  // Dash appearance animation
  let prevVisible = $state<boolean | undefined>(undefined);
  let isAnimating = $state(false);

  $effect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (prevVisible === false && visible === true) {
      isAnimating = true;
      timeout = setTimeout(() => { isAnimating = false; }, 180);
    }
    prevVisible = visible;
    return () => { if (timeout) clearTimeout(timeout); };
  });
</script>

{#if visible || previewMode}
  <g
    class="letter-dash"
    class:visible
    class:preview-mode={previewMode}
    transform="translate({dashX}, {dashY})"
  >
    <rect
      class="dash-rect"
      class:animating={isAnimating}
      x="0"
      y="0"
      width={DASH_WIDTH}
      height={DASH_HEIGHT}
      rx="9.5"
      ry="9.5"
      fill={DASH_FILL}
      style="transform-origin: {DASH_WIDTH / 2}px {DASH_HEIGHT / 2}px"
    />
  </g>
{/if}

<style>
  .letter-dash {
    opacity: 0;
    transition: opacity var(--duration-fast, 150ms) ease-out;
  }

  .letter-dash.visible {
    opacity: 1;
  }

  .letter-dash.preview-mode:not(.visible) {
    opacity: 0.4;
  }

  @keyframes dash-pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(0.88);
    }
    100% {
      transform: scale(1);
    }
  }

  .dash-rect.animating {
    animation: dash-pulse 180ms ease-in-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .dash-rect.animating {
      animation: none;
    }
  }
</style>
