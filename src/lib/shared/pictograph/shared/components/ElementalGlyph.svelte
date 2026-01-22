<!--
ElementalGlyph.svelte - Elemental Glyph Component

Renders elemental symbols (water, fire, earth, air, sun, moon) in the top-right corner
of pictographs based on VTG mode classification. Only displays for Type1 letters.

Based on legacy elemental_glyph.py implementation.
-->
<script lang="ts">
  import type { ElementalType } from "../domain/enums/pictograph-enums";
  import { LetterType } from "../../../foundation/domain/models/LetterType";
  import {
    type Letter,
    getLetterType,
  } from "../../../foundation/domain/models/Letter";

  let {
    elementalType = null,
    letter = null,
    hasValidData = true,
    visible = true,
    previewMode = false,
    onToggle = undefined,
    xOffset = 0,
  } = $props<{
    /** The elemental type to display (water, fire, earth, air, sun, moon) */
    elementalType?: ElementalType | null;
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

  // Only render for Type1 letters with valid elemental type AND when visible
  // NOTE: We check visibility here (not just CSS) because when exporting to SVG/image,
  // CSS classes don't carry over - only the raw SVG markup is captured.
  // Preview mode allows rendering at reduced opacity even when not visible.
  const shouldRender = $derived.by(() => {
    // Don't render if not visible (unless in preview mode which shows dimmed)
    if (!visible && !previewMode) {
      return false;
    }
    if (!hasValidData || !elementalType) {
      return false;
    }
    // Only show for Type1 letters
    if (letter && getLetterType(letter) !== LetterType.TYPE1) {
      return false;
    }
    return true;
  });

  // SVG path - elements are in static/images/elements/
  const svgPath = $derived.by(() => {
    if (!elementalType) return "";
    return `/images/elements/${elementalType}.svg`;
  });

  // Positioning based on legacy elemental_glyph.py:
  // - 4% offset from edges
  // - Positioned in top-right corner
  // - Standard pictograph size is 950x950 (viewBox)
  // - SVGs have natural size around 85-100px wide x 125px tall
  const PICTOGRAPH_SIZE = 950;
  const OFFSET_PERCENTAGE = 0.04;

  // Use natural SVG size (approximately 95px wide, 125px tall on average)
  // This matches the legacy behavior where boundingRect is used directly
  const GLYPH_WIDTH = 95;
  const GLYPH_HEIGHT = 125;

  const offsetWidth = PICTOGRAPH_SIZE * OFFSET_PERCENTAGE;
  const offsetHeight = PICTOGRAPH_SIZE * OFFSET_PERCENTAGE;

  // Position in top-right corner (with x-offset for expanded cells)
  const xPosition = $derived(PICTOGRAPH_SIZE - GLYPH_WIDTH - offsetWidth + xOffset);
  const yPosition = offsetHeight;
</script>

{#if shouldRender}
  <g
    class="elemental-glyph"
    class:visible
    class:preview-mode={previewMode}
    class:interactive={onToggle !== undefined}
    onclick={onToggle}
    {...onToggle
      ? {
          role: "button",
          tabindex: 0,
          "aria-label": "Toggle Elemental symbol visibility",
        }
      : {
          "aria-label": `Elemental symbol: ${elementalType}`,
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
  .elemental-glyph {
    /* Beautiful fade in/out effect */
    opacity: 0;
    transition: opacity var(--duration-normal) ease;
  }

  .elemental-glyph.visible {
    opacity: 1;
  }

  /* Preview mode: show "off" state at 40% opacity instead of hidden */
  .elemental-glyph.preview-mode:not(.visible) {
    opacity: 0.4;
  }

  .elemental-glyph.interactive {
    cursor: pointer;
    pointer-events: auto;
  }

  /* When visible, maintain full opacity even on hover */
  .elemental-glyph.visible.interactive:hover {
    opacity: 0.9;
  }

  /* When not visible in preview mode, dim on hover */
  .elemental-glyph.preview-mode:not(.visible).interactive:hover {
    opacity: 0.5;
  }
</style>
