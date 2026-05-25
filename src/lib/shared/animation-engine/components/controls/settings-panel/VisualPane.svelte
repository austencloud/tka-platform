<!--
  VisualPane.svelte

  Visual settings:
  - Element toggles (Grid, Props, Beat #, Glyph)
  - Trail toggle (Off/On - hardcoded vivid style when on)
  - Ends selector (One End/Both Ends) - for bilateral props
-->
<script lang="ts">
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { onMount } from "svelte";
  import {
    getAnimationVisibilityManager,
    type GridMode,
    type TrailVisibility,
  } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import {
    animationSettings,
    TrailMode,
    TrackingMode,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { isBilateralProp, getBilateralEndLabels } from "$lib/shared/pictograph/prop/domain/enums/PropClassification";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

  let {
    propType = null,
    bluePropType = null,
    redPropType = null,
  }: {
    propType?: PropType | string | null;
    bluePropType?: PropType | string | null;
    redPropType?: PropType | string | null;
  } = $props();

  const settingsState = settingsService;

  // Fall back to user's global settings when props not explicitly provided
  const effectiveBluePropType = $derived(
    bluePropType ?? propType ?? settingsState.settings.bluePropType ?? null
  );
  const effectiveRedPropType = $derived(
    redPropType ?? propType ?? settingsState.settings.redPropType ?? null
  );

  // Visibility state
  const visibilityManager = getAnimationVisibilityManager();
  let updateCounter = $state(0);
  function isTrailsActive(): boolean {
    const tipMap = visibilityManager.effectsConfigState?.tipEffectMap ?? {};
    return Object.values(tipMap).some(a => a.effect === "trails");
  }
  let currentTrailStyle = $state<TrailVisibility>(isTrailsActive() ? "on" : "off");

  onMount(() => {
    const handleChange = () => {
      currentTrailStyle = isTrailsActive() ? "on" : "off";
      updateCounter++;
    };
    visibilityManager.registerObserver(handleChange);
    return () => visibilityManager.unregisterObserver(handleChange);
  });

  // Both ends toggle for bilateral props
  const showBothEndsToggle = $derived.by(() => {
    const blueIsBilateral = effectiveBluePropType != null && isBilateralProp(effectiveBluePropType);
    const redIsBilateral = effectiveRedPropType != null && isBilateralProp(effectiveRedPropType);
    return (blueIsBilateral || redIsBilateral) && currentTrailStyle !== "off";
  });

  const isBothEnds = $derived(
    animationSettings.trail.trackingMode === TrackingMode.BOTH_ENDS
  );

  const isLeftEnd = $derived(
    animationSettings.trail.trackingMode === TrackingMode.LEFT_END
  );

  const isRightEnd = $derived(
    animationSettings.trail.trackingMode === TrackingMode.RIGHT_END
  );

  // Get prop-specific labels for the ends (e.g., "Thumb"/"Pinky" for staff)
  const endLabels = $derived.by(() => {
    // Use whichever prop is bilateral for the labels
    const propToCheck = effectiveBluePropType ?? effectiveRedPropType;
    if (propToCheck && isBilateralProp(propToCheck)) {
      return getBilateralEndLabels(propToCheck);
    }
    return ["End 1", "End 2"];
  });

  // Visibility getters (trigger on updateCounter)
  function getGridEnabled() {
    updateCounter;
    return visibilityManager.getGridMode() !== "none";
  }
  function getProps() {
    updateCounter;
    return visibilityManager.getVisibility("props");
  }
  function getStepNumbers() {
    updateCounter;
    return visibilityManager.getVisibility("stepNumbers");
  }
  function getTkaGlyph() {
    updateCounter;
    return visibilityManager.getVisibility("tkaGlyph");
  }
  function getWordHeader() {
    updateCounter;
    return visibilityManager.getVisibility("wordHeader");
  }
  function getProgressBar() {
    updateCounter;
    return visibilityManager.getVisibility("progressBar");
  }

  // Toggle handlers
  function toggleGrid() {
    const currentMode = visibilityManager.getGridMode();
    const newMode: GridMode = currentMode === "none" ? "8point" : "none";
    visibilityManager.setGridMode(newMode);
    updateCounter++;
  }
  function toggleProps() {
    const current = visibilityManager.getVisibility("props");
    visibilityManager.setVisibility("props", !current);
    updateCounter++;
  }
  function toggleStepNumbers() {
    const current = visibilityManager.getVisibility("stepNumbers");
    visibilityManager.setVisibility("stepNumbers", !current);
    updateCounter++;
  }
  function toggleTkaGlyph() {
    const current = visibilityManager.getVisibility("tkaGlyph");
    visibilityManager.setVisibility("tkaGlyph", !current);
    updateCounter++;
  }
  function toggleWordHeader() {
    const current = visibilityManager.getVisibility("wordHeader");
    visibilityManager.setVisibility("wordHeader", !current);
    updateCounter++;
  }
  function toggleProgressBar() {
    const current = visibilityManager.getVisibility("progressBar");
    visibilityManager.setVisibility("progressBar", !current);
    updateCounter++;
  }

  function toggleTrails(style: TrailVisibility) {
    visibilityManager.setActiveEffect(style === "on" ? "trails" : "none");
    if (style === "off") {
      animationSettings.setTrailMode(TrailMode.OFF);
    } else {
      // "on" - use hardcoded vivid settings
      animationSettings.setTrailMode(TrailMode.FADE);
      animationSettings.setFadeDuration(2500);
      animationSettings.setTrailAppearance({
        lineWidth: 3.5,
        maxOpacity: 0.95,
      });
    }
    updateCounter++;
  }

  function setTrackingMode(mode: TrackingMode) {
    animationSettings.setTrackingMode(mode);
    updateCounter++;
  }
</script>

<div class="visual-pane">
  <!-- Element Toggles -->
  <div class="element-grid">
    <button
      class="element-btn"
      class:active={getGridEnabled()}
      onclick={toggleGrid}
      type="button"
      aria-label={getGridEnabled() ? "Hide grid" : "Show grid"}
      aria-pressed={getGridEnabled()}
    >
      <span>Grid</span>
    </button>
    <button
      class="element-btn"
      class:active={getProps()}
      onclick={toggleProps}
      type="button"
      aria-label={getProps() ? "Hide props" : "Show props"}
      aria-pressed={getProps()}
    >
      <span>Props</span>
    </button>
    <button
      class="element-btn"
      class:active={getStepNumbers()}
      onclick={toggleStepNumbers}
      type="button"
      aria-label={getStepNumbers() ? "Hide step numbers" : "Show step numbers"}
      aria-pressed={getStepNumbers()}
    >
      <span>Beat #</span>
    </button>
    <button
      class="element-btn"
      class:active={getTkaGlyph()}
      onclick={toggleTkaGlyph}
      type="button"
      title="TKA Glyph includes turn numbers"
      aria-label={getTkaGlyph() ? "Hide TKA glyph" : "Show TKA glyph"}
      aria-pressed={getTkaGlyph()}
    >
      <span>Glyph</span>
    </button>
    <button
      class="element-btn"
      class:active={getWordHeader()}
      onclick={toggleWordHeader}
      type="button"
      title="Word header above animation"
      aria-label={getWordHeader() ? "Hide word header" : "Show word header"}
      aria-pressed={getWordHeader()}
    >
      <span>Word</span>
    </button>
    <button
      class="element-btn"
      class:active={getProgressBar()}
      onclick={toggleProgressBar}
      type="button"
      title="Progress bar in word header"
      aria-label={getProgressBar() ? "Hide progress bar" : "Show progress bar"}
      aria-pressed={getProgressBar()}
    >
      <span>Progress</span>
    </button>
  </div>

  <!-- Trail Toggle -->
  <div class="trail-presets">
    <button
      class="trail-btn"
      class:active={currentTrailStyle === "off"}
      onclick={() => toggleTrails("off")}
      type="button"
      aria-label="Turn trails off"
      aria-pressed={currentTrailStyle === "off"}
    >
      Off
    </button>
    <button
      class="trail-btn"
      class:active={currentTrailStyle === "on"}
      onclick={() => toggleTrails("on")}
      type="button"
      aria-label="Turn trails on"
      aria-pressed={currentTrailStyle === "on"}
    >
      On
    </button>
  </div>

  <!-- Ends Selector (for bilateral props) -->
  {#if showBothEndsToggle}
    <div class="ends-selector">
      <button
        class="ends-btn"
        class:active={isLeftEnd}
        onclick={() => setTrackingMode(TrackingMode.LEFT_END)}
        type="button"
        title="Track {endLabels[0]} end only"
        aria-label="Track {endLabels[0]} end only"
        aria-pressed={isLeftEnd}
      >
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span>{endLabels[0]}</span>
      </button>
      <button
        class="ends-btn both"
        class:active={isBothEnds}
        onclick={() => setTrackingMode(TrackingMode.BOTH_ENDS)}
        type="button"
        title="Track both ends"
        aria-label="Track both ends"
        aria-pressed={isBothEnds}
      >
        <i class="fas fa-arrows-alt-h" aria-hidden="true"></i>
        <span>Both</span>
      </button>
      <button
        class="ends-btn"
        class:active={isRightEnd}
        onclick={() => setTrackingMode(TrackingMode.RIGHT_END)}
        type="button"
        title="Track {endLabels[1]} end only"
        aria-label="Track {endLabels[1]} end only"
        aria-pressed={isRightEnd}
      >
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
        <span>{endLabels[1]}</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .visual-pane {
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: fadeSlideIn var(--duration-dramatic) cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes fadeSlideIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Element Grid */
  .element-grid {
    display: flex;
    gap: 6px;
  }

  .element-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--min-touch-target);
    padding: 8px 6px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .element-btn.active {
    background: var(--theme-accent);
    border-color: var(--theme-accent);
    color: white;
  }

  @media (hover: hover) and (pointer: fine) {
    .element-btn:hover:not(.active) {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
      color: var(--theme-text);
    }
  }

  /* Trail Presets */
  .trail-presets {
    display: flex;
    gap: 6px;
  }

  .trail-btn {
    flex: 1;
    min-height: var(--min-touch-target);
    padding: 8px 10px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .trail-btn.active {
    background: var(--theme-accent);
    border-color: var(--theme-accent);
    color: white;
  }

  @media (hover: hover) and (pointer: fine) {
    .trail-btn:hover:not(.active) {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
      color: var(--theme-text);
    }
  }

  /* Ends Selector */
  .ends-selector {
    display: flex;
    gap: 6px;
    animation: fadeSlideIn var(--duration-emphasis) ease;
  }

  .ends-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--min-touch-target);
    padding: 8px 10px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .ends-btn.active {
    background: var(--theme-accent);
    border-color: var(--theme-accent);
    color: white;
  }

  @media (hover: hover) and (pointer: fine) {
    .ends-btn:hover:not(.active) {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
      color: var(--theme-text);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .visual-pane,
    .ends-selector {
      animation: none;
    }
  }
</style>
