<!--
PictographRenderer.svelte - Dumb pictograph renderer

SINGLE SOURCE OF TRUTH for pictograph SVG rendering.
This is a PRIMITIVE - it renders prepared data as an SVG.
No visibility subscriptions, no effects, no async work.

Dark mode is handled via CSS-first approach (:root.dark class).
Child components (GridSvg, ArrowSvg) detect dark mode via MutationObserver.

Props:
- pictograph: Pre-calculated pictograph data with positions
- blueReversal/redReversal: Reversal indicator states
- All visibility controls (explicit, not from global state)

Usage:
- For batch rendering (option picker): Pass pre-prepared data
- For single pictographs: Use PictographContainer which prepares + renders
-->

<script lang="ts">
  import type { PreparedPictographData } from "../domain/models/PreparedPictographData";
  import GridSvg from "../../grid/components/GridSvg.svelte";
  import PropSvg from "../../prop/components/PropSvg.svelte";
  import ArrowSvg from "../../arrow/rendering/components/ArrowSvg.svelte";
  import TKAGlyph, {
    getLetterDimensions,
    preloadLetterDimensions,
  } from "../../tka-glyph/components/TKAGlyph.svelte";
  import TurnsColumn from "../../tka-glyph/components/TurnsColumn.svelte";
  import DirectionDot from "../../tka-glyph/components/DirectionDot.svelte";
  import { parseTurnsTuple } from "../../tka-glyph/utils/turn-tuple-parser";
  import ReversalIndicators from "./ReversalIndicators.svelte";
  import ElementalGlyph from "./ElementalGlyph.svelte";
  import PositionGlyph from "./PositionGlyph.svelte";
  import StepNumber from "./StepNumber.svelte";
  import DurationGlyph from "./DurationGlyph.svelte";
  import PathShapeGlyph from "./PathShapeGlyph.svelte";
  import { deriveGridMode } from "$lib/shared/pictograph/grid/services/grid-mode-deriver";
  import { turnsTupleGenerator } from "../../arrow/positioning/placement/services/turns-tuple-generator";
  import type { TurnsTupleGenerator } from "$lib/shared/pictograph/arrow/positioning/placement/services/turns-tuple-generator";
  import { GridMode, GridLocation } from "../../grid/domain/enums/grid-enums";
  import { calculateTnDFromPictograph } from "../domain/utils/tnd-calculator";

  // Props - all explicit, no global state dependencies
  let {
    pictograph,
    blueReversal = false,
    redReversal = false,
    // Motion visibility (hides arrows + props for that hand)
    blueMotionVisible = true,
    redMotionVisible = true,
    // Core visibility controls
    showGrid = true,
    showTKA = true,
    showReversals = true,
    showNonRadialPoints = false,
    // Extended glyph visibility controls
    showTnD = false,
    showElemental = false,
    showPositions = false,
    // Hand point visibility (all = show all 8, active = only where props are)
    handPointVisibility = "all",
    // Active locations for hand point filtering
    activeLocations = [],
    // Beat number display
    stepNumber = null,
    showStepNumber = false,
    previewMode = false,
    // Grid mode override (if provided, takes precedence over calculated mode)
    gridModeOverride = null,
    // Show only one hand's prop/arrow (null = show both)
    visibleHand = null,
    // Enable arrow selection for adjustment (admin feature)
    arrowsClickable = false,
    // Enable prop selection for beat editing
    propsClickable = false,
    selectedPropHand = null,
    onPropClick = undefined,
    // Dark Mode override for export (when set, overrides CSS-based detection)
    darkMode = undefined,
    // Print Mode: uses pure white background for professional print output (Choreo Cards)
    printMode = false,
    // Transparent background: grid and props float on parent's background
    transparentBackground = false,
    // Toggle callbacks (for interactive visibility controls)
    onToggleTKA = undefined,
    onToggleTnD = undefined,
    onToggleElemental = undefined,
    onTogglePositions = undefined,
    onToggleReversals = undefined,
    onToggleNonRadial = undefined,
    onToggleStepPosition = undefined,
    // Width multiplier for expanded timeline cells (1 = normal square, >1 = wider viewBox)
    widthMultiplier = 1,
    // Cell index for position caching (enables smooth transitions on regeneration)
    cellIndex = null,
    // Duration multiplier for the step (1 = default, shown when != 1)
    duration = 1,
  } = $props<{
    pictograph: PreparedPictographData;
    blueReversal?: boolean;
    redReversal?: boolean;
    /** Hide blue hand arrows + props when false */
    blueMotionVisible?: boolean;
    /** Hide red hand arrows + props when false */
    redMotionVisible?: boolean;
    /** Master toggle for grid visibility */
    showGrid?: boolean;
    showTKA?: boolean;
    showReversals?: boolean;
    showNonRadialPoints?: boolean;
    showTnD?: boolean;
    showElemental?: boolean;
    showPositions?: boolean;
    /** Hand point visibility mode: "all" shows all 8 points, "active" shows only where props are */
    handPointVisibility?: "all" | "active";
    /** Active locations for filtering hand points when in "active" mode */
    activeLocations?: GridLocation[];
    stepNumber?: number | null;
    showStepNumber?: boolean;
    previewMode?: boolean;
    gridModeOverride?: GridMode | null;
    visibleHand?: "blue" | "red" | null;
    arrowsClickable?: boolean;
    propsClickable?: boolean;
    selectedPropHand?: "blue" | "red" | null;
    onPropClick?: (hand: "blue" | "red") => void;
    /** Dark Mode override for export. When set, overrides CSS-based detection. */
    darkMode?: boolean;
    /** Print Mode: pure white background for professional print (Choreo Cards). */
    printMode?: boolean;
    /** Transparent background - grid and props float on parent's background */
    transparentBackground?: boolean;
    onToggleTKA?: () => void;
    onToggleTnD?: () => void;
    onToggleElemental?: () => void;
    onTogglePositions?: () => void;
    onToggleReversals?: () => void;
    onToggleNonRadial?: () => void;
    /** Width multiplier for expanded timeline cells (1 = normal square, >1 = wider viewBox) */
    widthMultiplier?: number;
    /** Cell index for position caching (enables smooth transitions on regeneration) */
    cellIndex?: number | null;
    /** Duration multiplier for the step (1 = default one beat, shown when != 1) */
    duration?: number;
  }>();

  // Expanded viewBox calculations
  const BASE_SIZE = 950;
  const expandedWidth = $derived(BASE_SIZE * widthMultiplier);
  const isExpanded = $derived(widthMultiplier > 1);
  // Offset to center the core 950x950 content in the expanded viewBox
  const coreContentOffset = $derived((expandedWidth - BASE_SIZE) / 2);
  // X offset for right-aligned glyphs (VTG, Elemental) to stay at right edge
  const rightGlyphOffset = $derived(expandedWidth - BASE_SIZE);

  // Derived beat context
  const isStartPosition = $derived(stepNumber === 0);
  const shouldShowBeatNumber = $derived(
    showStepNumber && stepNumber !== null && !isStartPosition
  );

  // Derive grid mode from override, pre-calculated, or motions
  const gridMode = $derived(
    (() => {
      // Use override if provided
      if (gridModeOverride !== null) {
        return gridModeOverride;
      }
      if (pictograph._prepared?.gridMode) {
        return pictograph._prepared.gridMode;
      }
      if (!pictograph.motions?.blue || !pictograph.motions?.red) {
        return GridMode.DIAMOND;
      }
      try {
        return deriveGridMode(
          pictograph.motions.blue,
          pictograph.motions.red
        );
      } catch {
        return GridMode.DIAMOND;
      }
    })()
  );

  // Pre-calculated positions (from _prepared data)
  const arrowPositions = $derived(pictograph._prepared?.arrowPositions || {});
  const arrowAssets = $derived(pictograph._prepared?.arrowAssets || {});
  const arrowMirroring = $derived(pictograph._prepared?.arrowMirroring || {});
  const propPositions = $derived(pictograph._prepared?.propPositions || {});
  const propAssets = $derived(pictograph._prepared?.propAssets || {});

  // Opacity for dimmed (not hidden) motions - visible enough to see, clearly de-emphasized
  const DIMMED_OPACITY = 0.2;

  // Motions to render (filtered by visibleHand only; visibility controls opacity, not presence)
  const motions = $derived.by(() => {
    if (!pictograph.motions) return [];
    return Object.entries(pictograph.motions)
      .filter((entry): entry is [string, any] => entry[1] !== undefined)
      .filter(([color]) => visibleHand === null || color === visibleHand)
      .sort(([a], [b]) => (a === "blue" ? -1 : 1))
      .map(([color, data]) => ({
        color: color as "blue" | "red",
        data,
        opacity: (color === "blue" ? blueMotionVisible : redMotionVisible) ? 1 : DIMMED_OPACITY,
      }));
  });

  // Arrow tip z-promotion: detect when behind-arrow's tip is buried under front-arrow's shaft
  const tipPromotionNeeded = $derived.by(() => {
    // Need exactly 2 arrows with split data to detect overlap
    if (motions.length < 2) return false;

    const blue = motions.find(m => m.color === "blue");
    const red = motions.find(m => m.color === "red");
    if (!blue || !red) return false;

    const blueAssets = arrowAssets["blue"];
    const redAssets = arrowAssets["red"];
    const bluePos = arrowPositions["blue"];
    const redPos = arrowPositions["red"];

    // Both arrows need split data and positions
    if (!blueAssets?.tipBBox || !bluePos || !redAssets || !redPos) return false;

    // Transform blue tip bbox to pictograph space
    // (simplified: offset by arrow position, ignore rotation for AABB approximation)
    const blueTip = {
      x: bluePos.x + blueAssets.tipBBox.x - (blueAssets.center?.x ?? 0),
      y: bluePos.y + blueAssets.tipBBox.y - (blueAssets.center?.y ?? 0),
      width: blueAssets.tipBBox.width,
      height: blueAssets.tipBBox.height,
    };

    // Red arrow overall bbox in pictograph space
    const redBox = {
      x: redPos.x - (redAssets.center?.x ?? 0),
      y: redPos.y - (redAssets.center?.y ?? 0),
      width: redAssets.viewBox.width,
      height: redAssets.viewBox.height,
    };

    // AABB intersection test
    return (
      blueTip.x < redBox.x + redBox.width &&
      blueTip.x + blueTip.width > redBox.x &&
      blueTip.y < redBox.y + redBox.height &&
      blueTip.y + blueTip.height > redBox.y
    );
  });

  // Both motions fully visible - glyphs that depend on both hands use this
  const bothMotionsFullyVisible = $derived(blueMotionVisible && redMotionVisible);

  // Glyph opacity: full when both motions visible, dimmed when one is off
  const glyphOpacity = $derived(bothMotionsFullyVisible ? 1 : DIMMED_OPACITY);

  // VTG and Elemental calculation
  const tndInfo = $derived.by(() => {
    if (!pictograph) {
      return { tndMode: null, elementalType: null };
    }
    return calculateTnDFromPictograph(pictograph, gridMode);
  });

  // Turns tuple generation
  // NOTE: Fallback must be "(0, 0)" not "(s, 0, 0)" - the "s" prefix would cause
  // DirectionDot to show incorrectly on all pictographs
  const turnsTuple = $derived.by(() => {
    if (!pictograph?.motions?.blue || !pictograph?.motions?.red) {
      return "(0, 0)";
    }
    try {
      return turnsTupleGenerator.generateTurnsTuple(pictograph);
    } catch {
      return "(0, 0)";
    }
  });

  // Check if we have valid data for glyphs
  const hasValidData = $derived(
    !!pictograph?.motions?.blue || !!pictograph?.motions?.red
  );

  // Track loaded letter dimensions with $state for reactivity
  // This allows async loading to trigger re-renders when dimensions become available
  let loadedLetterDimensions = $state<{ width: number; height: number }>({
    width: 100,
    height: 100,
  });

  // Load letter dimensions when letter changes
  // Uses the same cache as TKAGlyph to ensure consistency
  $effect(() => {
    const currentLetter = pictograph?.letter;
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

  // Use loaded dimensions for DirectionDot positioning
  const letterDimensions = $derived(loadedLetterDimensions);

  // Parse direction from turns tuple for direction dot
  const parsedDirection = $derived(parseTurnsTuple(turnsTuple).direction);

</script>

<div class="pictograph-renderer">
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 {expandedWidth} {BASE_SIZE}"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Pictograph"
    style="pointer-events: none;"
  >
    <!-- Background - fills entire expanded viewBox -->
    <rect width={expandedWidth} height={BASE_SIZE} fill={transparentBackground ? "none" : printMode ? "#ffffff" : darkMode === true ? "#0a0a0f" : darkMode === false ? "#d8d8d2" : "var(--dm-pictograph-bg)"} pointer-events="none" />

    <!-- Core content (grid, props, arrows) - centered in expanded viewBox -->
    <g transform="translate({coreContentOffset}, 0)">
      <!-- Grid -->
      {#if showGrid || previewMode}
        <GridSvg
          {gridMode}
          {showNonRadialPoints}
          {handPointVisibility}
          {activeLocations}
          {previewMode}
          {darkMode}
          visible={showGrid}
          onLoaded={() => {}}
          onError={() => {}}
          {onToggleNonRadial}
        />
      {/if}

      <!-- Props -->
      {#each motions as { color, data, opacity } (color)}
        {#if propAssets[color] && propPositions[color]}
          <g opacity={opacity}>
            <PropSvg
              motionData={data}
              propAssets={propAssets[color]}
              propPosition={propPositions[color]}
              showProp={true}
              isClickable={propsClickable}
              isSelected={selectedPropHand === color}
              onPropClick={propsClickable && onPropClick
                ? () => onPropClick(color)
                : undefined}
              {cellIndex}
            />
          </g>
        {/if}
      {/each}

      <!-- Arrows -->
      {#if tipPromotionNeeded}
        <!-- Split rendering: shafts first, then tips on top -->
        {#each motions as { color, data, opacity } (color + "-shaft")}
          {#if arrowAssets[color] && arrowPositions[color]}
            <g opacity={opacity}>
              <ArrowSvg
                motionData={data}
                {color}
                pictographData={pictograph}
                arrowAssets={arrowAssets[color]}
                arrowPosition={arrowPositions[color]}
                shouldMirror={arrowMirroring[color] || false}
                showArrow={true}
                isClickable={arrowsClickable}
                {cellIndex}
                {darkMode}
                renderPart="shaft"
              />
            </g>
          {/if}
        {/each}
        {#each motions as { color, data, opacity } (color + "-tip")}
          {#if arrowAssets[color] && arrowPositions[color]}
            <g opacity={opacity}>
              <ArrowSvg
                motionData={data}
                {color}
                pictographData={pictograph}
                arrowAssets={arrowAssets[color]}
                arrowPosition={arrowPositions[color]}
                shouldMirror={arrowMirroring[color] || false}
                showArrow={true}
                isClickable={arrowsClickable}
                {cellIndex}
                {darkMode}
                renderPart="tip"
              />
            </g>
          {/if}
        {/each}
      {:else}
        <!-- Normal rendering: single combined path per arrow (identical to current behavior) -->
        {#each motions as { color, data, opacity } (color)}
          {#if arrowAssets[color] && arrowPositions[color]}
            <g opacity={opacity}>
              <ArrowSvg
                motionData={data}
                {color}
                pictographData={pictograph}
                arrowAssets={arrowAssets[color]}
                arrowPosition={arrowPositions[color]}
                shouldMirror={arrowMirroring[color] || false}
                showArrow={true}
                isClickable={arrowsClickable}
                {cellIndex}
                {darkMode}
              />
            </g>
          {/if}
        {/each}
      {/if}
    </g>

    <!-- Corner glyphs - positioned at edges of expanded viewBox -->
      <!-- TKA Glyph (fades when one motion is dimmed since it represents both hands) -->
      {#if pictograph.letter}
        <g opacity={showTKA ? glyphOpacity : 0}>
          <TKAGlyph
            letter={pictograph.letter}
            pictographData={pictograph}
            visible={showTKA}
            {previewMode}
            {darkMode}
            onToggle={onToggleTKA}
          />
        </g>
      {/if}

      <!-- Turns Column (part of TKA) -->
      <g opacity={showTKA ? glyphOpacity : 0}>
        <TurnsColumn
          {turnsTuple}
          letter={pictograph.letter}
          pictographData={pictograph}
          visible={showTKA}
          {previewMode}
          standalone={false}
          onToggle={onToggleTKA}
        />
      </g>

      <!-- Direction Dot (same/opp indicator) - positioned relative to letter -->
      {#if pictograph.letter}
        <g opacity={showTKA ? glyphOpacity : 0}>
          <DirectionDot
            direction={parsedDirection}
            letter={pictograph.letter}
            {letterDimensions}
            visible={showTKA}
            {previewMode}
            {darkMode}
          />
        </g>
      {/if}

      <!-- Beat number overlay -->
      <StepNumber
        {stepNumber}
        showStepNumber={shouldShowBeatNumber}
        {isStartPosition}
        {hasValidData}
        {darkMode}
      />

      <!-- Reversal indicators -->
      <ReversalIndicators
        {blueReversal}
        {redReversal}
        {hasValidData}
        visible={showReversals}
        {previewMode}
        onToggle={onToggleReversals}
        {blueMotionVisible}
        {redMotionVisible}
      />

      <!-- Fused Elemental + TnD glyph (bottom-right) -->
      <g opacity={(showElemental || showTnD) ? glyphOpacity : 0}>
        <ElementalGlyph
          elementalType={tndInfo.elementalType}
          letter={pictograph.letter}
          {hasValidData}
          visible={showElemental || showTnD}
          {previewMode}
          onToggle={onToggleElemental ?? onToggleTnD}
          xOffset={rightGlyphOffset}
        />
      </g>

      <!-- Position glyph -->
      <g opacity={showPositions ? glyphOpacity : 0}>
        <PositionGlyph
          startPosition={pictograph.startPosition}
          endPosition={pictograph.endPosition}
          letter={pictograph.letter}
          {hasValidData}
          visible={showPositions}
          {previewMode}
          onToggle={onTogglePositions}
          centerX={expandedWidth / 2}
        />
      </g>

      <!-- Duration glyph (shows "2×", "0.5×", etc. when duration != 1) -->
      <!-- In timeline mode, use widthMultiplier as the live duration (reflects drag preview) -->
      <DurationGlyph
        duration={isExpanded ? widthMultiplier : duration}
        {hasValidData}
        {darkMode}
        centerX={expandedWidth / 2}
      />

      <!-- Path shape accidental glyph (top center, only when per-step override set) -->
      <PathShapeGlyph
        blueMotion={pictograph.motions?.blue}
        redMotion={pictograph.motions?.red}
        {darkMode}
      />
  </svg>
</div>

<style>
  .pictograph-renderer {
    width: 100%;
    height: 100%;
    display: block;
    box-sizing: border-box;
    transition: border-color var(--duration-fast) ease-out;
    /* Allow pointer events to pass through to interactive SVG elements */
    pointer-events: none;
  }

  /* Subtle white outline in dark mode to distinguish boundaries.
     Parent can set --pictograph-border: none to suppress (e.g. flush grids). */
  :global(:root.dark) .pictograph-renderer {
    border: var(--pictograph-border, 1px solid rgba(255, 255, 255, 0.12));
  }

  svg {
    display: block;
  }

  /* Animate SVG background fill changes */
  svg rect:first-child {
    transition: fill var(--duration-fast) ease-out;
  }
</style>
