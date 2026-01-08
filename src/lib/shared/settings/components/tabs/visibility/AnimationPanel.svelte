<!--
  AnimationPanel.svelte

  Settings panel for animation visibility options.
  Includes grid mode, trail style, and overlay toggles.
-->
<script lang="ts">
  import AnimationPreviewController from "./AnimationPreviewController.svelte";
  import AnimationMobileControls from "./AnimationMobileControls.svelte";
  import AnimationDesktopControls from "./AnimationDesktopControls.svelte";
  import type {
    TrailStyle,
    PlaybackMode,
  } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import {
    animationSettings,
    TrailMode,
    TrackingMode,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import * as m from "$lib/paraglide/messages.js";

  interface Props {
    gridVisible: boolean;
    beatNumbersVisible: boolean;
    trailStyle: TrailStyle;
    playbackMode: PlaybackMode;
    bpm: number;
    tkaGlyphVisible: boolean;
    wordHeaderVisible: boolean;
    onToggle: (key: string) => void;
    onTrailStyleChange: (style: string) => void;
    onPlaybackModeChange: (mode: PlaybackMode) => void;
    onBpmChange: (bpm: number) => void;
    isMobileHidden?: boolean;
  }

  let {
    gridVisible,
    beatNumbersVisible,
    trailStyle,
    playbackMode,
    bpm,
    tkaGlyphVisible,
    wordHeaderVisible,
    onToggle,
    onTrailStyleChange,
    onPlaybackModeChange,
    onBpmChange,
    isMobileHidden = false,
  }: Props = $props();

  const bpmPresets = [30, 60, 90, 120];

  // Check if tracking both ends
  const isBothEnds = $derived(
    animationSettings.trail.trackingMode === TrackingMode.BOTH_ENDS
  );

  // Show bilateral toggle only when trails are enabled
  const showBilateralToggle = $derived(trailStyle !== "off");

  /**
   * Set trail preset with detailed settings
   */
  function setTrailPreset(preset: TrailStyle) {
    onTrailStyleChange(preset);

    switch (preset) {
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
  }

  function toggleBothEnds() {
    const newMode = isBothEnds
      ? TrackingMode.RIGHT_END
      : TrackingMode.BOTH_ENDS;
    animationSettings.setTrackingMode(newMode);
  }
</script>

<section
  class="settings-panel animation-panel"
  class:mobile-hidden={isMobileHidden}
>
  <header class="panel-header">
    <span class="panel-icon animation-icon">
      <i class="fas fa-film" aria-hidden="true"></i>
    </span>
    <h3 class="panel-title">{m.visibility_animation()}</h3>
  </header>

  <div class="preview-frame animation-preview">
    <AnimationPreviewController />
  </div>

  <div class="panel-controls">
    <!-- Mobile: Compact layout (below 320px) -->
    <div class="mobile-layout">
      <AnimationMobileControls
        {playbackMode}
        {bpm}
        {bpmPresets}
        {gridVisible}
        {beatNumbersVisible}
        {tkaGlyphVisible}
        {wordHeaderVisible}
        {trailStyle}
        {showBilateralToggle}
        {isBothEnds}
        {onPlaybackModeChange}
        {onBpmChange}
        {onToggle}
        onTrailPreset={setTrailPreset}
        onToggleBothEnds={toggleBothEnds}
      />
    </div>

    <!-- Desktop: Expanded layout (320px+) -->
    <div class="desktop-layout">
      <AnimationDesktopControls
        {playbackMode}
        {bpm}
        {bpmPresets}
        {gridVisible}
        {beatNumbersVisible}
        {tkaGlyphVisible}
        {wordHeaderVisible}
        {trailStyle}
        {showBilateralToggle}
        {isBothEnds}
        {onPlaybackModeChange}
        {onBpmChange}
        {onToggle}
        onTrailPreset={setTrailPreset}
        onToggleBothEnds={toggleBothEnds}
      />
    </div>
  </div>
</section>

<style>
  .settings-panel {
    container-type: inline-size;
    container-name: animation-panel;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(12px, 2cqi, 16px);
    padding: clamp(12px, 2cqi, 20px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 20px;
    flex: 1 1 0;
    min-width: 0;
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      transform 0.2s ease;
  }

  .settings-panel:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    transform: translateY(-1px);
  }

  .settings-panel.mobile-hidden {
    display: none;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.5cqi, 10px);
    width: 100%;
  }

  .panel-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(26px, 8cqi, 32px);
    height: clamp(26px, 8cqi, 32px);
    border-radius: clamp(6px, 2cqi, 8px);
    font-size: var(--font-size-sm);
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .panel-icon.animation-icon {
    --icon-color: #f472b6;
    background: color-mix(in srgb, var(--icon-color) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--icon-color) 35%, transparent);
    color: var(--icon-color);
    box-shadow: 0 0 8px color-mix(in srgb, var(--icon-color) 15%, transparent);
  }

  .settings-panel:hover .panel-icon {
    box-shadow: 0 0 12px color-mix(in srgb, var(--icon-color) 25%, transparent);
  }

  .panel-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
    margin: 0;
    white-space: nowrap;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    flex: 1;
  }

  .preview-frame {
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--theme-panel-bg) 80%, transparent);
    border-radius: clamp(10px, 2cqi, 14px);
    border: 1px solid var(--theme-stroke);
    overflow: hidden;
    width: 100%;
    aspect-ratio: 1;
    max-width: 280px;
    box-shadow: inset 0 2px 8px var(--theme-shadow);
  }

  .preview-frame :global(.canvas-wrapper) {
    height: auto !important;
    width: 100%;
    max-height: 100%;
    aspect-ratio: 1;
  }

  .panel-controls {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2cqi, 12px);
    width: 100%;
    margin-top: auto;
  }

  /* Mobile/Desktop layout switching via container query */
  .mobile-layout {
    display: block;
  }

  .desktop-layout {
    display: none;
  }

  @container animation-panel (min-width: 320px) {
    .mobile-layout {
      display: none;
    }
    .desktop-layout {
      display: block;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .settings-panel {
      transition: none;
    }
  }

  @media (prefers-contrast: high) {
    .settings-panel {
      border-width: 2px;
    }
  }

  @container animation-panel (max-width: 280px) {
    .panel-header {
      gap: 6px;
    }

    .panel-icon {
      width: 24px;
      height: 24px;
    }
  }
</style>
