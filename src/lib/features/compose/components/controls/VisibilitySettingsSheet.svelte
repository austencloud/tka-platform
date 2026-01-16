<!--
  VisibilitySettingsSheet.svelte

  Visual settings sheet with uniform button heights.
  Sections: Motion (1 row), Elements (3 rows), Trails (1 row)
  Uses flex proportional to row count for uniform sizing.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import {
    getAnimationVisibilityManager,
    type GridMode,
    type TrailStyle,
  } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import {
    animationSettings,
    TrailMode,
    TrackingMode,
    TrailEffect,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { isBilateralProp } from "$lib/shared/pictograph/prop/domain/enums/PropClassification";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

  let {
    isOpen = $bindable(false),
    propType = null,
    bluePropType = null,
    redPropType = null,
  }: {
    isOpen: boolean;
    propType?: PropType | string | null;
    bluePropType?: PropType | string | null;
    redPropType?: PropType | string | null;
  } = $props();

  const visibilityManager = getAnimationVisibilityManager();

  // Reactive counter for forcing re-renders
  let updateCounter = $state(0);

  // Trail style state - synced with visibility manager
  let currentTrailStyle = $state<TrailStyle>(visibilityManager.getTrailStyle());

  // Register observer for trail style changes
  onMount(() => {
    const handleChange = () => {
      currentTrailStyle = visibilityManager.getTrailStyle();
      updateCounter++;
    };
    visibilityManager.registerObserver(handleChange);
    return () => visibilityManager.unregisterObserver(handleChange);
  });

  // Check if either prop is bilateral (for "both ends" toggle)
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

  // Getter functions with reactive dependency
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

  function getDarkMode() {
    updateCounter;
    return visibilityManager.isDarkMode();
  }

  // Toggle handlers
  function toggleGrid() {
    const currentMode = visibilityManager.getGridMode();
    const newMode: GridMode = currentMode === "none" ? "diamond" : "none";
    visibilityManager.setGridMode(newMode);
    updateCounter++;
  }

  function toggleBlueMotion() {
    const current = visibilityManager.getVisibility("blueMotion");
    visibilityManager.setVisibility("blueMotion", !current);
    updateCounter++;
  }

  function toggleRedMotion() {
    const current = visibilityManager.getVisibility("redMotion");
    visibilityManager.setVisibility("redMotion", !current);
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

  function toggleDarkMode() {
    const current = visibilityManager.isDarkMode();
    visibilityManager.setDarkMode(!current);

    // When enabling Dark Mode, auto-enable neon trail effect
    if (!current) {
      animationSettings.setTrailEffect(TrailEffect.NEON);
      // Also enable trails if currently off
      if (currentTrailStyle === "off") {
        setTrailStyle("on");
      }
    } else {
      // When disabling, go back to standard glow
      animationSettings.setTrailEffect(TrailEffect.GLOW);
    }

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

  function toggleBothEnds() {
    const newMode = isBothEnds
      ? TrackingMode.RIGHT_END
      : TrackingMode.BOTH_ENDS;
    animationSettings.setTrackingMode(newMode);
    updateCounter++;
  }
</script>

<Drawer
  bind:isOpen
  placement="right"
  respectLayoutMode={true}
  closeOnBackdrop={true}
  closeOnEscape={true}
  ariaLabel="Visual Settings"
  showHandle={true}
  class="visibility-settings-sheet"
>
  <div class="sheet-content">
    <header class="sheet-header">
      <h3 class="sheet-title">Visual Settings</h3>
      <button
        class="sheet-close-btn"
        onclick={() => (isOpen = false)}
        aria-label="Close"
        type="button"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </header>

    <div class="sheet-body">
      <!-- Motion Section: 1 row, flex: 1 -->
      <section class="settings-section motion-section">
        <h4 class="section-title">Motion</h4>
        <div class="button-row">
          <button
            class="chip-btn blue"
            class:active={getBlueMotion()}
            onclick={toggleBlueMotion}
            type="button"
          >
            Blue
          </button>
          <button
            class="chip-btn red"
            class:active={getRedMotion()}
            onclick={toggleRedMotion}
            type="button"
          >
            Red
          </button>
        </div>
      </section>

      <!-- Elements Section: 3 rows (6 buttons in 2-col grid), flex: 3 -->
      <section class="settings-section elements-section">
        <h4 class="section-title">Elements</h4>
        <div class="button-grid">
          <button
            class="chip-btn grid-btn"
            class:active={getGridEnabled()}
            onclick={toggleGrid}
            type="button"
          >
            Grid
          </button>
          <button
            class="chip-btn props-btn"
            class:active={getProps()}
            onclick={toggleProps}
            type="button"
          >
            Props
          </button>
          <button
            class="chip-btn beat-btn"
            class:active={getBeatNumbers()}
            onclick={toggleBeatNumbers}
            type="button"
          >
            Beat #
          </button>
          <button
            class="chip-btn glyph-btn"
            class:active={getTkaGlyph()}
            onclick={toggleTkaGlyph}
            type="button"
            title="TKA Glyph includes turn numbers"
          >
            Glyph
          </button>
          <button
            class="chip-btn led-btn"
            class:active={getDarkMode()}
            onclick={toggleDarkMode}
            type="button"
            title="Dark Mode: Dark background"
          >
            <i class="fas fa-lightbulb" aria-hidden="true"></i>
            Dark
          </button>
        </div>
      </section>

      <!-- Trails Section: 1 row, flex: 1 -->
      <section class="settings-section trails-section">
        <h4 class="section-title">Trails</h4>
        <div class="button-row trails-row">
          <button
            class="chip-btn trail-off"
            class:active={currentTrailStyle === "off"}
            onclick={() => setTrailStyle("off")}
            type="button"
          >
            Off
          </button>
          <button
            class="chip-btn trail-on"
            class:active={currentTrailStyle === "on"}
            onclick={() => setTrailStyle("on")}
            type="button"
          >
            On
          </button>
        </div>

        {#if showBothEndsToggle}
          <button
            class="ends-toggle"
            class:active={isBothEnds}
            onclick={toggleBothEnds}
            type="button"
          >
            {isBothEnds ? "Both Ends" : "One End"}
          </button>
        {/if}
      </section>
    </div>
  </div>
</Drawer>

<style>
  :global(.visibility-settings-sheet) {
    --sheet-width: min(320px, 85vw);
  }

  :global(.drawer-content.visibility-settings-sheet) {
    bottom: 0 !important;
    max-height: 100dvh !important;
    border-radius: 16px 0 0 16px !important;
  }

  .sheet-content {
    display: flex;
    flex-direction: column;
    padding: 16px;
    min-width: 280px;
    height: 100%;
    background: var(--theme-panel-elevated-bg);
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid var(--theme-stroke);
    margin-bottom: 16px;
    flex-shrink: 0;
  }

  .sheet-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-text);
    margin: 0;
  }

  .sheet-close-btn {
    width: 48px; /* WCAG AAA touch target */
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    background: var(--theme-card-bg, var(--theme-card-bg));
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .sheet-close-btn:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, var(--theme-text));
  }

  .sheet-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }

  /* Sections with flex proportional to rows */
  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Motion: 1 row = flex: 1 */
  .motion-section {
    flex: 1;
    min-height: 0;
  }

  /* Elements: 3 rows = flex: 3 */
  .elements-section {
    flex: 3;
    min-height: 0;
  }

  /* Trails: 1 row = flex: 1 */
  .trails-section {
    flex: 1;
    min-height: 0;
  }

  .section-title {
    font-size: var(--font-size-compact);
    font-weight: 700;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0;
    flex-shrink: 0;
  }

  /* Button containers fill available space */
  .button-row {
    display: flex;
    gap: 10px;
    flex: 1;
    min-height: 0;
  }

  .button-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr 1fr;
    gap: 10px;
    flex: 1;
    min-height: 0;
  }

  .trails-row {
    gap: 8px;
  }

  /* Chip Button Base - Text Only */
  .chip-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-height: 50px;
    padding: 12px 16px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    color: var(--theme-text-dim);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  /* Blue motion active */
  .chip-btn.blue.active {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.5);
    color: rgba(147, 197, 253, 1);
  }

  /* Red motion active */
  .chip-btn.red.active {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
    color: rgba(252, 165, 165, 1);
  }

  /* Grid - cyan/teal accent */
  .chip-btn.grid-btn.active {
    background: rgba(20, 184, 166, 0.2);
    border-color: rgba(20, 184, 166, 0.5);
    color: rgba(94, 234, 212, 1);
  }

  /* Props - orange accent */
  .chip-btn.props-btn.active {
    background: rgba(249, 115, 22, 0.2);
    border-color: rgba(249, 115, 22, 0.5);
    color: rgba(253, 186, 116, 1);
  }

  /* Beat numbers - yellow accent */
  .chip-btn.beat-btn.active {
    background: rgba(234, 179, 8, 0.2);
    border-color: rgba(234, 179, 8, 0.5);
    color: rgba(253, 224, 71, 1);
  }

  /* Glyph - purple accent */
  .chip-btn.glyph-btn.active {
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(168, 85, 247, 0.5);
    color: rgba(216, 180, 254, 1);
  }

  /* Dark Mode button - electric cyan/neon accent */
  .chip-btn.led-btn {
    gap: 6px;
  }

  .chip-btn.led-btn.active {
    background: rgba(0, 255, 255, 0.15);
    border-color: rgba(0, 255, 255, 0.6);
    color: rgba(0, 255, 255, 1);
    box-shadow: 0 0 12px rgba(0, 255, 255, 0.3);
  }

  /* Trail Off - gray accent */
  .chip-btn.trail-off.active {
    background: rgba(107, 114, 128, 0.2);
    border-color: rgba(107, 114, 128, 0.5);
    color: rgba(209, 213, 219, 1);
  }

  /* Trail On - amber/fire accent */
  .chip-btn.trail-on.active {
    background: rgba(245, 158, 11, 0.2);
    border-color: rgba(245, 158, 11, 0.5);
    color: rgba(253, 230, 138, 1);
  }

  /* Both Ends Toggle */
  .ends-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 8px 16px;
    margin-top: 8px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 10px;
    color: var(--theme-text-dim);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .ends-toggle.active {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.5);
    color: rgba(196, 181, 253, 1);
  }

  @media (hover: hover) and (pointer: fine) {
    .chip-btn:hover:not(.active),
    .ends-toggle:hover:not(.active) {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
      color: var(--theme-text);
    }
  }

  .chip-btn:active,
  .ends-toggle:active {
    transform: scale(0.97);
  }
</style>
