<script module>
  import { fade } from "svelte/transition";
</script>

<!--
PictographContainer.svelte - Smart pictograph wrapper

Handles:
- Visibility settings subscription
- Settings reactivity (prop type changes)
- Dark mode reactivity (re-prepares with correct colors when toggled)
- Transitions (fade in/out)
- Preparing raw data via PictographPreparer

Dark mode flow:
- Subscribes to AnimationVisibilityStateManager for dark mode changes
- When toggled (L key), re-prepares pictograph with correct motion colors
- For exports: darkMode prop overrides global state for consistent colors

Delegates rendering to PictographRenderer (the dumb primitive).

Usage:
  <PictographContainer pictographData={myData} />

For batch rendering (option picker), use PictographRenderer directly
with pre-prepared data for better performance.
-->

<script lang="ts">
  import { onMount, untrack, tick } from "svelte";
  import { getVisibilityStateManager } from "../state/visibility-state.svelte";
  import { getAnimationVisibilityManager } from "../../../animation-engine/state/animation-visibility-state.svelte";
  import { getSettings } from "../../../application/state/app-state.svelte";
  import type { PictographPreparer } from "../services/pictograph-preparer";
  import { pictographPreparer } from "../services/pictograph-preparer";
  import type { PreparedPictographData } from "../domain/models/prepared-pictograph-data";
  import type { PictographData } from "../domain/models/pictograph-data";
  import { isVisibleMotion } from "../domain/models/motion-data";
  import { describePictograph } from "../domain/utils/pictograph-description";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { PropType } from "../../prop/domain/enums/prop-type";
  import { GridMode, GridLocation } from "../../grid/domain/enums/grid-enums";
  import PictographRenderer from "./PictographRenderer.svelte";
  import { globalAdjustmentVersion } from "../../arrow/positioning/global/state/global-adjustment-version.svelte";

  // Props - accepts either StepData (with beat context) or PictographData
  let {
    pictographData = null,
    disableTransitions = false,
    // Content transitions (different from container transitions)
    disableContentTransitions = false,
    // Grid mode override (for single-motion start positions)
    gridMode: overrideGridMode = null,
    // Core visibility overrides (if undefined, uses global settings)
    showGrid = undefined,
    showTKA = undefined,
    showReversals = undefined,
    showNonRadialPoints = undefined,
    showBlueMotion = undefined,
    showRedMotion = undefined,
    showHandPoints = undefined,
    // Extended glyph visibility overrides
    showTnD = undefined,
    showElemental = undefined,
    showPositions = undefined,
    // Preview mode for visibility settings
    previewMode = false,
    // Show only one hand's prop/arrow (null = show both)
    visibleHand = null,
    // Enable arrow selection for adjustment (admin feature)
    arrowsClickable = false,
    // Renderable option: hide arrows entirely (props + grid still render).
    // Default true = zero behavior change for existing callers.
    showArrow = true,
    // Enable prop selection for variant cycling
    propsClickable = false,
    // Currently selected prop hand (for visual feedback)
    selectedPropHand = null,
    // Callback when a prop is clicked
    onPropClick = undefined,
    // Toggle callbacks (for interactive visibility controls)
    onToggleTKA = undefined,
    onToggleTnD = undefined,
    onToggleElemental = undefined,
    onTogglePositions = undefined,
    onToggleReversals = undefined,
    onToggleNonRadial = undefined,
    // Dark Mode override for export (when set, overrides CSS-based detection)
    darkMode = undefined,
    // Print Mode: pure white background for professional print output
    printMode = false,
    // Transparent background: skip the background fill so the glyph floats
    // on the host surface (decorative embeds on dark tiles).
    transparentBackground = false,
    // Explicit prop types for export/thumbnail rendering
    // When provided, passed to PictographPreparer for consistency during async operations
    bluePropTypeOverride = undefined,
    redPropTypeOverride = undefined,
    // Width multiplier for expanded timeline cells (1 = normal square, >1 = wider)
    widthMultiplier = 1,
    // Cell index for position caching (enables smooth transitions on regeneration)
    cellIndex = null,
    // Musical position string (e.g., "1", "1.5", "2e") for beat number display (timeline mode)
    musicalPosition = undefined,
    // Fires once after the first successful prepare has been applied and rendered
    // to the DOM. Lets offscreen/export rendering await readiness deterministically
    // instead of polling — PictographRenderer does all arrow/prop work synchronously
    // from prepared data, so once preparedData is committed the SVG content is present.
    onReady = undefined,
    // Per-instance step-number override. undefined = follow the global toggle;
    // true/false force it (the choreo sheet drives this from its own setting).
    stepNumberOverride = undefined,
  } = $props<{
    pictographData?: (StepData | PictographData) | null;
    disableTransitions?: boolean;
    disableContentTransitions?: boolean;
    gridMode?: GridMode | null;
    showGrid?: boolean;
    showTKA?: boolean;
    showReversals?: boolean;
    showNonRadialPoints?: boolean;
    showBlueMotion?: boolean;
    showRedMotion?: boolean;
    showHandPoints?: boolean;
    showTnD?: boolean;
    showElemental?: boolean;
    showPositions?: boolean;
    previewMode?: boolean;
    visibleHand?: "blue" | "red" | null;
    arrowsClickable?: boolean;
    /** Renderable option: hide arrows entirely (props + grid still render). Default true. */
    showArrow?: boolean;
    propsClickable?: boolean;
    selectedPropHand?: "blue" | "red" | null;
    onPropClick?: (hand: "blue" | "red") => void;
    onToggleTKA?: () => void;
    onToggleTnD?: () => void;
    onToggleElemental?: () => void;
    onTogglePositions?: () => void;
    onToggleReversals?: () => void;
    onToggleNonRadial?: () => void;
    /** Dark Mode override for export. When set, overrides CSS-based detection. */
    darkMode?: boolean;
    /** Print Mode: pure white background for professional print output (Choreo Cards). */
    printMode?: boolean;
    /** Skip the background fill so the glyph floats on the host surface. */
    transparentBackground?: boolean;
    /** Explicit prop type for blue hand. Export/thumbnail rendering provides this for consistency. */
    bluePropTypeOverride?: PropType;
    /** Explicit prop type for red hand. Export/thumbnail rendering provides this for consistency. */
    redPropTypeOverride?: PropType;
    /** Width multiplier for expanded timeline cells (1 = normal square, >1 = wider viewBox) */
    widthMultiplier?: number;
    /** Cell index for position caching (enables smooth transitions on regeneration) */
    cellIndex?: number | null;
    /** Musical position string (e.g., "1", "1.5", "2e") for beat number display in timeline mode */
    musicalPosition?: string;
    /** Fires once after the first prepared render commits to the DOM (deterministic export readiness signal). */
    onReady?: () => void;
    /** Force step-number visibility on/off, overriding the global toggle. undefined = follow global. */
    stepNumberOverride?: boolean;
  }>();

  // Extract beat context from StepData if available.
  // StepData extends PictographData with beat fields; "stepNumber" only exists
  // on StepData, so the `in` check narrows the union without any casting.
  const stepData = $derived(
    pictographData && "stepNumber" in pictographData ? pictographData : null
  );
  const blueReversal = $derived(stepData?.blueReversal ?? false);
  const redReversal = $derived(stepData?.redReversal ?? false);
  const stepNumber = $derived(stepData?.stepNumber ?? null);
  const duration = $derived(stepData?.duration ?? 1);
  const isStartPosition = $derived(stepNumber === 0);

  // Visibility manager (for glyph visibility)
  const visibilityManager = getVisibilityStateManager();

  // Animation visibility manager (for dark mode)
  const animVisibilityManager = getAnimationVisibilityManager();

  // Reactive visibility state - synced from managers via observers
  // Using $state for each value ensures Svelte 5 properly tracks changes
  let syncedVisibility = $state({
    showGrid: visibilityManager.getGridVisibility(),
    tkaGlyph: visibilityManager.getGlyphVisibility("tkaGlyph"),
    reversalIndicators: visibilityManager.getGlyphVisibility("reversalIndicators"),
    nonRadialPoints: visibilityManager.getNonRadialVisibility(),
    tndGlyph: visibilityManager.getGlyphVisibility("tndGlyph"),
    elementalGlyph: visibilityManager.getGlyphVisibility("elementalGlyph"),
    positionsGlyph: visibilityManager.getGlyphVisibility("positionsGlyph"),
    handPointVisibility: visibilityManager.getHandPointVisibility(),
    stepNumbers: visibilityManager.getStepNumbersVisibility(),
    darkMode: animVisibilityManager.isDarkMode(),
  });

  // Step numbers honor the global visibility toggle (right-click → Step Numbers).
  // Start positions never show a number; 0/null already excluded downstream.
  const showStepNumber = $derived(
    stepNumber !== null && !isStartPosition && (stepNumberOverride ?? syncedVisibility.stepNumbers)
  );

  function handleVisibilityChange() {
    // Re-read ALL visibility values to ensure we have fresh state
    // This creates a new object reference, forcing Svelte to detect the change
    syncedVisibility = {
      showGrid: visibilityManager.getGridVisibility(),
      tkaGlyph: visibilityManager.getGlyphVisibility("tkaGlyph"),
      reversalIndicators: visibilityManager.getGlyphVisibility("reversalIndicators"),
      nonRadialPoints: visibilityManager.getNonRadialVisibility(),
      tndGlyph: visibilityManager.getGlyphVisibility("tndGlyph"),
      elementalGlyph: visibilityManager.getGlyphVisibility("elementalGlyph"),
      positionsGlyph: visibilityManager.getGlyphVisibility("positionsGlyph"),
      handPointVisibility: visibilityManager.getHandPointVisibility(),
      stepNumbers: visibilityManager.getStepNumbersVisibility(),
      darkMode: syncedVisibility.darkMode, // Keep dark mode unchanged
    };
  }

  function handleDarkModeChange() {
    // Update dark mode while preserving other visibility state
    syncedVisibility = {
      ...syncedVisibility,
      darkMode: animVisibilityManager.isDarkMode(),
    };
  }

  onMount(() => {
    visibilityManager.registerObserver(handleVisibilityChange);
    animVisibilityManager.registerObserver(handleDarkModeChange);
    return () => {
      visibilityManager.unregisterObserver(handleVisibilityChange);
      animVisibilityManager.unregisterObserver(handleDarkModeChange);
    };
  });

  // Effective dark mode: use prop if set, otherwise use synced state
  const effectiveDarkMode = $derived(
    darkMode !== undefined ? darkMode : syncedVisibility.darkMode
  );

  // Keep overlays mounted while hidden (so opacity fades can play) ONLY in the
  // live interactive DOM. Export sets `darkMode` explicitly for color inlining,
  // and print uses `printMode`; both capture static SVG and must hard-unmount
  // hidden overlays so they don't leak into the raw markup.
  const liveAnimateVisibility = $derived(darkMode === undefined && !printMode);

  // Effective visibility values - use prop overrides if set, otherwise true (motion always visible)
  const effectiveBlueMotion = $derived(
    showBlueMotion !== undefined ? showBlueMotion : true
  );
  const effectiveRedMotion = $derived(
    showRedMotion !== undefined ? showRedMotion : true
  );
  const effectiveShowGrid = $derived(
    showGrid !== undefined ? showGrid : syncedVisibility.showGrid
  );

  const effectiveShowTKA = $derived(
    showTKA !== undefined ? showTKA : syncedVisibility.tkaGlyph
  );

  // Reversals are an essential part of the notation — always shown unless an
  // explicit prop override (e.g. export options) hides them. The right-click
  // toggle was removed so a stale persisted "off" can't leave them out.
  const effectiveShowReversals = $derived(
    showReversals !== undefined ? showReversals : true
  );

  const effectiveShowNonRadialPoints = $derived(
    showNonRadialPoints !== undefined ? showNonRadialPoints : syncedVisibility.nonRadialPoints
  );

  // Extended glyph visibility
  const effectiveShowVTG = $derived(
    showTnD !== undefined ? showTnD : syncedVisibility.tndGlyph
  );

  // The Elemental and TnD glyphs are one fused glyph in the renderer
  // (visible = showElemental || showTnD). The right-click menu exposes a single
  // "TnD" toggle, so in the global/interactive path both halves follow tndGlyph —
  // toggling TnD fully shows/hides the glyph. Explicit prop overrides still win
  // for external callers (export, TnD decks) that drive elemental directly.
  const effectiveShowElemental = $derived(
    showElemental !== undefined ? showElemental : syncedVisibility.tndGlyph
  );

  const effectiveShowPositions = $derived(
    showPositions !== undefined ? showPositions : syncedVisibility.positionsGlyph
  );

  // Hand point visibility mode - prop override forces show-all or hide-inactive, else use global
  const effectiveHandPointVisibility = $derived<"all" | "active" | "none">(
    showHandPoints !== undefined
      ? (showHandPoints ? "all" : "none")
      : syncedVisibility.handPointVisibility
  );

  // Active locations (where props are positioned)
  // Extract from pictograph motion data - use endLocation for prop positioning
  const activeLocations = $derived.by(() => {
    if (!pictographData) return [];
    const locations: GridLocation[] = [];

    const blueMotion = pictographData.motions?.blue;
    const redMotion = pictographData.motions?.red;

    if (isVisibleMotion(blueMotion) && blueMotion.endLocation) {
      locations.push(blueMotion.endLocation as GridLocation);
    }
    if (isVisibleMotion(redMotion) && redMotion.endLocation) {
      locations.push(redMotion.endLocation as GridLocation);
    }

    return locations;
  });

  // Prepared data state
  let preparedData = $state<PreparedPictographData | null>(null);
  let isLoading = $state(false);

  // Tracks whether the grid SVG has settled. PictographRenderer's GridSvg loads its
  // grid file asynchronously and independently of the prepared arrow/prop data, so
  // the export readiness signal below must wait for it too — otherwise a cold grid
  // cache can serialize the SVG before the grid lines are in the DOM. Fires on both
  // load and error (an errored grid renders nothing, so it should not block readiness).
  let gridReady = $state(false);
  const handleGridReady = () => {
    gridReady = true;
  };

  // Monotonic counter for preparation ordering.
  // Each $effect run increments this. When a prepare completes, it only applies
  // if no newer prepare has already applied. This prevents stale results (e.g. from
  // an old prop type) from overwriting fresh ones, while still allowing rapid WASD
  // results to show in order.
  let prepareSequence = 0;
  let lastAppliedSequence = 0;

  // Resolve prop types: use explicit overrides if provided, otherwise fall back to global settings.
  // These are used both in the cache key and when preparing, so the start position
  // (which has no overrides) correctly picks up the user's selected prop type.
  const effectiveBluePropType = $derived(bluePropTypeOverride ?? getSettings().bluePropType);
  const effectiveRedPropType = $derived(redPropTypeOverride ?? getSettings().redPropType);

  // Create a stable key for data preparation dependencies
  // Include effectiveDarkMode so that when it changes (via prop OR global toggle), we re-prepare with correct colors
  // CRITICAL: Include motion data so transforms trigger re-preparation with new positions
  const prepareKey = $derived.by(() => {
    if (!pictographData) return null;
    const settings = getSettings();

    // Extract motion fingerprints for change detection
    // These are the properties that transforms modify
    const blueMotion = pictographData.motions?.blue;
    const redMotion = pictographData.motions?.red;

    const blueFingerprint = blueMotion ? {
      startLoc: blueMotion.startLocation,
      endLoc: blueMotion.endLocation,
      startPos: blueMotion.startPosition,
      endPos: blueMotion.endPosition,
      motionType: blueMotion.motionType,
      rotation: blueMotion.rotationDirection,
      // Include orientations so prop rotation updates when orientation changes propagate
      startOrientation: blueMotion.startOrientation,
      endOrientation: blueMotion.endOrientation,
      // Include manual adjustments so arrow moves when adjusted
      manualAdjustX: blueMotion.arrowPlacementData?.manualAdjustmentX ?? 0,
      manualAdjustY: blueMotion.arrowPlacementData?.manualAdjustmentY ?? 0,
    } : null;

    const redFingerprint = redMotion ? {
      startLoc: redMotion.startLocation,
      endLoc: redMotion.endLocation,
      startPos: redMotion.startPosition,
      endPos: redMotion.endPosition,
      motionType: redMotion.motionType,
      rotation: redMotion.rotationDirection,
      // Include orientations so prop rotation updates when orientation changes propagate
      startOrientation: redMotion.startOrientation,
      endOrientation: redMotion.endOrientation,
      // Include manual adjustments so arrow moves when adjusted
      manualAdjustX: redMotion.arrowPlacementData?.manualAdjustmentX ?? 0,
      manualAdjustY: redMotion.arrowPlacementData?.manualAdjustmentY ?? 0,
    } : null;

    return JSON.stringify({
      id: pictographData.id,
      letter: pictographData.letter,
      bluePropType: effectiveBluePropType,
      redPropType: effectiveRedPropType,
      darkMode: effectiveDarkMode, // Include effective dark mode for color-correct preparation
      blueMotion: blueFingerprint,
      redMotion: redFingerprint,
      // Include global adjustment version so ALL pictographs re-prepare when adjustments are saved
      // This ensures steps 6, 10, 14, etc. (same letter rotated) update when beat 2 is adjusted globally
      globalAdjustmentVersion: globalAdjustmentVersion.version,
    });
  });

  // Prepare data when pictographData or settings change.
  // Uses a monotonic sequence counter to handle concurrent preparations correctly:
  // - Rapid WASD presses: each increments the counter. If prepare #1 finishes before #2,
  //   it applies (showing intermediate position). When #2 finishes, it also applies (newer).
  // - Prop change after WASD: prop-change prepare gets a higher sequence number.
  //   If the stale WASD prepare (old prop type) finishes after the prop-change prepare,
  //   its lower sequence number prevents it from overwriting the correct result.
  $effect(() => {
    const key = prepareKey;
    const data = pictographData;

    if (!data || !key) {
      preparedData = null;
      prepareSequence = 0;
      lastAppliedSequence = 0;
      return;
    }

    const mySequence = ++prepareSequence;

    (async () => {
      // Only show loading opacity for initial loads (no existing data),
      // not for adjustment re-prepares where we already have data to show.
      // CRITICAL: untrack() prevents preparedData from becoming a dependency of this $effect.
      // Without it, the effect writes preparedData → triggers re-run → reads preparedData → infinite loop.
      if (!untrack(() => preparedData)) {
        isLoading = true;
      }
      try {
        const currentDarkMode = effectiveDarkMode;
        const prepareOptions = {
          themeMode: currentDarkMode ? "dark" as const : "light" as const,
          bluePropType: effectiveBluePropType,
          redPropType: effectiveRedPropType,
        };
        const result = await pictographPreparer.prepareSingle(data as PictographData, prepareOptions);
        // Only apply if no newer preparation has already been applied.
        // This prevents stale results (e.g. old prop type) from overwriting fresh ones,
        // while still allowing intermediate WASD results to show if they finish in order.
        if (mySequence > lastAppliedSequence) {
          lastAppliedSequence = mySequence;
          preparedData = result;
        }
      } catch (error) {
        console.error("Failed to prepare pictograph:", error);
        if (mySequence > lastAppliedSequence) {
          lastAppliedSequence = mySequence;
          preparedData = data as PreparedPictographData;
        }
      } finally {
        if (mySequence >= lastAppliedSequence) {
          isLoading = false;
        }
      }
    })();
  });

  // Content key for fade transitions (when loading different pictographs)
  // CRITICAL: Do NOT include motion data - we want CSS animations for transforms
  // Only trigger fade when the pictograph itself changes (different id)
  const contentKey = $derived.by(() => {
    if (!pictographData) return "empty";
    // Just use id - transforms keep same id, loading different sequence changes id
    return pictographData.id || "no-id";
  });

  // Machine-readable notation on the WRAPPER (not just the inner SVG): the inner
  // PictographRenderer's aria-label renders client-side only (gated behind async
  // prepare), so raw crawlable/SSR HTML would otherwise carry no description.
  // describePictograph works on raw data (no prepare needed), so this wrapper
  // label is present server-side, everywhere a pictograph renders. Blank/empty
  // pictographs stay decorative (no role/label). Wraps the whole node as role=img,
  // which AT treats as a leaf — so the inner glyph labels aren't double-announced.
  const a11yLabel = $derived(pictographData ? describePictograph(pictographData) : "");
  const hasA11yLabel = $derived(!!a11yLabel && a11yLabel !== "Pictograph (empty)");

  // Deterministic readiness signal for offscreen/export rendering.
  // This effect runs after the DOM is updated, so once preparedData is committed
  // PictographRenderer (and its synchronous arrows/props) are in the DOM. The grid,
  // however, loads asynchronously inside GridSvg, so when it is shown we also wait
  // for gridReady — otherwise a cold grid cache could serialize before the grid
  // lines paint. tick() flushes any trailing state before we report. Fires once per
  // mount — export mounts a fresh container per call, so the one-shot guard is right.
  let hasReportedReady = false;
  $effect(() => {
    const gridSettled = !effectiveShowGrid || gridReady;
    if (preparedData && gridSettled && !hasReportedReady && onReady) {
      hasReportedReady = true;
      void tick().then(() => onReady());
    }
  });
