<!--
StartPositionPicker.svelte - Simplified version with advanced variations
Shows 3 start positions (Alpha, Beta, Gamma) with toggle to view all 16 variations
Controls moved below the grid for better UX
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onDestroy, onMount } from "svelte";
  import { scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import {
    createSimplifiedStartPositionState,
    type SimplifiedStartPositionState,
  } from "$lib/shared/create/state/start-position-state.svelte";
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import AdvancedStartPositionPicker from "./AdvancedStartPositionPicker.svelte";
  import BuildStartPosition from "./BuildStartPosition.svelte";
  import OrientationCycler from "./OrientationCycler.svelte";
  import PictographGrid from "./PictographGrid.svelte";
  import {
    logConstructStartPositionCancelled,
    logConstructStartPositionPath,
    type StartPositionPath,
  } from "../../services/construct-analytics";

  // The guest "New here? Show me how" chip was removed: it only ever rendered
  // in the exact window the create-tutorial prompt was already on screen (both
  // gated on the same not-yet-decided state), so it was pure duplicate noise on
  // a first-run mobile view. Replaying the guided build lives in Settings.

  // Local storage key for persisting picker preferences
  const STORAGE_KEY = "tka-start-position-picker-prefs";
  const START_POSITION_PATHS = [
    { value: "presets" as const, label: "Presets" },
    { value: "build" as const, label: "Build" },
  ];

  // Props - receive navigation callbacks and layout detection
  const {
    startPositionState,
    onNavigateToAdvanced,
    onNavigateToDefault,
    isSideBySideLayout = () => false,
    embedded = false,
    bluePropTypeOverride = undefined,
    redPropTypeOverride = undefined,
    initialStartPosition = null,
    lockedGridMode = undefined,
    validationMessage = null,
    onPositionSubmitted = () => {},
  } = $props<{
    startPositionState?: SimplifiedStartPositionState | null;
    onNavigateToAdvanced?: () => void;
    onNavigateToDefault?: () => void;
    isSideBySideLayout?: () => boolean;
    // When rendered inside another surface (e.g. the create tutorial), that
    // surface owns the heading and the "show me how" entry point. Suppress the
    // picker's own hint + guide link so they don't duplicate — and so the guide
    // link can't replay the very tutorial it sits inside.
    embedded?: boolean;
    /** Explicit prop types for demo/preview rendering (bypasses global
     *  settings) — same convention as StepCell/PictographContainer. */
    bluePropTypeOverride?: PropType;
    redPropTypeOverride?: PropType;
    initialStartPosition?: PictographData | null;
    lockedGridMode?: GridMode;
    validationMessage?: string | null;
    onPositionSubmitted?: (
      position: PictographData,
      path: StartPositionPath
    ) => void;
  }>();

  // Create simplified state - use $derived to handle prop changes
  const pickerState = $derived(
    startPositionState ?? createSimplifiedStartPositionState()
  );

  // State for showing advanced picker
  let showAdvancedPicker = $state(false);
  let pickerPath = $state<StartPositionPath>("presets");
  let buildPathOpened = false;
  let buildPositionSubmitted = false;

  const effectiveBluePropType = $derived(
    bluePropTypeOverride ??
      settingsService.settings.bluePropType ??
      PropType.STAFF
  );
  const effectiveRedPropType = $derived(
    redPropTypeOverride ??
      settingsService.settings.redPropType ??
      PropType.STAFF
  );
  const initialBlueLocation = $derived(
    initialStartPosition?.motions.blue?.startLocation ?? null
  );
  const initialRedLocation = $derived(
    initialStartPosition?.motions.red?.startLocation ?? null
  );

  // Services
  let hapticService: HapticFeedback;

  // Load persisted preferences on mount
  onMount(() => {
    hapticService = getHapticFeedback();
    loadPersistedPreferences();

    if (
      lockedGridMode !== undefined &&
      pickerState.currentGridMode !== lockedGridMode
    ) {
      void pickerState.loadPositions(lockedGridMode);
    }

    const initialBlueOrientation =
      initialStartPosition?.motions.blue?.startOrientation;
    const initialRedOrientation =
      initialStartPosition?.motions.red?.startOrientation;
    if (initialBlueOrientation) {
      void pickerState.setBlueOrientation(initialBlueOrientation);
    }
    if (initialRedOrientation) {
      void pickerState.setRedOrientation(initialRedOrientation);
    }

    // Always ensure positions are loaded - loadPersistedPreferences may
    // skip loadPositions if there are no stored prefs or no gridMode pref.
    if (pickerState.positions.length === 0 && !showAdvancedPicker) {
      void pickerState.loadPositions();
    }

    if (pickerPath === "build") {
      buildPathOpened = true;
    }
  });

  onDestroy(() => {
    if (pickerPath === "build" && buildPathOpened && !buildPositionSubmitted) {
      logConstructStartPositionCancelled("build");
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
        pickerPath?: StartPositionPath;
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

      if (prefs.pickerPath === "presets" || prefs.pickerPath === "build") {
        pickerPath = prefs.pickerPath;
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
        pickerPath,
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
    const submittedPath = pickerPath;
    if (submittedPath === "build") {
      buildPositionSubmitted = true;
    }
    onPositionSubmitted(position, submittedPath);
    await pickerState.selectPosition(position);
  }

  function handlePathChange(path: StartPositionPath) {
    hapticService?.trigger("selection");
    if (
      pickerPath === "build" &&
      path !== "build" &&
      buildPathOpened &&
      !buildPositionSubmitted
    ) {
      logConstructStartPositionCancelled("build");
    }
    if (path === "build") {
      buildPathOpened = true;
      buildPositionSubmitted = false;
    }
    pickerPath = path;
    logConstructStartPositionPath(path);
    persistPreferences();
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

<!-- The build path is vertically hungry in a way the preset grid is not: it has
     a square board plus its own controls, where Presets has three cards and
     slack to spare. The heading band and footer padding shrink for it. -->
<div
  class="start-pos-picker"
  class:build-path={pickerPath === "build"}
  data-testid="start-position-picker"
>
  {#if !embedded}
    <p class="workspace-hint">Choose your start position</p>
  {/if}

  <div class="path-selector">
    <SegmentedControl
      options={START_POSITION_PATHS}
      value={pickerPath}
      onchange={handlePathChange}
      color="accent"
      size="sm"
      ariaLabel="Start position method"
    />
  </div>

  {#if validationMessage}
    <p class="validation-message" role="alert">{validationMessage}</p>
  {/if}

  <!-- Path/view changes crossfade; grid mode still updates in place. -->
  <div class="picker-view">
    {#key `${pickerPath}-${showAdvancedPicker}`}
      <div
        class="picker-content"
        in:scale={{ start: 0.92, duration: 250, delay: 200, easing: cubicOut }}
        out:scale={{ start: 0.92, duration: 200, easing: cubicOut }}
      >
        {#if pickerPath === "build"}
          <BuildStartPosition
            gridMode={pickerState.currentGridMode}
            bluePropType={effectiveBluePropType}
            redPropType={effectiveRedPropType}
            blueOrientation={pickerState.blueOrientation}
            redOrientation={pickerState.redOrientation}
            {initialBlueLocation}
            {initialRedLocation}
            onBlueOrientationChange={handleBlueOrientationChange}
            onRedOrientationChange={handleRedOrientationChange}
            onApply={handlePositionSelect}
          />
        {:else if showAdvancedPicker}
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
                {bluePropTypeOverride}
                {redPropTypeOverride}
              />
            </div>
          </div>
        {/if}
      </div>
    {/key}
  </div>

  <!-- Controls Footer - below grid (hidden when embedded, e.g. the create tutorial) -->
  {#if !embedded}
  <div class="controls-footer">
    {#if pickerPath === "presets"}
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
    {/if}

    <div class="mode-controls">
      {#if pickerPath === "presets"}
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
      {/if}

      {#if lockedGridMode === undefined}
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
      {/if}
    </div>
  </div>
  {/if}
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
    /* Drop the hint off the top edge into the whitespace above the grid. Kept
       modest (vh-bounded) on purpose: reserving a large band here shrinks the
       grid container and flips PictographGrid's aspect-ratio rule from column
       to row on tall screens (Fold). */
    margin: 0;
    padding: clamp(20px, 9vh, 80px) 1rem 0;
    /* Match the Generate tab hint exactly: Playfair serif, soft shadow, one line.
       cqi tracks .start-pos-picker's width (container-type: inline-size) so the
       line scales to fit and never wraps. */
    font-family: "Playfair Display", Georgia, serif;
    font-size: clamp(1rem, 4.6cqi, 2rem);
    font-weight: 500;
    line-height: 1.2;
    letter-spacing: 0.02em;
    white-space: nowrap;
    color: var(--theme-text, #fff);
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
  }

  /* Presets can afford the deep band above the heading; Build spends that same
     height on the board someone is aiming at. Bounded by vh so it only tightens
     where the screen is actually short. */
  .start-pos-picker.build-path .workspace-hint {
    padding-top: clamp(12px, 3vh, 36px);
  }

  /* A phone in portrait has no spare band at all — the heading sits right at
     the top and everything it isn't using goes to the board. */
  @media (max-height: 780px) {
    .start-pos-picker.build-path .workspace-hint {
      padding-top: 6px;
      font-size: clamp(0.95rem, 4.2cqi, 1.5rem);
    }

    .start-pos-picker.build-path .path-selector {
      margin-top: 6px;
      margin-bottom: 0;
    }
  }

  .start-pos-picker.build-path .controls-footer {
    padding-block: 8px;
  }

  .path-selector {
    flex-shrink: 0;
    width: min(calc(100% - 24px), 360px);
    margin: 10px auto 4px;
  }

  .validation-message {
    flex: 0 0 auto;
    width: min(calc(100% - 24px), 520px);
    margin: 4px auto 0;
    padding: 8px 12px;
    box-sizing: border-box;
    border: 1px solid color-mix(in srgb, var(--theme-danger) 62%, transparent);
    border-radius: 10px;
    background: color-mix(
      in srgb,
      var(--theme-danger) 12%,
      var(--theme-card-bg)
    );
    color: var(--theme-text);
    font-size: var(--font-size-min, 14px);
    line-height: 1.35;
    text-align: center;
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

  /* Big-screen tiers at the documented 1680 seam (.claude/rules/4k-native-layout.md).
     Without these the picker is a phone column marooned in a 4K field: a 2rem
     heading and a 360px method toggle read as postage stamps across the room,
     which is the exact "scaled-up phone layout" this codebase keeps fixing. */
  @media (min-width: 1680px) {
    .workspace-hint {
      font-size: clamp(2rem, 2.2vw, 3rem);
      padding-top: clamp(20px, 5vh, 52px);
    }

    .path-selector {
      width: min(calc(100% - 24px), 32rem);
      margin-top: 1rem;
    }

    .controls-footer {
      max-width: 64rem;
      gap: 1rem;
    }

    .control-button {
      min-height: 3.5rem;
      font-size: 1.05rem;
    }

    .control-icon {
      width: 22px;
      height: 22px;
    }
  }

  @media (min-width: 2600px) {
    .workspace-hint {
      font-size: clamp(3rem, 2vw, 4.25rem);
    }

    .path-selector {
      width: min(calc(100% - 24px), 44rem);
    }

    .controls-footer {
      max-width: 84rem;
    }

    .control-button {
      min-height: 4.5rem;
      font-size: 1.4rem;
      border-radius: 16px;
    }

    .control-icon {
      width: 28px;
      height: 28px;
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
