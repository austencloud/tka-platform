<!--
  VisualPane.svelte

  Visual settings:
  - Motion visibility (Blue/Red)
  - Element toggles (Grid, Props, Beat #, Glyph)
  - Trail presets (Off/Subtle/Vivid)
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
  import { isBilateralProp } from "$lib/shared/pictograph/prop/domain/enums/PropClassification";
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

  // Visibility state
  const visibilityManager = getAnimationVisibilityManager();
  let updateCounter = $state(0);
  let currentTrailStyle = $state<TrailStyle>(visibilityManager.getTrailStyle());

  // Derive trail style from actual animation settings (source of truth)
  function getTrailStyleFromSettings(): TrailStyle {
    const trail = animationSettings.trail;
    if (!trail.enabled || trail.mode === TrailMode.OFF) return "off";
    // Distinguish subtle vs vivid by line width and fade duration
    if ((trail.fadeDurationMs ?? 2000) <= 1800 && (trail.lineWidth ?? 3) < 3.5) {
      return "subtle";
    }
    return "vivid";
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
    const blue = bluePropType ?? propType;
    const red = redPropType ?? propType;
    const blueIsBilateral = blue != null && isBilateralProp(blue);
    const redIsBilateral = red != null && isBilateralProp(red);
    return (blueIsBilateral || redIsBilateral) && currentTrailStyle !== "off";
  });

  const isBothEnds = $derived(
    animationSettings.trail.trackingMode === TrackingMode.BOTH_ENDS
  );

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
  function getBeatNumbers() {
    updateCounter;
    return visibilityManager.getVisibility("beatNumbers");
  }
  function getTkaGlyph() {
    updateCounter;
    return visibilityManager.getVisibility("tkaGlyph");
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
  function toggleBeatNumbers() {
    const current = visibilityManager.getVisibility("beatNumbers");
    visibilityManager.setVisibility("beatNumbers", !current);
    updateCounter++;
  }
  function toggleTkaGlyph() {
    const current = visibilityManager.getVisibility("tkaGlyph");
    visibilityManager.setVisibility("tkaGlyph", !current);
    updateCounter++;
  }

  // Trail style handlers
  function setTrailStyle(style: TrailStyle) {
    visibilityManager.setTrailStyle(style);
    switch (style) {
      case "off":
        animationSettings.setTrailMode(TrailMode.OFF);
        break;
      case "subtle":
        animationSettings.setTrailMode(TrailMode.FADE);
        animationSettings.setFadeDuration(1500);
        animationSettings.setTrailAppearance({
          lineWidth: 2.5,
          maxOpacity: 0.7,
          glowEnabled: false,
        });
        break;
      case "vivid":
        animationSettings.setTrailMode(TrailMode.FADE);
        animationSettings.setFadeDuration(2500);
        animationSettings.setTrailAppearance({
          lineWidth: 4,
          maxOpacity: 0.95,
          glowEnabled: true,
        });
        break;
    }
    updateCounter++;
  }

  function toggleBothEnds() {
    const newMode = isBothEnds
      ? TrackingMode.RIGHT_END
      : TrackingMode.BOTH_ENDS;
    animationSettings.setTrackingMode(newMode);
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
      <i class="fas fa-border-all" aria-hidden="true"></i>
      <span>Grid</span>
    </button>
    <button
      class="element-btn"
      class:active={getProps()}
      onclick={toggleProps}
      type="button"
    >
      <i class="fas fa-circle" aria-hidden="true"></i>
      <span>Props</span>
    </button>
    <button
      class="element-btn"
      class:active={getBeatNumbers()}
      onclick={toggleBeatNumbers}
      type="button"
    >
      <i class="fas fa-hashtag" aria-hidden="true"></i>
      <span>#</span>
    </button>
    <button
      class="element-btn"
      class:active={getTkaGlyph()}
      onclick={toggleTkaGlyph}
      type="button"
      title="TKA Glyph includes turn numbers"
    >
      <i class="fas fa-font" aria-hidden="true"></i>
      <span>Glyph</span>
    </button>
  </div>

  <!-- Trail Presets -->
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
      class:active={currentTrailStyle === "subtle"}
      onclick={() => setTrailStyle("subtle")}
      type="button"
    >
      Subtle
    </button>
    <button
      class="trail-btn"
      class:active={currentTrailStyle === "vivid"}
      onclick={() => setTrailStyle("vivid")}
      type="button"
    >
      Vivid
    </button>
  </div>

  <!-- Ends Selector (for bilateral props) -->
  {#if showBothEndsToggle}
    <div class="ends-selector">
      <button
        class="ends-btn"
        class:active={!isBothEnds}
        onclick={() => isBothEnds && toggleBothEnds()}
        type="button"
      >
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
        <span>One End</span>
      </button>
      <button
        class="ends-btn"
        class:active={isBothEnds}
        onclick={() => !isBothEnds && toggleBothEnds()}
        type="button"
      >
        <i class="fas fa-arrows-alt-h" aria-hidden="true"></i>
        <span>Both Ends</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .visual-pane {
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: fadeSlideIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);
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
    transition: all 0.2s ease;
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
    transition: all 0.2s ease;
  }

  .element-btn i {
    font-size: 0.85rem;
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
    transition: all 0.2s ease;
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
    animation: fadeSlideIn 0.3s ease;
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
    transition: all 0.2s ease;
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
