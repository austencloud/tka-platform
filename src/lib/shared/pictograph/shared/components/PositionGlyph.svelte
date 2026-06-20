<!--
PositionGlyph.svelte - Position Glyph Component

Renders start → end position indicators showing position groups (α, β, γ)
centered at the top of pictographs. Not shown for static letters (α, β, γ).

Based on legacy start_to_end_pos_glyph.py implementation.
-->
<script lang="ts">
  import { GridPosition } from "../../grid/domain/enums/grid-enums";
  import { Letter } from "../../../foundation/domain/models/letter";

  let {
    startPosition = null,
    endPosition = null,
    letter = null,
    hasValidData = true,
    visible = true,
    previewMode = false,
    animateVisibility = false,
    onToggle = undefined,
    centerX = 475,
  } = $props<{
    /** Start position */
    startPosition?: GridPosition | null;
    /** End position */
    endPosition?: GridPosition | null;
    /** The letter (to filter out static letters) */
    letter?: Letter | null;
    /** Whether the pictograph has valid data */
    hasValidData?: boolean;
    /** Visibility control for fade effect */
    visible?: boolean;
    /** Preview mode: show at 50% opacity when off instead of hidden */
    previewMode?: boolean;
    /** Keep mounted while hidden so the opacity fade can play (live DOM only, not export) */
    animateVisibility?: boolean;
    /** Callback when glyph is clicked to toggle visibility */
    onToggle?: () => void;
    /** Center X position for horizontal centering (expandedWidth / 2) */
    centerX?: number;
  }>();

  // Static letters that don't show position glyph
  const STATIC_LETTERS = [Letter.ALPHA, Letter.BETA, Letter.GAMMA];

  // Extract position group (alpha/beta/gamma) from position string
  function extractPositionGroup(position: GridPosition | null): string | null {
    if (!position) return null;
    // Extract alphabetic characters (e.g., "alpha1" -> "alpha")
    const match = position.match(/[a-z]+/i);
    return match ? match[0].toLowerCase() : null;
  }

  // Only render if we have valid positions, it's not a static letter, AND when visible
  // NOTE: We check visibility here (not just CSS) because when exporting to SVG/image,
  // CSS classes don't carry over - only the raw SVG markup is captured.
  // Preview mode allows rendering at reduced opacity even when not visible.
  const shouldRender = $derived.by(() => {
    // Don't render if not visible (unless in preview mode which shows dimmed,
    // or animateVisibility which keeps it mounted in the live DOM to fade out)
    if (!visible && !previewMode && !animateVisibility) {
      return false;
    }
    if (!hasValidData || !startPosition || !endPosition) {
      return false;
    }
    // Don't show for static letters (α, β, γ)
    if (letter && STATIC_LETTERS.includes(letter)) {
      return false;
    }
    return true;
  });

  const startGroup = $derived.by(() => extractPositionGroup(startPosition));
  const endGroup = $derived.by(() => extractPositionGroup(endPosition));

  // Positioning based on legacy start_to_end_pos_glyph.py:
  // - Scale factor: 0.75
  // - Spacing between elements: 25px
  // - Centered horizontally, positioned at y=50
  // - Standard pictograph size is 950x950 (viewBox)
  const PICTOGRAPH_SIZE = 950;
  const SCALE_FACTOR = 0.75;
  const SPACING = 25;
  const Y_POSITION = 50;

  // SVG paths mapping
  const GROUP_TO_SVG: Record<string, string> = {
    alpha: "/images/letters_trimmed/Type6/α.svg",
    beta: "/images/letters_trimmed/Type6/β.svg",
    gamma: "/images/letters_trimmed/Type6/γ.svg",
  };

  // Actual SVG viewBox dimensions from the source files
  const LETTER_DIMENSIONS = {
    alpha: { width: 92.22, height: 100, yOffset: 10.08 },
    beta: { width: 66.05, height: 100, yOffset: -0.09 },
    gamma: { width: 79, height: 100.11, yOffset: -0.01 },
  } as const;

  // Y-offsets to align visual centers of letters
  // Positive values shift DOWN, negative values shift UP
  // Manually tuned based on visual inspection
  const GROUP_Y_OFFSETS = {
    alpha: 10.0, // Visual center is ABOVE geometric center - shift DOWN
    beta: 0.0, // Reference baseline
    gamma: 0.0, // Reference baseline
  } as const;

  const startSvgPath = $derived.by(() => {
    return startGroup ? GROUP_TO_SVG[startGroup] : "";
  });

  const endSvgPath = $derived.by(() => {
    return endGroup ? GROUP_TO_SVG[endGroup] : "";
  });

  const arrowSvgPath = "/images/arrow.svg";

  const ARROW_WIDTH = 88.9;
  const ARROW_HEIGHT = 34.8;

  // Use a consistent height for all letters (they all have height ~100)
  const LETTER_HEIGHT = 100;
  // Use the widest letter for consistent spacing
  const LETTER_WIDTH = Math.max(
    ...Object.values(LETTER_DIMENSIONS).map((d) => d.width)
  );

  // Scaled dimensions
  const scaledLetterWidth = LETTER_WIDTH * SCALE_FACTOR;
  const scaledLetterHeight = LETTER_HEIGHT * SCALE_FACTOR;
  const scaledArrowWidth = ARROW_WIDTH * SCALE_FACTOR;
  const scaledArrowHeight = ARROW_HEIGHT * SCALE_FACTOR;

  // Calculate a common center line for vertical alignment
  // All elements should have their CENTER aligned on the same horizontal line
  const centerLine = scaledLetterHeight / 2;

  // Calculate positions - position each element so its center aligns with centerLine
  // Apply manual offsets to compensate for different viewBox y-values
  const startYOffset = $derived.by(() => {
    if (!startGroup) return 0;
    return GROUP_Y_OFFSETS[startGroup as keyof typeof GROUP_Y_OFFSETS] || 0;
  });

  const endYOffset = $derived.by(() => {
    if (!endGroup) return 0;
    return GROUP_Y_OFFSETS[endGroup as keyof typeof GROUP_Y_OFFSETS] || 0;
  });

  // Start letter - centered vertically on centerLine
  const startX = 0;
  const startY = $derived(centerLine - scaledLetterHeight / 2 + startYOffset); // Center on line + viewBox compensation

  // Arrow - centered vertically with the letters
  const arrowX = scaledLetterWidth + SPACING * SCALE_FACTOR;
  const arrowY = centerLine - scaledArrowHeight / 2;

  // End letter - centered vertically on centerLine
  const endX = scaledLetterWidth + scaledArrowWidth + SPACING;
  const endY = $derived(centerLine - scaledLetterHeight / 2 + endYOffset); // Center on line + viewBox compensation

  // Calculate total width for centering
  const totalWidth =
    scaledLetterWidth + scaledArrowWidth + scaledLetterWidth + SPACING;
  // Use centerX prop for horizontal centering (supports expanded timeline cells)
  const groupX = $derived(centerX - totalWidth / 2);

  // Center point for scale animation
  const animCenterX = $derived(groupX + totalWidth / 2);
  const animCenterY = Y_POSITION + scaledLetterHeight / 2;

  // ============================================================================
  // POSITION CHANGE ANIMATION
  // ============================================================================
  // Track when start/end positions change to trigger a subtle scale-pulse animation.

  let prevStartPosition = $state<GridPosition | null | undefined>(undefined);
  let prevEndPosition = $state<GridPosition | null | undefined>(undefined);
  let isAnimating = $state(false);

  $effect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const changed =
      (prevStartPosition !== undefined && startPosition !== prevStartPosition) ||
      (prevEndPosition !== undefined && endPosition !== prevEndPosition);

    if (changed && (startPosition !== null || endPosition !== null)) {
      isAnimating = true;
      timeout = setTimeout(() => { isAnimating = false; }, 180);
    }

    prevStartPosition = startPosition;
    prevEndPosition = endPosition;

    return () => { if (timeout) clearTimeout(timeout); };
  });
