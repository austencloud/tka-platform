<!--
StartPositionPicker.svelte - Simplified version with advanced variations
Shows 3 start positions (Alpha, Beta, Gamma) with toggle to view all 16 variations
Controls moved below the grid for better UX
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onMount } from "svelte";
  import { scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import {
    createSimplifiedStartPositionState,
    type SimplifiedStartPositionState,
  } from "$lib/shared/create/state/start-position-state.svelte";
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import AdvancedStartPositionPicker from "./AdvancedStartPositionPicker.svelte";
  import OrientationCycler from "./OrientationCycler.svelte";
  import PictographGrid from "./PictographGrid.svelte";

  // Local storage key for persisting picker preferences
  const STORAGE_KEY = "tka-start-position-picker-prefs";

  // Props - receive navigation callbacks and layout detection
  const {
    startPositionState,
    onNavigateToAdvanced,
    onNavigateToDefault,
    isSideBySideLayout = () => false,
  } = $props<{
    startPositionState?: SimplifiedStartPositionState | null;
    onNavigateToAdvanced?: () => void;
    onNavigateToDefault?: () => void;
    isSideBySideLayout?: () => boolean;
  }>();

  // Create simplified state - use $derived to handle prop changes
  const pickerState = $derived(
    startPositionState ?? createSimplifiedStartPositionState()
  );

  // State for showing advanced picker
  let showAdvancedPicker = $state(false);

  // Services
  let hapticService: HapticFeedback;

  // Load persisted preferences on mount
  onMount(() => {
    hapticService = getHapticFeedback();
    loadPersistedPreferences();

    // Always ensure positions are loaded - loadPersistedPreferences may
    // skip loadPositions if there are no stored prefs or no gridMode pref.
    if (pickerState.positions.length === 0 && !showAdvancedPicker) {
      void pickerState.loadPositions();
    }
  });

  /**
   * Load persisted picker preferences from localStorage
   */
  function loadPersistedPreferences() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const prefs = JSON.parse(stored) as {
        showAdvanced?: boolean;
        gridMode?: string;
        orientation?: string; // legacy single orientation
        blueOrientation?: string;
        redOrientation?: string;
      };

      // Restore advanced/simple view preference
      if (typeof prefs.showAdvanced === "boolean") {
        showAdvancedPicker = prefs.showAdvanced;
        if (showAdvancedPicker) {
          onNavigateToAdvanced?.();
        }
      }

      // Restore per-hand orientation preferences (with legacy fallback)
      const validOrientations = [Orientation.IN, Orientation.CLOCK, Orientation.OUT, Orientation.COUNTER] as string[];

      if (prefs.blueOrientation && validOrientations.includes(prefs.blueOrientation)) {
        void pickerState.setBlueOrientation(prefs.blueOrientation as Orientation);
      } else if (prefs.orientation && validOrientations.includes(prefs.orientation)) {
        // Legacy: single orientation applied to blue
        void pickerState.setBlueOrientation(prefs.orientation as Orientation);
      }

      if (prefs.redOrientation && validOrientations.includes(prefs.redOrientation)) {
        void pickerState.setRedOrientation(prefs.redOrientation as Orientation);
      } else if (prefs.orientation && validOrientations.includes(prefs.orientation)) {
        // Legacy: single orientation applied to red
        void pickerState.setRedOrientation(prefs.orientation as Orientation);
      }

      // Restore grid mode preference (Diamond/Box)
      if (prefs.gridMode === "DIAMOND" || prefs.gridMode === "BOX") {
        const mode =
          prefs.gridMode === "DIAMOND" ? GridMode.DIAMOND : GridMode.BOX;
        if (showAdvancedPicker) {
          void pickerState.loadAllVariations(mode);
        } else {
          void pickerState.loadPositions(mode);
        }
      }
    } catch (error) {
      console.warn("Failed to load start position picker preferences:", error);
    }
  }

  /**
   * Persist current preferences to localStorage
   */
  function persistPreferences() {
    try {
      const prefs = {
        showAdvanced: showAdvancedPicker,
        gridMode:
          pickerState.currentGridMode === GridMode.DIAMOND ? "DIAMOND" : "BOX",
        blueOrientation: pickerState.blueOrientation,
        redOrientation: pickerState.redOrientation,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (error) {
      console.warn(
        "Failed to persist start position picker preferences:",
        error
      );
    }
  }

  // Derived labels for action-oriented toggles
  const viewModeLabel = $derived(
    showAdvancedPicker ? "Simple" : "All Variations"
  );
  const gridModeLabel = $derived(
    pickerState.currentGridMode === GridMode.DIAMOND ? "Box" : "Diamond"
  );

  // Expose state for parent components
  export function isShowingAdvanced() {
    return showAdvancedPicker;
  }

  export function goBackToDefault() {
    handleBackToDefault();
  }

  // Handle position selection
  async function handlePositionSelect(position: PictographData) {
    hapticService?.trigger("selection");
    await pickerState.selectPosition(position);
  }

  // Handle toggle between simple and advanced
  function handleToggleView() {
    hapticService?.trigger("selection");

    if (!showAdvancedPicker) {
      showAdvancedPicker = true;
      pickerState.loadAllVariations(pickerState.currentGridMode);
      onNavigateToAdvanced?.();
    } else {
      showAdvancedPicker = false;
      onNavigateToDefault?.();
    }
    persistPreferences();
  }

  // Handle return to the default picker (exposed for external triggers)
  function handleBackToDefault() {
    hapticService?.trigger("selection");
    if (showAdvancedPicker) {
      handleToggleView();
    }
  }

  // Handle grid mode change
  async function handleGridModeToggle() {
    hapticService?.trigger("selection");
    const newMode =
      pickerState.currentGridMode === GridMode.DIAMOND
        ? GridMode.BOX
        : GridMode.DIAMOND;
    await pickerState.loadPositions(newMode);
    await pickerState.loadAllVariations(newMode);
    persistPreferences();
  }

  // Handle per-hand orientation changes from cyclers
  async function handleBlueOrientationChange(orientation: Orientation) {
    hapticService?.trigger("selection");
    await pickerState.setBlueOrientation(orientation);
    persistPreferences();
  }

  async function handleRedOrientationChange(orientation: Orientation) {
    hapticService?.trigger("selection");
    await pickerState.setRedOrientation(orientation);
    persistPreferences();
  }
</script>

<div class="start-pos-picker" data-testid="start-position-picker">
  <p class="workspace-hint">Choose your start position</p>

  <!-- Animated transition container - keyed on view mode only (grid mode animates in-place) -->
  <div class="picker-view">
    {#key showAdvancedPicker}
      <div
        class="picker-content"
        in:scale={{ start: 0.92, duration: 250, delay: 200, easing: cubicOut }}
        out:scale={{ start: 0.92, duration: 200, easing: cubicOut }}
      >
        {#if showAdvancedPicker}
          <!-- Advanced picker with all 16 variations -->
          <AdvancedStartPositionPicker
            pictographDataSet={pickerState.allVariations}
            selectedPictograph={pickerState.selectedPosition}
            currentGridMode={pickerState.currentGridMode}
            onPictographSelect={handlePositionSelect}
            {isSideBySideLayout}
          />
        {:else}
          <!-- Simple 3-position grid -->
          <div class="grid-container">
            <div class="grid-wrapper">
              <PictographGrid
                pictographDataSet={pickerState.positions}
                selectedPictograph={pickerState.selectedPosition}
                onPictographSelect={handlePositionSelect}
              />
            </div>
          </div>
        {/if}
      </div>
    {/key}
  </div>

  <!-- Controls Footer - below grid -->
  <div class="controls-footer">
    <div class="orientation-controls">
      <OrientationCycler
        orientation={pickerState.blueOrientation}
        onOrientationChange={handleBlueOrientationChange}
        color="blue"
      />

      <OrientationCycler
        orientation={pickerState.redOrientation}
        onOrientationChange={handleRedOrientationChange}
        color="red"
      />
    </div>

    <div class="mode-controls">
      <button
        class="control-button"
        onclick={handleToggleView}
        aria-label={`Show ${viewModeLabel}`}
      >
        <svg
          class="control-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          {#if showAdvancedPicker}
            <!-- Minimize icon -->
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" />
            <line x1="3" y1="21" x2="10" y2="14" />
          {:else}
            <!-- Grid/expand icon -->
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          {/if}
        </svg>
        <span class="control-label">{viewModeLabel}</span>
      </button>

      <button
        class="control-button"
        onclick={handleGridModeToggle}
        aria-label={`Switch to ${gridModeLabel} grid`}
      >
        <svg
          class="control-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          {#if pickerState.currentGridMode === GridMode.DIAMOND}
            <!-- Box icon -->
            <rect x="3" y="3" width="18" height="18" rx="2" />
          {:else}
            <!-- Diamond icon -->
            <polygon points="12 2 22 12 12 22 2 12" />
          {/if}
        </svg>
        <span class="control-label">{gridModeLabel}</span>
      </button>
    </div>
  </div>
</div>

<style>
  .start-pos-picker {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    min-height: 300px;
    position: relative;
    container-type: inline-size;
  }

  .workspace-hint {
    flex-shrink: 0;
    text-align: center;
    font-size: clamp(1rem, 2.5vmin, 1.25rem);
    font-weight: 500;
    color: var(--theme-text, #fff);
    padding: clamp(8px, 1.5vmin, 12px) 1rem;
    margin: 0;
    letter-spacing: 0.02em;
  }

  /* ============================================
     Picker View - Animated content area
     ============================================ */
  .picker-view {
    flex: 1;
    width: 100%;
    position: relative;
    min-height: 0;
    overflow: hidden;
  }

  /* Absolute positioning allows smooth crossfade without layout overlap */
  .picker-content {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
  }

  .grid-container {
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    container-type: size;
    padding: clamp(8px, 2vmin, 16px) clamp(16px, 4vmin, 40px);
    box-sizing: border-box;
  }

  .grid-wrapper {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    container-type: size;
    min-height: 0;
  }

  /* ============================================
     Controls Footer - wraps into two rows when narrow
     ============================================ */
  .controls-footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: clamp(8px, 2vmin, 16px);
    padding: clamp(8px, 2vmin, 16px) clamp(12px, 3vmin, 32px);
    background: transparent;
    flex-shrink: 0;
    max-width: 600px;
    margin: 0 auto;
    width: 100%;
  }

  .orientation-controls,
  .mode-controls {
    display: flex;
    align-items: stretch;
    gap: clamp(8px, 2vmin, 12px);
    width: 100%;
  }

  /* Make orientation cyclers stretch to fill their row equally */
  .orientation-controls :global(.orientation-cycler) {
    flex: 1;
  }

  .control-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 8px;

    /* Touch target */
    min-height: var(--min-touch-target, 48px);
    padding: 10px 16px;

    /* Theme-aware styling */
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 12px;

    /* Typography */
    font-size: var(--font-size-min);
    font-weight: 600;
    color: var(--theme-text, var(--theme-text));
    letter-spacing: 0.3px;
    white-space: nowrap;

    /* Interaction */
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;

    /* Smooth transitions */
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      transform 0.15s ease,
      box-shadow 0.2s ease;
  }

  .control-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    opacity: 0.8;
  }

  .control-label {
    white-space: nowrap;
  }

  /* Hover state */
  @media (hover: hover) {
    .control-button:hover {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px var(--theme-shadow, var(--theme-shadow));
    }

    .control-button:hover .control-icon {
      opacity: 1;
    }
  }

  /* Active/pressed state */
  .control-button:active {
    transform: translateY(0) scale(0.98);
    transition: transform var(--duration-instant) ease;
  }

  /* Focus state */
  .control-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .control-button {
      transition: none;
    }

    .control-button:hover {
      transform: none;
    }
  }

  /* Narrow container: compact buttons but keep labels */
  @container (max-width: 500px) {
    .control-button {
      padding: 8px 12px;
    }

    .control-icon {
      width: 16px;
      height: 16px;
    }
  }
</style>
