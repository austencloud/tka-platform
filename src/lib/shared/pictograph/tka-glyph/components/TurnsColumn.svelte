<!--
TurnsColumn.svelte - Turn Numbers Display Component

A thin presentation wrapper that displays top and bottom turn numbers.
Can render alongside a TKA letter (to the right) or standalone (at left edge).

Props:
- turnsTuple: The turns tuple string (e.g., "(s, 1, 2)")
- letter: The TKA letter (for color interpretation)
- letterDimensions: Width and height of the letter (optional for standalone)
- pictographData: Full pictograph data (for color interpretation)
- standalone: When true, positions at left edge instead of right of letter
- x, y: Base position (matches TKAGlyph positioning)
-->
<script lang="ts">
  import type { PictographData } from "../../shared/domain/models/PictographData";
  import type { Dimensions } from "../utils/turn-position-calculator";
  import {
    parseTurnsTuple,
    shouldDisplayTurn,
    getTurnNumberImagePath,
    getTurnNumberWidth,
  } from "../utils/turn-tuple-parser";
  import { calculateTurnPositions } from "../utils/turn-position-calculator";
  import { TurnColorInterpreter } from "../services/implementations/TurnColorInterpreter";
  import {
    getLetterDimensions,
    preloadLetterDimensions,
  } from "./TKAGlyph.svelte";
  import { isDashLetter } from "../utils/letter-image-getter";
  import { getAnimationVisibilityManager } from "../../../animation-engine/state/animation-visibility-state.svelte";

  let {
    turnsTuple = "(s, 0, 0)",
    letter = null,
    letterDimensions = { width: 100, height: 100 },
    pictographData = undefined,
    visible = true,
    previewMode = false,
    standalone = false,
    x = 50,
    y = 800,
    scale = 1,
    onToggle = undefined,
  } = $props<{
    turnsTuple: string;
    letter: string | null | undefined;
    letterDimensions?: Dimensions;
    pictographData?: PictographData | null;
    visible?: boolean;
    /** Preview mode: show at 40% opacity when off instead of hidden */
    previewMode?: boolean;
    /** When true, positions at left edge instead of right of letter */
    standalone?: boolean;
    /** Base X position */
    x?: number;
    /** Base Y position */
    y?: number;
    /** Scale factor */
    scale?: number;
    /** Toggle callback for interactive mode */
    onToggle?: () => void;
  }>();

  // Get centralized visibility manager for cached colors (no getComputedStyle per component)
  const visibilityManager = getAnimationVisibilityManager();

  // Track colors from centralized cache
  let cachedColors = $state(visibilityManager.getMotionColors());

  // Register for updates when dark mode changes
  $effect(() => {
    const handler = () => {
      cachedColors = visibilityManager.getMotionColors();
    };
    visibilityManager.registerObserver(handler);
    return () => visibilityManager.unregisterObserver(handler);
  });

  // Get motion colors from centralized cache
  const BLUE_COLOR = $derived(cachedColors.blue);
  const RED_COLOR = $derived(cachedColors.red);

  // Service instance for color interpretation
  const colorInterpreter = new TurnColorInterpreter();

  // Track loaded letter dimensions with $state for reactivity
  // This allows async loading to trigger re-renders when dimensions become available
  let loadedLetterDimensions = $state<Dimensions>({ width: 100, height: 100 });

  // Load letter dimensions when letter changes
  // Uses the same cache as TKAGlyph to ensure consistency
  $effect(() => {
    const currentLetter = letter;
    if (!currentLetter) {
      loadedLetterDimensions = { width: 100, height: 100 };
      return;
    }

    // Check cache first (synchronous)
    const cachedDims = getLetterDimensions(currentLetter);
    if (cachedDims.width !== 100 || cachedDims.height !== 100) {
      // Already cached - use immediately
      loadedLetterDimensions = cachedDims;
    } else {
      // Not cached yet - trigger async load and wait for it
      preloadLetterDimensions([currentLetter]).then(() => {
        // After loading completes, get from cache and update state
        loadedLetterDimensions = getLetterDimensions(currentLetter);
      });
    }
  });

  // Use loaded dimensions, or prop if explicitly provided
  const effectiveLetterDimensions = $derived(() => {
    // Use provided dimensions if explicitly set (not default)
    if (letterDimensions.width !== 100 || letterDimensions.height !== 100) {
      return letterDimensions;
    }
    return loadedLetterDimensions;
  });

  // Parse the turns tuple
  const parsedTurns = $derived(() => parseTurnsTuple(turnsTuple));

  // Determine colors based on letter type and motion data
  const turnColors = $derived(() =>
    colorInterpreter.interpretTurnColors(letter, pictographData)
  );

  // Number height is constant across all turn numbers
  const numberHeight = 45;

  // Calculate the maximum width needed for the turn column
  // This ensures consistent alignment when top and bottom numbers have different widths
  const columnWidth = $derived(() => {
    const topWidth = getTurnNumberWidth(parsedTurns().top);
    const bottomWidth = getTurnNumberWidth(parsedTurns().bottom);
    return Math.max(topWidth, bottomWidth);
  });

  // Check if this letter has a dash (Type3/Type5)
  const hasDash = $derived(isDashLetter(letter));

  // Calculate positions for the numbers (with proper bottom number height)
  // In standalone mode, position at left edge (x=0) instead of right of letter
  const positions = $derived(() => {
    const dims = effectiveLetterDimensions();
    if (standalone) {
      // Standalone mode: position at left edge
      const topY = -5; // Small padding from top
      const bottomY = dims.height - numberHeight + 5;
      return {
        top: { x: 0, y: topY },
        bottom: { x: 0, y: bottomY },
      };
    }
    // Normal mode: position to the right of the letter (or dash if present)
    return calculateTurnPositions(dims, numberHeight, hasDash);
  });

  // Check visibility
  const showTop = $derived(() => shouldDisplayTurn(parsedTurns().top));
  const showBottom = $derived(() => shouldDisplayTurn(parsedTurns().bottom));

  // Get image paths
  const topImagePath = $derived(() =>
    getTurnNumberImagePath(parsedTurns().top)
  );
  const bottomImagePath = $derived(() =>
    getTurnNumberImagePath(parsedTurns().bottom)
  );
