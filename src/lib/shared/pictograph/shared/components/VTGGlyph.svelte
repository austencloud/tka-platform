<!--
VTGGlyph.svelte - VTG Glyph Component

Renders VTG mode glyphs (SS, SO, TS, TO, QS, QO) in the bottom-right corner
of pictographs. Only displays for Type1 letters.

Based on legacy vtg_glyph.py and vtg_glyph_renderer.py implementations.
-->
<script lang="ts">
  import type { VTGMode } from "../domain/enums/pictograph-enums";
  import { LetterType } from "../../../foundation/domain/models/LetterType";
  import {
    type Letter,
    getLetterType,
  } from "../../../foundation/domain/models/Letter";

  let {
    vtgMode = null,
    letter = null,
    hasValidData = true,
    visible = true,
    previewMode = false,
    onToggle = undefined,
    xOffset = 0,
  } = $props<{
    /** The VTG mode to display (SS, SO, TS, TO, QS, QO) */
    vtgMode?: VTGMode | null;
    /** The letter (used to check if Type1) */
    letter?: Letter | null;
    /** Whether the pictograph has valid data */
    hasValidData?: boolean;
    /** Visibility control for fade effect */
    visible?: boolean;
    /** Preview mode: show at 50% opacity when off instead of hidden */
    previewMode?: boolean;
    /** Callback when glyph is clicked to toggle visibility */
    onToggle?: () => void;
    /** X offset for expanded timeline cells (shifts glyph right) */
    xOffset?: number;
  }>();

  // Only render for Type1 letters with valid VTG mode AND when visible
  // NOTE: We check visibility here (not just CSS) because when exporting to SVG/image,
  // CSS classes don't carry over - only the raw SVG markup is captured.
  // Preview mode allows rendering at reduced opacity even when not visible.
  const shouldRender = $derived.by(() => {
    // Don't render if not visible (unless in preview mode which shows dimmed)
    if (!visible && !previewMode) {
      return false;
    }
    if (!hasValidData || !vtgMode) {
      return false;
    }
    // Only show for Type1 letters
    if (letter && getLetterType(letter) !== LetterType.TYPE1) {
      return false;
    }
    return true;
  });

  // SVG path - VTG glyphs are in static/images/vtg_glyphs/
  const svgPath = $derived.by(() => {
    if (!vtgMode) return "";
    return `/images/vtg_glyphs/${vtgMode}.svg`;
  });

  // Positioning based on legacy vtg_glyph_renderer.py:
  // - 4% offset from edges
  // - Positioned in bottom-right corner
  // - Standard pictograph size is 950x950 (viewBox)
  const PICTOGRAPH_SIZE = 950;
  const OFFSET_PERCENTAGE = 0.04;

  // VTG glyph dimensions (from actual SVG viewBox: 201.24 x 133.6)
  const GLYPH_WIDTH = 201.24;
  const GLYPH_HEIGHT = 133.6;

  const offsetWidth = PICTOGRAPH_SIZE * OFFSET_PERCENTAGE;
  const offsetHeight = PICTOGRAPH_SIZE * OFFSET_PERCENTAGE;

  // Position in bottom-right corner (with x-offset for expanded cells)
  const xPosition = $derived(PICTOGRAPH_SIZE - GLYPH_WIDTH - offsetWidth + xOffset);
  const yPosition = PICTOGRAPH_SIZE - GLYPH_HEIGHT - offsetHeight;
</script>

{#if shouldRender}
  <g
    class="vtg-glyph"
    class:visible
    class:preview-mode={previewMode}
    class:interactive={onToggle !== undefined}
    onclick={onToggle}
    {...onToggle
      ? {
          role: "button",
          tabindex: 0,
          "aria-label": "Toggle VTG glyph visibility",
        }
      : {
          "aria-label": `VTG mode: ${vtgMode}`,
        }}
  >
    <image
      href={svgPath}
      x={xPosition}
      y={yPosition}
      width={GLYPH_WIDTH}
      height={GLYPH_HEIGHT}
    />
  </g>
{/if}

<style>
  .vtg-glyph {
    /* Beautiful fade in/out effect */
    opacity: 0;
    transition: opacity var(--duration-normal) ease;
  }

  .vtg-glyph.visible {
    opacity: 1;
  }

  /* Preview mode: show "off" state at 40% opacity instead of hidden */
  .vtg-glyph.preview-mode:not(.visible) {
    opacity: 0.4;
  }

  .vtg-glyph.interactive {
    cursor: pointer;
  }

  /* When visible, maintain full opacity even on hover */
  .vtg-glyph.visible.interactive:hover {
    opacity: 0.9;
  }

  /* When not visible in preview mode, dim on hover */
  .vtg-glyph.preview-mode:not(.visible).interactive:hover {
    opacity: 0.5;
  }
</style>
