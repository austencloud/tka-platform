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
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import { getVisibilityStateManager } from "../state/visibility-state.svelte";
  import { getAnimationVisibilityManager } from "../../../animation-engine/state/animation-visibility-state.svelte";
  import { getSettings } from "../../../application/state/app-state.svelte";
  import type { IPictographPreparer } from "../services/contracts/IPictographPreparer";
  import type { PreparedPictographData } from "../domain/models/PreparedPictographData";
  import type { PictographData } from "../domain/models/PictographData";
  import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
  import type { PropType } from "../../prop/domain/enums/PropType";
  import { GridMode, GridLocation } from "../../grid/domain/enums/grid-enums";
  import PictographRenderer from "./PictographRenderer.svelte";

  // Props - accepts either BeatData (with beat context) or PictographData
  let {
    pictographData = null,
    disableTransitions = false,
    // Content transitions (different from container transitions)
    disableContentTransitions = false,
    // Grid mode override (for single-motion start positions)
    gridMode: overrideGridMode = null,
    // Core visibility overrides (if undefined, uses global settings)
    showTKA = undefined,
    showReversals = undefined,
    showNonRadialPoints = undefined,
    // Extended glyph visibility overrides
    showVTG = undefined,
    showElemental = undefined,
    showPositions = undefined,
    // Preview mode for visibility settings
    previewMode = false,
    // Show only one hand's prop/arrow (null = show both)
    visibleHand = null,
    // Enable arrow selection for adjustment (admin feature)
    arrowsClickable = false,
    // Enable prop selection for variant cycling
    propsClickable = false,
    // Currently selected prop hand (for visual feedback)
    selectedPropHand = null,
    // Callback when a prop is clicked
    onPropClick = undefined,
    // Toggle callbacks (for interactive visibility controls)
    onToggleTKA = undefined,
    onToggleVTG = undefined,
    onToggleElemental = undefined,
    onTogglePositions = undefined,
    onToggleReversals = undefined,
    onToggleNonRadial = undefined,
    // Dark Mode override for export (when set, overrides CSS-based detection)
    darkMode = undefined,
    // Explicit prop types for export/thumbnail rendering
    // When provided, passed to PictographPreparer for consistency during async operations
    bluePropTypeOverride = undefined,
    redPropTypeOverride = undefined,
  } = $props<{
    pictographData?: (BeatData | PictographData) | null;
    disableTransitions?: boolean;
    disableContentTransitions?: boolean;
    gridMode?: GridMode | null;
    showTKA?: boolean;
    showReversals?: boolean;
    showNonRadialPoints?: boolean;
    showVTG?: boolean;
    showElemental?: boolean;
    showPositions?: boolean;
    previewMode?: boolean;
    visibleHand?: "blue" | "red" | null;
    arrowsClickable?: boolean;
    propsClickable?: boolean;
    selectedPropHand?: "blue" | "red" | null;
    onPropClick?: (hand: "blue" | "red") => void;
    onToggleTKA?: () => void;
    onToggleVTG?: () => void;
    onToggleElemental?: () => void;
    onTogglePositions?: () => void;
    onToggleReversals?: () => void;
    onToggleNonRadial?: () => void;
    /** Dark Mode override for export. When set, overrides CSS-based detection. */
    darkMode?: boolean;
    /** Explicit prop type for blue hand. Export/thumbnail rendering provides this for consistency. */
    bluePropTypeOverride?: PropType;
    /** Explicit prop type for red hand. Export/thumbnail rendering provides this for consistency. */
    redPropTypeOverride?: PropType;
  }>();

  // Extract beat context from BeatData if available
  const blueReversal = $derived((pictographData as any)?.blueReversal ?? false);
  const redReversal = $derived((pictographData as any)?.redReversal ?? false);
  const beatNumber = $derived((pictographData as any)?.beatNumber ?? null);
  const isStartPosition = $derived(beatNumber === 0);
  const showBeatNumber = $derived(beatNumber !== null && !isStartPosition);

  // Visibility manager (for glyph visibility)
  const visibilityManager = getVisibilityStateManager();
  let visibilityUpdateCount = $state(0);

  function handleVisibilityChange() {
    visibilityUpdateCount++;
  }

  // Animation visibility manager (for dark mode)
  const animVisibilityManager = getAnimationVisibilityManager();
  let darkModeUpdateCount = $state(0);

  function handleDarkModeChange() {
    darkModeUpdateCount++;
  }

  onMount(() => {
    visibilityManager.registerObserver(handleVisibilityChange);
    animVisibilityManager.registerObserver(handleDarkModeChange);
    return () => {
      visibilityManager.unregisterObserver(handleVisibilityChange);
      animVisibilityManager.unregisterObserver(handleDarkModeChange);
    };
  });

  // Effective dark mode: use prop if set, otherwise use global state
  const effectiveDarkMode = $derived.by(() => {
    darkModeUpdateCount; // Subscribe to dark mode changes
    return darkMode !== undefined ? darkMode : animVisibilityManager.isDarkMode();
  });

  // Effective visibility values
  const effectiveShowGrid = $derived.by(() => {
    visibilityUpdateCount;
    return visibilityManager.getGridVisibility();
  });

  const effectiveShowTKA = $derived.by(() => {
    visibilityUpdateCount;
    return showTKA !== undefined
      ? showTKA
      : visibilityManager.getGlyphVisibility("tkaGlyph");
  });

  const effectiveShowReversals = $derived.by(() => {
    visibilityUpdateCount;
    return showReversals !== undefined
      ? showReversals
      : visibilityManager.getGlyphVisibility("reversalIndicators");
  });

  const effectiveShowNonRadialPoints = $derived.by(() => {
    visibilityUpdateCount;
    return showNonRadialPoints !== undefined
      ? showNonRadialPoints
      : visibilityManager.getNonRadialVisibility();
  });

  // Extended glyph visibility
  const effectiveShowVTG = $derived.by(() => {
    visibilityUpdateCount;
    return showVTG !== undefined
      ? showVTG
      : visibilityManager.getGlyphVisibility("vtgGlyph");
  });

  const effectiveShowElemental = $derived.by(() => {
    visibilityUpdateCount;
    return showElemental !== undefined
      ? showElemental
      : visibilityManager.getGlyphVisibility("elementalGlyph");
  });

  const effectiveShowPositions = $derived.by(() => {
    visibilityUpdateCount;
    return showPositions !== undefined
      ? showPositions
      : visibilityManager.getGlyphVisibility("positionsGlyph");
  });

  // Hand point visibility mode
  const effectiveHandPointVisibility = $derived.by(() => {
    visibilityUpdateCount;
    return visibilityManager.getHandPointVisibility();
  });

  // Active locations (where props are positioned)
  // Extract from pictograph motion data - use endLocation for prop positioning
  const activeLocations = $derived.by(() => {
    if (!pictographData) return [];
    const locations: GridLocation[] = [];

    const blueMotion = pictographData.motions?.blue;
    const redMotion = pictographData.motions?.red;

    if (blueMotion?.endLocation) {
      locations.push(blueMotion.endLocation as GridLocation);
    }
    if (redMotion?.endLocation) {
      locations.push(redMotion.endLocation as GridLocation);
    }

    return locations;
  });

  // Prepared data state
  let preparedData = $state<PreparedPictographData | null>(null);
  let isLoading = $state(false);
  const preparer = container.items.pictographPreparer;

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
      // Include manual adjustments so arrow moves when adjusted
      manualAdjustX: redMotion.arrowPlacementData?.manualAdjustmentX ?? 0,
      manualAdjustY: redMotion.arrowPlacementData?.manualAdjustmentY ?? 0,
    } : null;

    // Use explicit overrides if provided, otherwise use global settings
    const effectiveBluePropType = bluePropTypeOverride ?? settings.bluePropType;
    const effectiveRedPropType = redPropTypeOverride ?? settings.redPropType;

    return JSON.stringify({
      id: pictographData.id,
      letter: pictographData.letter,
      bluePropType: effectiveBluePropType,
      redPropType: effectiveRedPropType,
      darkMode: effectiveDarkMode, // Include effective dark mode for color-correct preparation
      blueMotion: blueFingerprint,
      redMotion: redFingerprint,
      // Include explicit override flags so we re-prepare if they change
      hasExplicitBlueProp: bluePropTypeOverride !== undefined,
      hasExplicitRedProp: redPropTypeOverride !== undefined,
    });
  });

  // Prepare data when pictographData or settings change
  $effect(() => {
    const key = prepareKey;
    const data = pictographData;

    if (!data || !key) {
      preparedData = null;
      return;
    }

    // Use untrack for state mutations to avoid re-triggering
    let cancelled = false;

    (async () => {
      isLoading = true;
      try {
        // Always pass themeMode based on effectiveDarkMode for correct color selection
        // This ensures colors are correct whether dark mode is from prop (export) or global toggle (live)
        const currentDarkMode = effectiveDarkMode;
        // Pass explicit prop types to preparer for consistency during async rendering.
        // When provided, these are used directly; otherwise preparer falls back to global settings.
        const prepareOptions = {
          themeMode: currentDarkMode ? "dark" as const : "light" as const,
          bluePropType: bluePropTypeOverride,
          redPropType: redPropTypeOverride,
        };
        const result = await preparer.prepareSingle(data as PictographData, prepareOptions);
        if (!cancelled) {
          preparedData = result;
        }
      } catch (error) {
        console.error("Failed to prepare pictograph:", error);
        if (!cancelled) {
          preparedData = data as PreparedPictographData;
        }
      } finally {
        if (!cancelled) {
          isLoading = false;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  // Content key for fade transitions (when loading different pictographs)
  // CRITICAL: Do NOT include motion data - we want CSS animations for transforms
  // Only trigger fade when the pictograph itself changes (different id)
  const contentKey = $derived.by(() => {
    if (!pictographData) return "empty";
    // Just use id - transforms keep same id, loading different sequence changes id
    return pictographData.id || "no-id";
  });
</script>

<div class="pictograph-container" class:loading={isLoading}>
  {#if preparedData}
    {#if disableTransitions}
      <PictographRenderer
        pictograph={preparedData}
        {blueReversal}
        {redReversal}
        showGrid={effectiveShowGrid}
        showTKA={effectiveShowTKA}
        showReversals={effectiveShowReversals}
        showNonRadialPoints={effectiveShowNonRadialPoints}
        showVTG={effectiveShowVTG}
        showElemental={effectiveShowElemental}
        showPositions={effectiveShowPositions}
        handPointVisibility={effectiveHandPointVisibility}
        {activeLocations}
        {beatNumber}
        {showBeatNumber}
        {previewMode}
        gridModeOverride={overrideGridMode}
        {visibleHand}
        {arrowsClickable}
        darkMode={effectiveDarkMode}
        {onToggleTKA}
        {onToggleVTG}
        {onToggleElemental}
        {onTogglePositions}
        {onToggleReversals}
        {onToggleNonRadial}
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
            showVTG={effectiveShowVTG}
            showElemental={effectiveShowElemental}
            showPositions={effectiveShowPositions}
            handPointVisibility={effectiveHandPointVisibility}
            {activeLocations}
            {beatNumber}
            {showBeatNumber}
            {previewMode}
            gridModeOverride={overrideGridMode}
            {visibleHand}
            {arrowsClickable}
            darkMode={effectiveDarkMode}
            {onToggleTKA}
            {onToggleVTG}
            {onToggleElemental}
            {onTogglePositions}
            {onToggleReversals}
            {onToggleNonRadial}
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
  }

  .transition-wrapper {
    width: 100%;
    height: 100%;
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