</script>

<!-- Turns Column Group - only render when visible (or in preview mode)
     NOTE: We check visibility here (not just CSS) because when exporting to SVG/image,
     CSS classes don't carry over - only the raw SVG markup is captured. -->
{#if visible || previewMode}
  <g
    class="turns-column"
    class:visible
    class:preview-mode={previewMode}
    class:interactive={onToggle !== undefined}
    data-letter={letter}
    transform="translate({x}, {y}) scale({scale})"
    onclick={onToggle}
    {...onToggle
      ? {
          role: "button",
          tabindex: 0,
          "aria-label": "Toggle turn numbers visibility",
        }
      : {}}
  >
    <!-- SVG Recoloring Filter Definitions -->
    <defs>
      <!-- Blue color filter - uses centralized MOTION_COLOR_MAP -->
      <filter id="turn-color-blue" color-interpolation-filters="sRGB">
        <!-- Extract alpha channel -->
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0
                0 0 0 0 0
                0 0 0 0 0
                0 0 0 1 0"
          result="alpha-only"
        />
        <!-- Fill with target blue color from MOTION_COLOR_MAP -->
        <feFlood flood-color={BLUE_COLOR} result="blue-flood" />
        <!-- Composite the color with the alpha mask -->
        <feComposite in="blue-flood" in2="alpha-only" operator="in" />
      </filter>
      <!-- Red color filter - uses centralized MOTION_COLOR_MAP -->
      <filter id="turn-color-red" color-interpolation-filters="sRGB">
        <!-- Extract alpha channel -->
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0
                0 0 0 0 0
                0 0 0 0 0
                0 0 0 1 0"
          result="alpha-only"
        />
        <!-- Fill with target red color from MOTION_COLOR_MAP -->
        <feFlood flood-color={RED_COLOR} result="red-flood" />
        <!-- Composite the color with the alpha mask -->
        <feComposite in="red-flood" in2="alpha-only" operator="in" />
      </filter>
    </defs>

    <!-- Top Number -->
    {#if showTop()}
      <g
        class="turn-number top"
        transform="translate({positions().top.x}, {positions().top.y})"
      >
        <image
          href={topImagePath()}
          width={columnWidth()}
          height={numberHeight}
          filter="url(#{turnColors().top === '#ED1C24'
            ? 'turn-color-red'
            : 'turn-color-blue'})"
          preserveAspectRatio="xMidYMin meet"
        />
      </g>
    {/if}

    <!-- Bottom Number -->
    {#if showBottom()}
      <g
        class="turn-number bottom"
        transform="translate({positions().bottom.x}, {positions().bottom.y})"
      >
        <image
          href={bottomImagePath()}
          width={columnWidth()}
          height={numberHeight}
          filter="url(#{turnColors().bottom === '#ED1C24'
            ? 'turn-color-red'
            : 'turn-color-blue'})"
          preserveAspectRatio="xMidYMin meet"
        />
      </g>
    {/if}
  </g>
{/if}

<style>
  .turns-column {
    /* Beautiful fade in/out effect matching TKA glyph */
    opacity: 0;
    transition: opacity 150ms ease-out;
  }

  .turns-column.visible {
    opacity: 1;
  }

  /* Preview mode: show "off" state at 40% opacity instead of hidden */
  .turns-column.preview-mode:not(.visible) {
    opacity: 0.4;
  }

  .turns-column.interactive {
    cursor: pointer;
    pointer-events: auto;
  }

  /* When visible, maintain full opacity even on hover */
  .turns-column.visible.interactive:hover {
    opacity: 0.9;
  }

  /* When not visible in preview mode, dim on hover */
  .turns-column.preview-mode:not(.visible).interactive:hover {
    opacity: 0.5;
  }

  .turn-number image {
    /* Smooth rendering for number SVGs */
    image-rendering: optimizeQuality;
  }
</style>
