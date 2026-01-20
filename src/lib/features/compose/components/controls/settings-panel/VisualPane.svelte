<!--
  VisualPane.svelte

  Visual settings:
  - Motion visibility (Blue/Red)
  - Element toggles (Grid, Props, Beat #, Glyph)
  - Trail toggle (Off/On - hardcoded vivid style when on)
  - Ends selector (One End/Both Ends) - for bilateral props
-->
<script lang="ts">
  import { onMount } from "svelte";
  import {
    getAnimationVisibilityManager,
    type GridMode,
    type TrailStyle,
  } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import {
    animationSettings,
    TrailMode,
    TrackingMode,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { isBilateralProp, getBilateralEndLabels } from "$lib/shared/pictograph/prop/domain/enums/PropClassification";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";

  let {
    propType = null,
    bluePropType = null,
    redPropType = null,
  }: {
    propType?: PropType | string | null;
    bluePropType?: PropType | string | null;
    redPropType?: PropType | string | null;
  } = $props();

  // Fall back to user's global settings when props not explicitly provided
  const effectiveBluePropType = $derived(
    bluePropType ?? propType ?? settingsService.settings.bluePropType ?? null
  );
  const effectiveRedPropType = $derived(
    redPropType ?? propType ?? settingsService.settings.redPropType ?? null
  );

  // Visibility state
  const visibilityManager = getAnimationVisibilityManager();
  let updateCounter = $state(0);
  let currentTrailStyle = $state<TrailStyle>(visibilityManager.getTrailStyle());

  // Derive trail style from actual animation settings (source of truth)
  function getTrailStyleFromSettings(): TrailStyle {
    const trail = animationSettings.trail;
    if (!trail.enabled || trail.mode === TrailMode.OFF) return "off";
    return "on";
  }

  onMount(() => {
    // Sync initial state: animationSettings is source of truth for actual behavior
    // visibilityManager may be out of sync if persisted separately
    const derivedStyle = getTrailStyleFromSettings();
    if (derivedStyle !== visibilityManager.getTrailStyle()) {
      visibilityManager.setTrailStyle(derivedStyle);
      currentTrailStyle = derivedStyle;
    }

    const handleChange = () => {
      currentTrailStyle = visibilityManager.getTrailStyle();
      updateCounter++;
    };
    visibilityManager.registerObserver(handleChange);
    return () => visibilityManager.unregisterObserver(handleChange);
  });

  // Show Blue/Red toggles only when Props is visible
  const showMotionToggles = $derived.by(() => {
    updateCounter; // trigger reactivity
    return visibilityManager.getVisibility("props");
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
  function getBlueMotion() {
    updateCounter;
    return visibilityManager.getVisibility("blueMotion");
  }
  function getRedMotion() {
    updateCounter;
    return visibilityManager.getVisibility("redMotion");
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
    const newMode: GridMode = currentMode === "none" ? "diamond" : "none";
    visibilityManager.setGridMode(newMode);
    updateCounter++;
  }
  function toggleBlueMotion() {
    const blueOn = visibilityManager.getVisibility("blueMotion");
    const redOn = visibilityManager.getVisibility("redMotion");

    // If trying to turn off the last active one, turn the other on instead
    if (blueOn && !redOn) {
      visibilityManager.setVisibility("redMotion", true);
    }
    visibilityManager.setVisibility("blueMotion", !blueOn);
    updateCounter++;
  }
  function toggleRedMotion() {
    const blueOn = visibilityManager.getVisibility("blueMotion");
    const redOn = visibilityManager.getVisibility("redMotion");

    // If trying to turn off the last active one, turn the other on instead
    if (redOn && !blueOn) {
      visibilityManager.setVisibility("blueMotion", true);
    }
    visibilityManager.setVisibility("redMotion", !redOn);
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

  // Trail on/off handler with hardcoded vivid settings when enabled
  function setTrailStyle(style: TrailStyle) {
    visibilityManager.setTrailStyle(style);
    if (style === "off") {
      animationSettings.setTrailMode(TrailMode.OFF);
    } else {
      // "on" - use hardcoded vivid settings
      animationSettings.setTrailMode(TrailMode.FADE);
      animationSettings.setFadeDuration(2500);
      animationSettings.setTrailAppearance({
        lineWidth: 3.5,
        maxOpacity: 0.95,
        glowEnabled: true,
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
  <!-- Motion Visibility (only when Props is on) -->
  {#if showMotionToggles}
    <div class="motion-toggles">
      <button
        class="motion-btn blue"
        class:active={getBlueMotion()}
        onclick={toggleBlueMotion}
        type="button"
      >
        <i class="fas fa-eye{getBlueMotion() ? '' : '-slash'}" aria-hidden="true"
        ></i>
        <span>Blue</span>
      </button>
      <button
        class="motion-btn red"
        class:active={getRedMotion()}
        onclick={toggleRedMotion}
        type="button"
      >
        <i class="fas fa-eye{getRedMotion() ? '' : '-slash'}" aria-hidden="true"
        ></i>
        <span>Red</span>
      </button>
    </div>
  {/if}

  <!-- Element Toggles -->
  <div class="element-grid">
    <button
      class="element-btn"
      class:active={getGridEnabled()}
      onclick={toggleGrid}
      type="button"
    >
      <span>Grid</span>
    </button>
    <button
      class="element-btn"
      class:active={getProps()}
      onclick={toggleProps}
      type="button"
    >
      <span>Props</span>
    </button>
    <button
      class="element-btn"
      class:active={getStepNumbers()}
      onclick={toggleStepNumbers}
      type="button"
    >
      <span>Beat #</span>
    </button>
    <button
      class="element-btn"
      class:active={getTkaGlyph()}
      onclick={toggleTkaGlyph}
      type="button"
      title="TKA Glyph includes turn numbers"
    >
      <span>Glyph</span>
    </button>
    <button
      class="element-btn"
      class:active={getWordHeader()}
      onclick={toggleWordHeader}
      type="button"
      title="Word header above animation"
    >
      <span>Word</span>
    </button>
    <button
      class="element-btn"
      class:active={getProgressBar()}
      onclick={toggleProgressBar}
      type="button"
      title="Progress bar in word header"
    >
      <span>Progress</span>
    </button>
  </div>

  <!-- Trail Toggle -->
  <div class="trail-presets">
    <button
      class="trail-btn"
      class:active={currentTrailStyle === "off"}
      onclick={() => setTrailStyle("off")}
      type="button"
    >
      Off
    </button>
    <button
      class="trail-btn"
      class:active={currentTrailStyle === "on"}
      onclick={() => setTrailStyle("on")}
      type="button"
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

  /* Motion Toggles */
  .motion-toggles {
    display: flex;
    gap: 6px;
  }

  .motion-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--min-touch-target);
    padding: 8px 12px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text-dim);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .motion-btn.blue.active {
    background: var(--prop-blue, rgba(59, 130, 246, 0.8));
    border-color: var(--prop-blue, rgba(59, 130, 246, 1));
    color: white;
  }

  .motion-btn.red.active {
    background: var(--prop-red, rgba(239, 68, 68, 0.8));
    border-color: var(--prop-red, rgba(239, 68, 68, 1));
    color: white;
  }

  @media (hover: hover) and (pointer: fine) {
    .motion-btn:hover:not(.active) {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
      color: var(--theme-text);
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
    font-size: 0.75rem;
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
    font-size: 0.8rem;
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
    font-size: 0.8rem;
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