</script>

<div
  class="pictograph-container"
  class:loading={isLoading}
  role={hasA11yLabel ? "img" : undefined}
  aria-label={hasA11yLabel ? a11yLabel : undefined}
>
  {#if preparedData}
    {#if disableTransitions}
      <PictographRenderer
        pictograph={preparedData}
        {blueReversal}
        {redReversal}
        blueMotionVisible={effectiveBlueMotion}
        redMotionVisible={effectiveRedMotion}
        showGrid={effectiveShowGrid}
        showTKA={effectiveShowTKA}
        showReversals={effectiveShowReversals}
        showNonRadialPoints={effectiveShowNonRadialPoints}
        showTnD={effectiveShowVTG}
        showElemental={effectiveShowElemental}
        showPositions={effectiveShowPositions}
        handPointVisibility={effectiveHandPointVisibility}
        {activeLocations}
        {stepNumber}
        {showStepNumber}
        {previewMode}
        animateVisibility={liveAnimateVisibility}
        gridModeOverride={overrideGridMode}
        {visibleHand}
        {arrowsClickable}
        {showArrow}
        darkMode={effectiveDarkMode}
        {printMode}
        {transparentBackground}
        {onToggleTKA}
        {onToggleTnD}
        {onToggleElemental}
        {onTogglePositions}
        {onToggleReversals}
        {onToggleNonRadial}
        {widthMultiplier}
        {cellIndex}
        {duration}
        onGridReady={handleGridReady}
      />
    {:else}
      {#key contentKey}
        <div
          class="transition-wrapper"
          in:fade={{ duration: 200 }}
          out:fade={{ duration: 150 }}
        >
          <PictographRenderer
            pictograph={preparedData}
            {blueReversal}
            {redReversal}
            showGrid={effectiveShowGrid}
            showTKA={effectiveShowTKA}
            showReversals={effectiveShowReversals}
            showNonRadialPoints={effectiveShowNonRadialPoints}
            showTnD={effectiveShowVTG}
            showElemental={effectiveShowElemental}
            showPositions={effectiveShowPositions}
            handPointVisibility={effectiveHandPointVisibility}
            {activeLocations}
            {stepNumber}
            {showStepNumber}
            {previewMode}
            animateVisibility={liveAnimateVisibility}
            gridModeOverride={overrideGridMode}
            {visibleHand}
            {arrowsClickable}
            {showArrow}
            darkMode={effectiveDarkMode}
            {printMode}
            {transparentBackground}
            {onToggleTKA}
            {onToggleTnD}
            {onToggleElemental}
            {onTogglePositions}
            {onToggleReversals}
            {onToggleNonRadial}
            {widthMultiplier}
            {cellIndex}
            {duration}
            onGridReady={handleGridReady}
          />
        </div>
      {/key}
    {/if}
  {:else}
    <div class="empty-state">
      <svg width="100%" height="100%" viewBox="0 0 950 950">
        <rect width="950" height="950" fill={effectiveDarkMode ? "#0a0a0f" : "white"} />
      </svg>
    </div>
  {/if}
</div>

<style>
  .pictograph-container {
    width: 100%;
    height: 100%;
    display: block;
    box-sizing: border-box;
    position: relative;
    /* Allow pointer events to pass through to interactive SVG elements */
    pointer-events: none;
  }

  .transition-wrapper {
    width: 100%;
    height: 100%;
    /* Allow pointer events to pass through to interactive SVG elements */
    pointer-events: none;
  }

  .empty-state {
    width: 100%;
    height: 100%;
    opacity: 0.5;
  }

  .pictograph-container.loading {
    opacity: 0.8;
  }
</style>
