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
  import VTGGlyph from "./VTGGlyph.svelte";
  import ElementalGlyph from "./ElementalGlyph.svelte";
  import PositionGlyph from "./PositionGlyph.svelte";
  import BeatNumber from "./BeatNumber.svelte";
  import { resolve, tryResolve, TYPES } from "../../../inversify/di";
  import type { IGridModeDeriver } from "../../grid/services/contracts/IGridModeDeriver";
  import type { ITurnsTupleGenerator } from "../../arrow/positioning/placement/services/contracts/ITurnsTupleGenerator";
  import { GridMode, GridLocation } from "../../grid/domain/enums/grid-enums";
  import { calculateVTGFromPictograph } from "../domain/utils/vtg-calculator";

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
    beatNumber = null,
    showBeatNumber = false,
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
    // Toggle callbacks (for interactive visibility controls)
    onToggleTKA = undefined,
    onToggleVTG = undefined,
    onToggleElemental = undefined,
    onTogglePositions = undefined,
    onToggleReversals = undefined,
    onToggleNonRadial = undefined,
  } = $props<{
    pictograph: PreparedPictographData;
    blueReversal?: boolean;
    redReversal?: boolean;
    /** Master toggle for grid visibility */
    showGrid?: boolean;
    showTKA?: boolean;
    showReversals?: boolean;
    showNonRadialPoints?: boolean;
    showVTG?: boolean;
    showElemental?: boolean;
    showPositions?: boolean;
    /** Hand point visibility mode: "all" shows all 8 points, "active" shows only where props are */
    handPointVisibility?: "all" | "active";
    /** Active locations for filtering hand points when in "active" mode */
    activeLocations?: GridLocation[];
    beatNumber?: number | null;
    showBeatNumber?: boolean;
    previewMode?: boolean;
    gridModeOverride?: GridMode | null;
    visibleHand?: "blue" | "red" | null;
    arrowsClickable?: boolean;
    propsClickable?: boolean;
    selectedPropHand?: "blue" | "red" | null;
    onPropClick?: (hand: "blue" | "red") => void;
    /** Dark Mode override for export. When set, overrides CSS-based detection. */
    darkMode?: boolean;
    onToggleTKA?: () => void;
    onToggleVTG?: () => void;
    onToggleElemental?: () => void;
    onTogglePositions?: () => void;
    onToggleReversals?: () => void;
    onToggleNonRadial?: () => void;
  }>();

  // Derived beat context
  const isStartPosition = $derived(beatNumber === 0);
  const shouldShowBeatNumber = $derived(
    showBeatNumber && beatNumber !== null && !isStartPosition
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
        const service = resolve<IGridModeDeriver>(TYPES.IGridModeDeriver);
        return service.deriveGridMode(
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
    if (!pictograph) {
      return { vtgMode: null, elementalType: null };
    }
    return calculateVTGFromPictograph(pictograph, gridMode);
  });

  // Turns tuple generation (lazy resolve to avoid init race)
  const turnsTuple = $derived.by(() => {
    if (!pictograph?.motions?.blue || !pictograph?.motions?.red) {
      return "(s, 0, 0)";
    }
    try {
      const generator = tryResolve<ITurnsTupleGenerator>(
        TYPES.ITurnsTupleGenerator
      );
      if (!generator) return "(s, 0, 0)";
      return generator.generateTurnsTuple(pictograph);
    } catch {
      return "(s, 0, 0)";
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
    viewBox="0 0 950 950"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Pictograph"
  >
    <!-- Background - uses prop override if set, otherwise CSS variable for dark mode support -->
    <rect width="950" height="950" fill={darkMode === true ? "#0a0a0f" : darkMode === false ? "white" : "var(--dm-pictograph-bg)"} />

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
        />
      {/if}
    {/each}

    <!-- Arrows -->
    {#each motions as { color, data } (color)}
      {#if arrowAssets[color] && arrowPositions[color]}
        <ArrowSvg
          motionData={data}
          {color}
          pictographData={pictograph}
          arrowAssets={arrowAssets[color]}
          arrowPosition={arrowPositions[color]}
          shouldMirror={arrowMirroring[color] || false}
          showArrow={true}
          isClickable={arrowsClickable}
        />
      {/if}
    {/each}

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
      standalone={false}
      onToggle={onToggleTKA}
    />

    <!-- Direction Dot (same/opp indicator) - positioned relative to letter -->
    <!-- NOTE: letterDimensions is already the base letter dimensions for dash letters -->
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
    <BeatNumber
      {beatNumber}
      showBeatNumber={shouldShowBeatNumber}
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
    />

    <!-- Elemental glyph -->
    <ElementalGlyph
      elementalType={vtgInfo.elementalType}
      letter={pictograph.letter}
      {hasValidData}
      visible={showElemental}
      {previewMode}
      onToggle={onToggleElemental}
    />

    <!-- VTG glyph -->
    <VTGGlyph
      vtgMode={vtgInfo.vtgMode}
      letter={pictograph.letter}
      {hasValidData}
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
    />
  </svg>
</div>

<style>
  .pictograph-renderer {
    width: 100%;
    height: 100%;
    display: block;
    box-sizing: border-box;
    transition: border-color 150ms ease-out;
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
    transition: fill 150ms ease-out;
  }
</style>
