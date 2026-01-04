<script module>
  import { fade } from "svelte/transition";
</script>

<!--
PictographContainer.svelte - Smart pictograph wrapper

Handles:
- Visibility settings subscription
- Dark Mode subscription
- Settings reactivity (prop type changes)
- Transitions (fade in/out)
- Preparing raw data via PictographPreparer

Delegates rendering to PictographRenderer (the dumb primitive).

Usage:
  <PictographContainer pictographData={myData} />

For batch rendering (option picker), use PictographRenderer directly
with pre-prepared data for better performance.
-->

<script lang="ts">
  import { onMount } from "svelte";
  import { resolveAsync, TYPES } from "../../../inversify/di";
  import { getVisibilityStateManager } from "../state/visibility-state.svelte";
  import { getAnimationVisibilityManager } from "../../../animation-engine/state/animation-visibility-state.svelte";
  import { getSettings } from "../../../application/state/app-state.svelte";
  import type { IPictographPreparer } from "../services/contracts/IPictographPreparer";
  import type { PreparedPictographData } from "../domain/models/PreparedPictographData";
  import type { PictographData } from "../domain/models/PictographData";
  import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
  import { GridMode } from "../../grid/domain/enums/grid-enums";
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
    // Dark mode override (if undefined, uses global settings)
    darkMode: darkModeOverride = undefined,
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
    darkMode?: boolean;
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
  }>();

  // Extract beat context from BeatData if available
  const blueReversal = $derived((pictographData as any)?.blueReversal ?? false);
  const redReversal = $derived((pictographData as any)?.redReversal ?? false);
  const beatNumber = $derived((pictographData as any)?.beatNumber ?? null);
  const isStartPosition = $derived(beatNumber === 0);
  const showBeatNumber = $derived(beatNumber !== null && !isStartPosition);

  // Visibility managers
  const visibilityManager = getVisibilityStateManager();
  const animationVisibilityManager = getAnimationVisibilityManager();
  let visibilityUpdateCount = $state(0);

  function handleVisibilityChange() {
    visibilityUpdateCount++;
  }

  onMount(() => {
    visibilityManager.registerObserver(handleVisibilityChange);
    animationVisibilityManager.registerObserver(handleVisibilityChange);
    return () => {
      visibilityManager.unregisterObserver(handleVisibilityChange);
      animationVisibilityManager.unregisterObserver(handleVisibilityChange);
    };
  });

  // Effective visibility values
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

  const darkMode = $derived.by((): boolean => {
    visibilityUpdateCount;
    if (darkModeOverride !== undefined) return darkModeOverride;
    return animationVisibilityManager.isDarkMode();
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

  // Prepared data state
  let preparedData = $state<PreparedPictographData | null>(null);
  let isLoading = $state(false);
  let preparer: IPictographPreparer | null = null;

  // Create a stable key for data preparation dependencies
  // Include dark mode so props are re-prepared with correct colors when toggling
  const prepareKey = $derived.by(() => {
    if (!pictographData) return null;
    const settings = getSettings();
    return JSON.stringify({
      id: pictographData.id,
      letter: pictographData.letter,
      bluePropType: settings.bluePropType,
      redPropType: settings.redPropType,
      darkMode: darkMode, // Re-prepare when dark mode changes for correct prop colors
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
        if (!preparer) {
          preparer = await resolveAsync<IPictographPreparer>(
            TYPES.IPictographPreparer
          );
        }
        const result = await preparer.prepareSingle(data as PictographData);
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

  // Content key for transitions
  const contentKey = $derived.by(() => {
    if (!pictographData) return "empty";
    return JSON.stringify({
      id: pictographData.id,
      letter: pictographData.letter,
      blueMotion: pictographData.motions?.blue,
      redMotion: pictographData.motions?.red,
    });
  });
</script>

<div
  class="pictograph-container"
  class:loading={isLoading}
  class:dark-mode={darkMode}
>
  {#if preparedData}
    {#if disableTransitions}
      <PictographRenderer
        pictograph={preparedData}
        {blueReversal}
        {redReversal}
        {darkMode}
        showTKA={effectiveShowTKA}
        showReversals={effectiveShowReversals}
        showNonRadialPoints={effectiveShowNonRadialPoints}
        showVTG={effectiveShowVTG}
        showElemental={effectiveShowElemental}
        showPositions={effectiveShowPositions}
        {beatNumber}
        {showBeatNumber}
        {previewMode}
        gridModeOverride={overrideGridMode}
        {visibleHand}
        {arrowsClickable}
        {propsClickable}
        {selectedPropHand}
        {onPropClick}
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
            {darkMode}
            showTKA={effectiveShowTKA}
            showReversals={effectiveShowReversals}
            showNonRadialPoints={effectiveShowNonRadialPoints}
            showVTG={effectiveShowVTG}
            showElemental={effectiveShowElemental}
            showPositions={effectiveShowPositions}
            {beatNumber}
            {showBeatNumber}
            {previewMode}
            gridModeOverride={overrideGridMode}
            {visibleHand}
            {arrowsClickable}
            {propsClickable}
            {selectedPropHand}
            {onPropClick}
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
        <rect
          width="950"
          height="950"
          fill={darkMode ? "#0a0a0f" : "#f3f4f6"}
        />
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
