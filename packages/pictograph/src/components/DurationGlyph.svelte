<!--
DurationGlyph.svelte - Duration multiplier display (bottom-center)

Shows step duration (e.g. "2x" for 2-beat holds) centered at the bottom.
Uses PictographConfig context for dark mode.
-->
<script lang="ts">
  import { getPictographConfig } from "../config/pictograph-context";

  let {
    duration = null,
    visible = true,
    previewMode = false,
    onToggle = undefined,
    darkMode = undefined,
  } = $props<{
    duration?: number | null;
    visible?: boolean;
    previewMode?: boolean;
    onToggle?: () => void;
    darkMode?: boolean;
  }>();

  const config = getPictographConfig();
  const effectiveDarkMode = $derived(darkMode ?? config.getDarkMode());

  // Only show for durations > 1
  const shouldShow = $derived(duration !== null && duration !== undefined && duration > 1);
</script>

{#if shouldShow}
  <g
    class="duration-glyph"
    class:visible
    class:preview-mode={previewMode}
    class:interactive={onToggle !== undefined}
    onclick={onToggle}
    {...onToggle
      ? {
          role: "button",
          tabindex: 0,
          "aria-label": `Toggle duration glyph visibility`,
        }
      : {}}
  >
    <text
      x="475"
      y="920"
      font-size="56"
      font-weight="700"
      font-family="Arial, sans-serif"
      text-anchor="middle"
      fill={effectiveDarkMode ? "#ffffff" : "#000000"}
      class="duration-text"
    >
      x{duration}
    </text>
  </g>
{/if}

<style>
  .duration-glyph {
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }

  .duration-glyph.visible {
    opacity: 1;
  }

  .duration-glyph.preview-mode:not(.visible) {
    opacity: 0.4;
  }

  .duration-glyph.interactive {
    cursor: pointer;
    pointer-events: auto;
  }

  .duration-glyph.visible.interactive:hover {
    opacity: 0.9;
  }

  .duration-glyph.preview-mode:not(.visible).interactive:hover {
    opacity: 0.5;
  }

  .duration-text {
    transition: fill 150ms ease-out;
  }
</style>
