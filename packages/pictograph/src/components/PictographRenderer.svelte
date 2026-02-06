<!--
PictographRenderer.svelte - Dumb pictograph renderer

SINGLE SOURCE OF TRUTH for pictograph SVG rendering.
This is a PRIMITIVE - it renders prepared data as an SVG.
No visibility subscriptions, no effects, no async work.

Dark mode is handled via CSS-first approach (:root.dark class).
Child components (GridSvg, ArrowSvg) detect dark mode via config context.

Props:
- pictograph: Pre-calculated pictograph data with positions
- blueReversal/redReversal: Reversal indicator states
- All visibility controls (explicit, not from global state)

Usage:
- For batch rendering (option picker): Pass pre-prepared data
- For single pictographs: Use a container which prepares + renders

Ported from scribe's PictographRenderer with config injection.
-->

<script lang="ts">
  import type { PreparedPictographData } from "../domain/PreparedPictographData";
  import type { GridMode } from "@tka/types";
  import { GridMode as GridModeEnum, GridLocation } from "@tka/types";
  import { getPictographConfig } from "../config/pictograph-context";
  import { GridModeDeriver } from "../services/grid/implementations/GridModeDeriver";
  import { TurnsTupleGenerator } from "../services/glyph/implementations/TurnsTupleGenerator";
  import { parseTurnsTuple } from "../utils/turn-tuple-parser";
  import { calculateVTGFromPictograph } from "../utils/vtg-calculator";
  import GridSvg from "./GridSvg.svelte";
  import PropSvg from "./PropSvg.svelte";
  import ArrowSvg from "./ArrowSvg.svelte";
  import TKAGlyph, { getLetterDimensions, preloadLetterDimensions } from "./glyph/TKAGlyph.svelte";
  import TurnsColumn from "./glyph/TurnsColumn.svelte";
  import DirectionDot from "./glyph/DirectionDot.svelte";
  import ReversalIndicators from "./ReversalIndicators.svelte";
  import VTGGlyph from "./glyph/VTGGlyph.svelte";
  import ElementalGlyph from "./glyph/ElementalGlyph.svelte";
  import PositionGlyph from "./PositionGlyph.svelte";
  import StepNumber from "./StepNumber.svelte";
  import DurationGlyph from "./DurationGlyph.svelte";

  // Props - all explicit, no global state dependencies
  let {
    pictograph,
    blueReversal = false,
    redReversal = false,
    // Core visibility controls
    showGrid = true,
    showTKA = true,
    showReversals = true,
    showNonRadialPoints = false,
    // Extended glyph visibility controls
    showVTG = false,
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
    // Arrow selection callback
    onArrowSelect = undefined,
    // Dark Mode override for export (when set, overrides CSS-based detection)
    darkMode = undefined,
    // Print Mode: uses pure white background for professional print output (Choreo Cards)
    printMode = false,
    // Toggle callbacks (for interactive visibility controls)
    onToggleTKA = undefined,
    onToggleVTG = undefined,
    onToggleElemental = undefined,
    onTogglePositions = undefined,
    onToggleReversals = undefined,
    onToggleNonRadial = undefined,
    // Width multiplier for expanded timeline cells (1 = normal square, >1 = wider viewBox)
    widthMultiplier = 1,
    // Cell index for position caching (enables smooth transitions on regeneration)
    cellIndex = null,
    // Duration multiplier for the step (1 = default, shown when != 1)
    duration = 1,
    // Grid rotation direction (optional, for animated grid)
    gridRotationDirection = undefined,
  } = $props<{
    pictograph: PreparedPictographData;
    blueReversal?: boolean;
    redReversal?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showReversals?: boolean;
    showNonRadialPoints?: boolean;
    showVTG?: boolean;
    showElemental?: boolean;
    showPositions?: boolean;
    handPointVisibility?: "all" | "active";
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
    onArrowSelect?: (color: string) => void;
    darkMode?: boolean;
    printMode?: boolean;
    onToggleTKA?: () => void;
    onToggleVTG?: () => void;
    onToggleElemental?: () => void;
    onTogglePositions?: () => void;
    onToggleReversals?: () => void;
    onToggleNonRadial?: () => void;
    widthMultiplier?: number;
    cellIndex?: number | null;
    duration?: number;
    gridRotationDirection?: number | "cw" | "ccw";
  }>();

  const config = getPictographConfig();
  const effectiveDarkMode = $derived(darkMode ?? config.getDarkMode());

  // Internal service instances
  const gridModeDeriver = new GridModeDeriver();
  const turnsTupleGenerator = new TurnsTupleGenerator();

  // Expanded viewBox calculations
  const BASE_SIZE = 950;
  const expandedWidth = $derived(BASE_SIZE * widthMultiplier);
  // Offset to center the core 950x950 content in the expanded viewBox
  const coreContentOffset = $derived((expandedWidth - BASE_SIZE) / 2);

  // Derived beat context
  const isStartPosition = $derived(stepNumber === 0);
  const shouldShowBeatNumber = $derived(
    showStepNumber && stepNumber !== null && !isStartPosition
  );

  // Derive grid mode from override, pre-calculated, or motions
  const gridMode = $derived.by(() => {
    if (gridModeOverride !== null && gridModeOverride !== undefined) return gridModeOverride;
    if (pictograph._prepared?.gridMode) return pictograph._prepared.gridMode;
    if (!pictograph.motions?.blue || !pictograph.motions?.red) return GridModeEnum.DIAMOND;
    try {
      return gridModeDeriver.deriveGridMode(pictograph.motions.blue, pictograph.motions.red);
    } catch {
      return GridModeEnum.DIAMOND;
    }
  });

  // Pre-calculated positions (from _prepared data)
  const arrowPositions = $derived(pictograph._prepared?.arrowPositions || {});
  const arrowAssets = $derived(pictograph._prepared?.arrowAssets || {});
  const arrowMirroring = $derived(pictograph._prepared?.arrowMirroring || {});
  const propPositions = $derived(pictograph._prepared?.propPositions || {});
  const propAssets = $derived(pictograph._prepared?.propAssets || {});

  // Motions to render (filtered by visibleHand if specified)
  const motions = $derived.by(() => {
    if (!pictograph.motions) return [];
    return Object.entries(pictograph.motions)
      .filter((entry): entry is [string, any] => entry[1] !== undefined)
      .filter(([color]) => visibleHand === null || color === visibleHand)
      .map(([color, data]) => ({ color: color as "blue" | "red", data }));
  });

  // VTG and Elemental calculation
  const vtgInfo = $derived.by(() => {
    if (!pictograph) return { vtgMode: null, elementalType: null };
    return calculateVTGFromPictograph(pictograph, gridMode);
  });

  // Turns tuple generation
  const turnsTuple = $derived.by(() => {
    if (!pictograph?.motions?.blue || !pictograph?.motions?.red) return "(0, 0)";
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
  let loadedLetterDimensions = $state<{ width: number; height: number }>({
    width: 100,
    height: 100,
  });

  // Load letter dimensions when letter changes
  $effect(() => {
    const currentLetter = pictograph?.letter;
    if (!currentLetter) {
      loadedLetterDimensions = { width: 100, height: 100 };
      return;
    }

    const cachedDims = getLetterDimensions(currentLetter);
    if (cachedDims.width !== 100 || cachedDims.height !== 100) {
      loadedLetterDimensions = cachedDims;
    } else {
      preloadLetterDimensions([currentLetter]).then(() => {
        loadedLetterDimensions = getLetterDimensions(currentLetter);
      });
    }
  });

  // Use loaded dimensions for DirectionDot positioning
  const letterDimensions = $derived(loadedLetterDimensions);

  // Parse direction from turns tuple for direction dot
  const parsedDirection = $derived(parseTurnsTuple(turnsTuple).direction);

  // Background color
  const bgColor = $derived.by(() => {
    if (printMode) return "#ffffff";
    if (darkMode === true) return "#0a0a0f";
    if (darkMode === false) return "#f5f5f5";
    return effectiveDarkMode ? "#0a0a0f" : "#f5f5f5";
  });
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
    <rect width={expandedWidth} height={BASE_SIZE} fill={bgColor} pointer-events="none" />

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
          {gridRotationDirection}
          onLoaded={() => {}}
          onError={() => {}}
          {onToggleNonRadial}
        />
      {/if}

      <!-- Props -->
      {#each motions as { color, data } (color)}
        {#if propAssets[color] && propPositions[color]}
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
        {/if}
      {/each}

      <!-- Arrows -->
      {#each motions as { color, data } (color)}
        {#if arrowAssets[color] && arrowPositions[color]}
          <ArrowSvg
            motionData={data}
            {color}
            arrowAssets={arrowAssets[color]}
            arrowPosition={arrowPositions[color]}
            shouldMirror={arrowMirroring[color] || false}
            showArrow={true}
            isClickable={arrowsClickable}
            onArrowClick={arrowsClickable ? onArrowSelect : undefined}
            {darkMode}
            {cellIndex}
          />
        {/if}
      {/each}
    </g>

    <!-- Corner glyphs - positioned at edges of expanded viewBox -->
    <!-- TKA Glyph -->
    {#if pictograph.letter}
      <TKAGlyph
        letter={pictograph.letter}
        pictographData={pictograph}
        visible={showTKA}
        {previewMode}
        {darkMode}
        onToggle={onToggleTKA}
      />
    {/if}

    <!-- Turns Column (part of TKA) -->
    <TurnsColumn
      {turnsTuple}
      letter={pictograph.letter}
      pictographData={pictograph}
      visible={showTKA}
      {previewMode}
      {darkMode}
      standalone={false}
      onToggle={onToggleTKA}
    />

    <!-- Direction Dot (same/opp indicator) - positioned relative to letter -->
    {#if pictograph.letter}
      <DirectionDot
        direction={parsedDirection}
        letter={pictograph.letter}
        {letterDimensions}
        visible={showTKA}
        {previewMode}
        {darkMode}
      />
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
      visible={showReversals}
      {previewMode}
      onToggle={onToggleReversals}
    />

    <!-- Elemental glyph -->
    <ElementalGlyph
      vtgMode={vtgInfo.vtgMode}
      letter={pictograph.letter}
      visible={showElemental}
      {previewMode}
      onToggle={onToggleElemental}
    />

    <!-- VTG glyph -->
    <VTGGlyph
      vtgMode={vtgInfo.vtgMode}
      letter={pictograph.letter}
      visible={showVTG}
      {previewMode}
      onToggle={onToggleVTG}
    />

    <!-- Position glyph -->
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

    <!-- Duration glyph (shows "2x", "0.5x", etc. when duration != 1) -->
    <DurationGlyph
      {duration}
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
    transition: border-color var(--duration-fast, 150ms) ease-out;
    /* Allow pointer events to pass through to interactive SVG elements */
    pointer-events: none;
  }

  /* Subtle white outline in dark mode to distinguish boundaries */
  :global(:root.dark) .pictograph-renderer {
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  svg {
    display: block;
  }

  /* Animate SVG background fill changes */
  svg rect:first-child {
    transition: fill var(--duration-fast, 150ms) ease-out;
  }
</style>