</script>

{#if shouldRender}
  <g
    class="position-glyph"
    class:visible
    class:preview-mode={previewMode}
    class:interactive={onToggle !== undefined}
    class:animating={isAnimating}
    transform="translate({groupX}, {Y_POSITION})"
    style="transform-origin: {animCenterX}px {animCenterY}px"
    onclick={onToggle}
    {...onToggle
      ? {
          role: "button",
          tabindex: 0,
          "aria-label": "Toggle Position glyph visibility",
        }
      : {}}
  >
    <!-- Start position letter -->
    {#if startSvgPath}
      <image
        href={startSvgPath}
        x={startX}
        y={startY}
        width={scaledLetterWidth}
        height={scaledLetterHeight}
        aria-label={`Start position: ${startGroup}`}
      />
    {/if}

    <!-- Arrow -->
    <image
      href={arrowSvgPath}
      x={arrowX}
      y={arrowY}
      width={scaledArrowWidth}
      height={scaledArrowHeight}
      aria-label="to"
    />

    <!-- End position letter -->
    {#if endSvgPath}
      <image
        href={endSvgPath}
        x={endX}
        y={endY}
        width={scaledLetterWidth}
        height={scaledLetterHeight}
        aria-label={`End position: ${endGroup}`}
      />
    {/if}
  </g>
{/if}

<style>
  .position-glyph {
    /* Beautiful fade in/out effect + dark mode filter transition */
    opacity: 0;
    transition:
      opacity 0.2s ease,
      filter 150ms ease-out;
  }

  .position-glyph.visible {
    opacity: 1;
  }

  /* Preview mode: show "off" state at 40% opacity instead of hidden */
  .position-glyph.preview-mode:not(.visible) {
    opacity: 0.4;
  }

  .position-glyph.interactive {
    cursor: pointer;
    pointer-events: auto;
  }

  /* When visible, maintain full opacity even on hover */
  .position-glyph.visible.interactive:hover {
    opacity: 0.9;
  }

  /* When not visible in preview mode, dim on hover */
  .position-glyph.preview-mode:not(.visible).interactive:hover {
    opacity: 0.5;
  }

  /* Dark mode: invert colors for dark backgrounds */
  /* Uses CSS-first approach - triggered by .dark class on <html> element */
  :global(:root.dark) .position-glyph {
    filter: invert(0.9);
  }

  /* Scale-pulse animation when position changes */
  @keyframes position-pulse {
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

  .position-glyph.animating {
    animation: position-pulse 180ms ease-in-out;
  }

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .position-glyph.animating {
      animation: none;
    }
  }
</style>
