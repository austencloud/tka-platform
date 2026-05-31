<!--
ElementalGlyph.svelte - Fused Elemental + VTG Glyph Component

Renders fused elemental/VTG symbols (water/SS, fire/SO, earth/TS, air/TO, sun/QS, moon/QO)
in the bottom-right corner of pictographs. Each icon contains the VTG mode text
embedded within the elemental shape. Only displays for Type1 letters.
-->
<script lang="ts">
  import { type ElementalType, getElementImagePath } from "../domain/enums/pictograph-enums";
  import { LetterType } from "../../../foundation/domain/models/letter-type";
  import {
    type Letter,
    getLetterType,
  } from "../../../foundation/domain/models/letter";

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

  const imagePath = $derived.by(() => {
    if (!elementalType) return "";
    return getElementImagePath(elementalType);
  });

  // Positioning: bottom-right corner (replacing both old elemental top-right and VTG bottom-right)
  const PICTOGRAPH_SIZE = 950;
  const PADDING = 40;

  // Fused glyphs are roughly square (~200x230px source), scaled to fit pictograph
  const GLYPH_WIDTH = 120;
  const GLYPH_HEIGHT = 140;

  // Position in bottom-right corner (with x-offset for expanded cells)
  const xPosition = $derived(PICTOGRAPH_SIZE - GLYPH_WIDTH - PADDING + xOffset);
  const yPosition = PICTOGRAPH_SIZE - GLYPH_HEIGHT - PADDING;

  // Center point for scale animation
  const centerX = $derived(xPosition + GLYPH_WIDTH / 2);
  const centerY = yPosition + GLYPH_HEIGHT / 2;

  // ============================================================================
  // ELEMENTAL TYPE CHANGE ANIMATION
  // ============================================================================
  // Track when elemental type changes to trigger a subtle scale-pulse animation.

  let prevElementalType = $state<ElementalType | null | undefined>(undefined);
  let isAnimating = $state(false);

  $effect(() => {
    // Skip initial mount (prevElementalType is undefined)
    // Animate when type changes to a new value
    if (prevElementalType !== undefined && elementalType !== prevElementalType && elementalType !== null) {
      isAnimating = true;
      const timeout = setTimeout(() => { isAnimating = false; }, 180);
      return () => clearTimeout(timeout);
    }
    prevElementalType = elementalType;
    return undefined;
  });
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
      class="elemental-image"
      class:animating={isAnimating}
      href={imagePath}
      x={xPosition}
      y={yPosition}
      width={GLYPH_WIDTH}
      height={GLYPH_HEIGHT}
      style="transform-origin: {centerX}px {centerY}px"
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

  /* Scale-pulse animation when elemental type changes */
  @keyframes elemental-pulse {
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

  .elemental-image.animating {
    animation: elemental-pulse 180ms ease-in-out;
  }

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .elemental-image.animating {
      animation: none;
    }
  }
</style>
