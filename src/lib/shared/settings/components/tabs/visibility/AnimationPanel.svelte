<!--
  AnimationPanel.svelte

  Settings panel for animation visibility options.
  Includes grid mode, trail style, and overlay toggles.
-->
<script lang="ts">
  import { slide } from "svelte/transition";
  import AnimationPreviewController from "./AnimationPreviewController.svelte";
  import AnimationMobileControls from "./AnimationMobileControls.svelte";
  import AnimationDesktopControls from "./AnimationDesktopControls.svelte";
  import type {
    TrailVisibility,
    PlaybackMode,
  } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import {
    animationSettings,
    TrailMode,
    TrackingMode,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  interface Props {
    gridVisible: boolean;
    stepNumbersVisible: boolean;
    trailStyle: TrailVisibility;
    playbackMode: PlaybackMode;
    bpm: number;
    tkaGlyphVisible: boolean;
    wordHeaderVisible: boolean;
    fireEffectEnabled: boolean;
    ledEffectEnabled: boolean;
    colorBlend: number;
    smokeLevel: number;
    useCharcoal: boolean;
    fireIntensity: number;
    onColorBlendChange: (value: number) => void;
    onSmokeLevelChange: (value: number) => void;
    onUseCharcoalChange: (value: boolean) => void;
    onFireIntensityChange: (value: number) => void;
    onToggle: (key: string) => void;
    onTrailStyleChange: (style: string) => void;
    onPlaybackModeChange: (mode: PlaybackMode) => void;
    onBpmChange: (bpm: number) => void;
    isMobileHidden?: boolean;
  }

  let {
    gridVisible,
    stepNumbersVisible,
    trailStyle,
    playbackMode,
    bpm,
    tkaGlyphVisible,
    wordHeaderVisible,
    fireEffectEnabled,
    ledEffectEnabled,
    colorBlend,
    smokeLevel,
    useCharcoal,
    fireIntensity,
    onColorBlendChange,
    onSmokeLevelChange,
    onUseCharcoalChange,
    onFireIntensityChange,
    onToggle,
    onTrailStyleChange,
    onPlaybackModeChange,
    onBpmChange,
    isMobileHidden = false,
  }: Props = $props();

  let collapsed = $state(false);

  const bpmPresets = [30, 60, 90, 120];

  // Check if tracking both ends
  const isBothEnds = $derived(
    animationSettings.trail.trackingMode === TrackingMode.BOTH_ENDS
  );

  // Show bilateral toggle only when trails are enabled
  const showBilateralToggle = $derived(trailStyle !== "off");

  /**
   * Set trail on/off with hardcoded vivid settings when enabled
   */
  function setTrailPreset(preset: TrailVisibility) {
    onTrailStyleChange(preset);

    if (preset === "off") {
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
    <h3 class="panel-title">{t("visibility_animation")}</h3>
    <button
      class="collapse-toggle"
      onclick={() => (collapsed = !collapsed)}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand animation settings" : "Collapse animation settings"}
      type="button"
    >
      <i class="fas {collapsed ? 'fa-chevron-right' : 'fa-chevron-down'}" aria-hidden="true"></i>
    </button>
  </header>

  {#if !collapsed}
    <div class="panel-body" transition:slide={{ duration: 200 }}>
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
            {stepNumbersVisible}
            {tkaGlyphVisible}
            {wordHeaderVisible}
            {fireEffectEnabled}
            {ledEffectEnabled}
            {colorBlend}
            {smokeLevel}
            {useCharcoal}
            {fireIntensity}
            {onColorBlendChange}
            {onSmokeLevelChange}
            {onUseCharcoalChange}
            {onFireIntensityChange}
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
            {stepNumbersVisible}
            {tkaGlyphVisible}
            {wordHeaderVisible}
            {fireEffectEnabled}
            {ledEffectEnabled}
            {colorBlend}
            {smokeLevel}
            {useCharcoal}
            {fireIntensity}
            {onColorBlendChange}
            {onSmokeLevelChange}
            {onUseCharcoalChange}
            {onFireIntensityChange}
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
    </div>
  {/if}
</section>

<style>
  .settings-panel {
    container-type: inline-size;
    container-name: animation-panel;
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 2cqi, 16px);
    padding: clamp(12px, 2cqi, 20px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 20px;
    min-width: 0;
    min-height: var(--vt-panel-min-h, auto);
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
    flex-shrink: var(--vt-header-shrink, 1);
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
    transition: all var(--duration-fast) ease;
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
    max-width: 500px;
    box-shadow: inset 0 2px 8px var(--theme-shadow);
    min-height: var(--vt-preview-min-h, auto);
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
    flex-shrink: var(--vt-controls-shrink, 1);
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

  .panel-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(12px, 2cqi, 16px);
    width: 100%;
  }

  .collapse-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--theme-text-dim);
    cursor: pointer;
    border-radius: 6px;
    transition: all var(--duration-fast) ease;
    flex-shrink: 0;
  }

  .collapse-toggle:hover {
    background: color-mix(in srgb, var(--theme-text-dim) 15%, transparent);
    color: var(--theme-text);
  }

  .collapse-toggle:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    outline-offset: 2px;
  }

  @container animation-panel (min-width: 500px) {
    .panel-body {
      flex-direction: row;
      align-items: flex-start;
    }

    .preview-frame {
      flex-shrink: 0;
      width: 50%;
      max-width: 500px;
    }

    .panel-controls {
      flex: 1;
      margin-top: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .settings-panel,
    .collapse-toggle {
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
