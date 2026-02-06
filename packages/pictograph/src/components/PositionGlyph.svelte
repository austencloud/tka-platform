<!--
PositionGlyph.svelte - Position Glyph Component

Renders start → end position indicators showing position groups (α, β, γ)
centered at the top of pictographs. Not shown for static letters (α, β, γ).
-->
<script lang="ts">
  import { Letter } from "@tka/types";
  import type { GridPosition } from "@tka/types";

  let {
    startPosition = null,
    endPosition = null,
    letter = null,
    hasValidData = true,
    visible = true,
    previewMode = false,
    onToggle = undefined,
    centerX = 475,
  } = $props<{
    startPosition?: GridPosition | null;
    endPosition?: GridPosition | null;
    letter?: Letter | null;
    hasValidData?: boolean;
    visible?: boolean;
    previewMode?: boolean;
    onToggle?: () => void;
    centerX?: number;
  }>();

  // Static letters that don't show position glyph
  const STATIC_LETTERS = [Letter.ALPHA, Letter.BETA, Letter.GAMMA];

  // Extract position group (alpha/beta/gamma) from position string
  function extractPositionGroup(position: GridPosition | null): string | null {
    if (!position) return null;
    const match = position.match(/[a-z]+/i);
    return match ? match[0].toLowerCase() : null;
  }

  const shouldRender = $derived.by(() => {
    if (!visible && !previewMode) return false;
    if (!hasValidData || !startPosition || !endPosition) return false;
    if (letter && STATIC_LETTERS.includes(letter)) return false;
    return true;
  });

  const startGroup = $derived.by(() => extractPositionGroup(startPosition));
  const endGroup = $derived.by(() => extractPositionGroup(endPosition));

  const PICTOGRAPH_SIZE = 950;
  const SCALE_FACTOR = 0.75;
  const SPACING = 25;
  const Y_POSITION = 50;

  const GROUP_TO_SVG: Record<string, string> = {
    alpha: "/images/letters_trimmed/Type6/α.svg",
    beta: "/images/letters_trimmed/Type6/β.svg",
    gamma: "/images/letters_trimmed/Type6/γ.svg",
  };

  const LETTER_DIMENSIONS = {
    alpha: { width: 92.22, height: 100, yOffset: 10.08 },
    beta: { width: 66.05, height: 100, yOffset: -0.09 },
    gamma: { width: 79, height: 100.11, yOffset: -0.01 },
  } as const;

  const GROUP_Y_OFFSETS = {
    alpha: 10.0,
    beta: 0.0,
    gamma: 0.0,
  } as const;

  const startSvgPath = $derived(startGroup ? GROUP_TO_SVG[startGroup] ?? "" : "");
  const endSvgPath = $derived(endGroup ? GROUP_TO_SVG[endGroup] ?? "" : "");
  const arrowSvgPath = "/images/arrow.svg";

  const ARROW_WIDTH = 88.9;
  const ARROW_HEIGHT = 34.8;
  const LETTER_HEIGHT = 100;
  const LETTER_WIDTH = Math.max(
    ...Object.values(LETTER_DIMENSIONS).map((d) => d.width)
  );

  const scaledLetterWidth = LETTER_WIDTH * SCALE_FACTOR;
  const scaledLetterHeight = LETTER_HEIGHT * SCALE_FACTOR;
  const scaledArrowWidth = ARROW_WIDTH * SCALE_FACTOR;
  const scaledArrowHeight = ARROW_HEIGHT * SCALE_FACTOR;

  const centerLine = scaledLetterHeight / 2;

  const startYOffset = $derived(
    startGroup ? (GROUP_Y_OFFSETS[startGroup as keyof typeof GROUP_Y_OFFSETS] ?? 0) : 0
  );
  const endYOffset = $derived(
    endGroup ? (GROUP_Y_OFFSETS[endGroup as keyof typeof GROUP_Y_OFFSETS] ?? 0) : 0
  );

  const startX = 0;
  const startY = $derived(centerLine - scaledLetterHeight / 2 + startYOffset);

  const arrowX = scaledLetterWidth + SPACING * SCALE_FACTOR;
  const arrowY = centerLine - scaledArrowHeight / 2;

  const endX = scaledLetterWidth + scaledArrowWidth + SPACING;
  const endY = $derived(centerLine - scaledLetterHeight / 2 + endYOffset);

  const totalWidth =
    scaledLetterWidth + scaledArrowWidth + scaledLetterWidth + SPACING;
  const groupX = $derived(centerX - totalWidth / 2);

  const animCenterX = $derived(groupX + totalWidth / 2);
  const animCenterY = Y_POSITION + scaledLetterHeight / 2;

  // Position change animation
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

    <image
      href={arrowSvgPath}
      x={arrowX}
      y={arrowY}
      width={scaledArrowWidth}
      height={scaledArrowHeight}
      aria-label="to"
    />

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
    opacity: 0;
    transition:
      opacity 0.2s ease,
      filter 150ms ease-out;
  }

  .position-glyph.visible {
    opacity: 1;
  }

  .position-glyph.preview-mode:not(.visible) {
    opacity: 0.4;
  }

  .position-glyph.interactive {
    cursor: pointer;
    pointer-events: auto;
  }

  .position-glyph.visible.interactive:hover {
    opacity: 0.9;
  }

  .position-glyph.preview-mode:not(.visible).interactive:hover {
    opacity: 0.5;
  }

  :global(:root.dark) .position-glyph {
    filter: invert(0.9);
  }

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

  @media (prefers-reduced-motion: reduce) {
    .position-glyph.animating {
      animation: none;
    }
  }
</style>
