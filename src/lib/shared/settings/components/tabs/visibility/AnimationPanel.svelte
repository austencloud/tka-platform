<!--
  AnimationPanel.svelte

  Settings panel for animation visibility options.
  Includes grid mode, trail style, and overlay toggles.
-->
<script lang="ts">
  import AnimationPreviewController from "./AnimationPreviewController.svelte";
  import type {
    TrailStyle,
    PlaybackMode,
  } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import {
    animationSettings,
    TrailMode,
    TrackingMode,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";

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
   * Applies the correct appearance settings for each preset
   */
  function setTrailPreset(preset: TrailStyle) {
    // Notify parent of style change (updates visibility manager)
    onTrailStyleChange(preset);

    // Apply detailed trail appearance settings
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
    <h3 class="panel-title">Animation</h3>
  </header>

  <div class="preview-frame animation-preview">
    <AnimationPreviewController />
  </div>

  <div class="panel-controls">
    <!-- Mobile: Compact 2-column layout -->
    <div class="mobile-controls">
      <!-- Row 1: Playback mode -->
      <div class="mobile-row">
        <button
          class="compact-btn"
          class:active={playbackMode === "continuous"}
          onclick={() => onPlaybackModeChange("continuous")}
          type="button"
          aria-label="Continuous playback"
        >
          <i class="fas fa-wave-square" aria-hidden="true"></i>
          <span>Loop</span>
        </button>
        <button
          class="compact-btn"
          class:active={playbackMode === "step"}
          onclick={() => onPlaybackModeChange("step")}
          type="button"
          aria-label="Step playback"
        >
          <i class="fas fa-shoe-prints" aria-hidden="true"></i>
          <span>Step</span>
        </button>
      </div>

      <!-- Row 2: BPM -->
      <div class="mobile-row bpm-row">
        {#each bpmPresets as presetBpm}
          <button
            class="compact-btn bpm"
            class:active={bpm === presetBpm}
            onclick={() => onBpmChange(presetBpm)}
            type="button"
            aria-label="Set BPM to {presetBpm}"
          >
            {presetBpm}
          </button>
        {/each}
      </div>

      <!-- Row 3: Canvas + Overlay toggles -->
      <div class="mobile-row">
        <button
          class="compact-btn"
          class:active={gridVisible}
          onclick={() => onToggle("grid")}
          type="button"
        >
          <i class="fas fa-th" aria-hidden="true"></i>
          <span>Grid</span>
        </button>
        <button
          class="compact-btn"
          class:active={beatNumbersVisible}
          onclick={() => onToggle("beatNumbers")}
          type="button"
        >
          <i class="fas fa-hashtag" aria-hidden="true"></i>
          <span>Beat #</span>
        </button>
        <button
          class="compact-btn"
          class:active={tkaGlyphVisible}
          onclick={() => onToggle("tka")}
          type="button"
        >
          <i class="fas fa-font" aria-hidden="true"></i>
          <span>TKA</span>
        </button>
        <button
          class="compact-btn"
          class:active={wordHeaderVisible}
          onclick={() => onToggle("wordHeader")}
          type="button"
        >
          <i class="fas fa-heading" aria-hidden="true"></i>
          <span>Word</span>
        </button>
      </div>

      <!-- Row 4: Trails -->
      <div class="mobile-row trails-row">
        <button
          class="compact-btn trail"
          class:active={trailStyle === "off"}
          onclick={() => setTrailPreset("off")}
          type="button"
        >
          Off
        </button>
        <button
          class="compact-btn trail"
          class:active={trailStyle === "subtle"}
          onclick={() => setTrailPreset("subtle")}
          type="button"
        >
          Subtle
        </button>
        <button
          class="compact-btn trail"
          class:active={trailStyle === "vivid"}
          onclick={() => setTrailPreset("vivid")}
          type="button"
        >
          Vivid
        </button>
        {#if showBilateralToggle}
          <button
            class="compact-btn trail ends"
            class:active={isBothEnds}
            onclick={toggleBothEnds}
            type="button"
            title={isBothEnds ? "Trailing both ends" : "Trailing one end"}
          >
            <i
              class="fas {isBothEnds
                ? 'fa-arrows-alt-h'
                : 'fa-long-arrow-alt-right'}"
              aria-hidden="true"
            ></i>
          </button>
        {/if}
      </div>
    </div>

    <!-- Desktop: Original expanded layout -->
    <div class="desktop-controls">
      <div class="control-group">
        <span class="group-label">Playback</span>
        <div class="playback-mode-toggle">
          <button
            class="mode-btn"
            class:active={playbackMode === "continuous"}
            onclick={() => onPlaybackModeChange("continuous")}
            type="button"
            aria-label="Continuous playback"
          >
            <i class="fas fa-wave-square" aria-hidden="true"></i>
            <span>Continuous</span>
          </button>
          <button
            class="mode-btn"
            class:active={playbackMode === "step"}
            onclick={() => onPlaybackModeChange("step")}
            type="button"
            aria-label="Step playback"
          >
            <i class="fas fa-shoe-prints" aria-hidden="true"></i>
            <span>Step</span>
          </button>
        </div>
      </div>

      <div class="control-group">
        <span class="group-label">Speed (BPM)</span>
        <div class="bpm-presets">
          {#each bpmPresets as presetBpm}
            <button
              class="bpm-btn"
              class:active={bpm === presetBpm}
              onclick={() => onBpmChange(presetBpm)}
              type="button"
              aria-label="Set BPM to {presetBpm}"
            >
              {presetBpm}
            </button>
          {/each}
        </div>
      </div>

      <div class="control-group">
        <span class="group-label">Canvas</span>
        <div class="toggle-grid">
          <button
            class="toggle-btn"
            class:active={gridVisible}
            onclick={() => onToggle("grid")}>Grid</button
          >
          <button
            class="toggle-btn"
            class:active={beatNumbersVisible}
            onclick={() => onToggle("beatNumbers")}>Beat #s</button
          >
        </div>
      </div>

      <div class="control-group">
        <span class="group-label">Trails</span>
        <div class="trail-preset-row">
          <div class="preset-buttons">
            <button
              class="preset-btn"
              class:active={trailStyle === "off"}
              onclick={() => setTrailPreset("off")}
              type="button"
            >
              Off
            </button>
            <button
              class="preset-btn"
              class:active={trailStyle === "subtle"}
              onclick={() => setTrailPreset("subtle")}
              type="button"
            >
              Subtle
            </button>
            <button
              class="preset-btn"
              class:active={trailStyle === "vivid"}
              onclick={() => setTrailPreset("vivid")}
              type="button"
            >
              Vivid
            </button>
          </div>

          {#if showBilateralToggle}
            <button
              class="ends-toggle"
              class:active={isBothEnds}
              onclick={toggleBothEnds}
              type="button"
              title={isBothEnds ? "Trailing both ends" : "Trailing one end"}
            >
              <i
                class="fas {isBothEnds
                  ? 'fa-arrows-alt-h'
                  : 'fa-long-arrow-alt-right'}"
                aria-hidden="true"
              ></i>
              <span class="ends-label">{isBothEnds ? "Both" : "One"}</span>
            </button>
          {/if}
        </div>
      </div>

      <div class="control-group">
        <span class="group-label">Overlays</span>
        <div class="toggle-grid">
          <button
            class="toggle-btn"
            class:active={tkaGlyphVisible}
            onclick={() => onToggle("tka")}>TKA Glyph</button
          >
          <button
            class="toggle-btn"
            class:active={wordHeaderVisible}
            onclick={() => onToggle("wordHeader")}>Word</button
          >
        </div>
      </div>
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
    /* Take equal width but don't stretch height */
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
    /* Fixed size preview - don't grow */
    width: 100%;
    aspect-ratio: 1;
    max-width: 280px;
    box-shadow: inset 0 2px 8px var(--theme-shadow);
  }

  /* Constrain AnimatorCanvas to square within the preview frame */
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
    /* Push controls to bottom when panel is stretched */
    margin-top: auto;
  }

  /* Mobile/Desktop control visibility - use width to detect layout */
  .mobile-controls {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.5cqi, 10px);
    width: 100%;
  }

  .desktop-controls {
    display: none;
  }

  /* Desktop: Show expanded layout when panel is wide (side-by-side mode) */
  @container animation-panel (min-width: 320px) {
    .mobile-controls {
      display: none;
    }
    .desktop-controls {
      display: flex;
      flex-direction: column;
      gap: clamp(6px, 1.5cqi, 10px);
      width: 100%;
    }
  }

  /* Mobile compact button rows */
  .mobile-row {
    display: flex;
    gap: clamp(4px, 1cqi, 8px);
    width: 100%;
  }

  .compact-btn {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 1cqi, 6px);
    min-height: 44px; /* WCAG touch target */
    padding: clamp(10px, 2cqi, 14px) clamp(6px, 1cqi, 10px);
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    border: 1px solid var(--theme-stroke);
    border-radius: clamp(8px, 1.5cqi, 12px);
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 600;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    cursor: pointer;
    transition: all 150ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .compact-btn i {
    font-size: 12px;
  }

  .compact-btn span {
    white-space: nowrap;
  }

  .compact-btn:active {
    transform: scale(0.95);
    transition-duration: 50ms;
  }

  .compact-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 45%, transparent);
    color: white;
    box-shadow: 0 2px 8px
      color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  /* BPM buttons - narrower */
  .compact-btn.bpm {
    padding: 8px 4px;
    font-variant-numeric: tabular-nums;
  }

  .compact-btn.bpm.active {
    background: color-mix(in srgb, var(--theme-accent-strong) 25%, transparent);
    border-color: color-mix(
      in srgb,
      var(--theme-accent-strong) 45%,
      transparent
    );
  }

  /* Trail buttons */
  .compact-btn.trail {
    flex: 1;
  }

  .compact-btn.trail.ends {
    flex: 0 0 48px;
    padding: 8px;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: clamp(4px, 1cqi, 6px);
  }

  .group-label {
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    padding-left: 2px;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    line-height: 1.2;
  }

  .toggle-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: clamp(4px, 1cqi, 8px);
  }

  .playback-mode-toggle {
    display: flex;
    gap: clamp(4px, 1cqi, 8px);
  }

  .mode-btn {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 1cqi, 8px);
    min-height: 44px; /* WCAG touch target */
    padding: clamp(8px, 1.5cqi, 12px) clamp(10px, 2cqi, 14px);
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    border: 1px solid var(--theme-stroke);
    border-radius: clamp(8px, 1.5cqi, 12px);
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 600;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    cursor: pointer;
    transition: all 150ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .mode-btn i {
    font-size: var(--font-size-sm);
  }

  .mode-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
    transform: translateY(-1px);
  }

  .mode-btn:active {
    transform: translateY(0) scale(0.97);
    transition-duration: 50ms;
  }

  .mode-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 45%, transparent);
    color: white;
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--theme-accent) 15%, transparent),
      0 4px 12px color-mix(in srgb, var(--theme-accent) 25%, transparent);
  }

  .mode-btn.active:hover {
    background: color-mix(in srgb, var(--theme-accent) 35%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 55%, transparent);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--theme-accent) 20%, transparent),
      0 4px 16px color-mix(in srgb, var(--theme-accent) 35%, transparent);
  }

  .mode-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    outline-offset: 2px;
  }

  .bpm-presets {
    display: flex;
    gap: clamp(4px, 1cqi, 8px);
  }

  .bpm-btn {
    flex: 1;
    min-height: 44px; /* WCAG touch target */
    padding: clamp(8px, 1.5cqi, 12px) clamp(6px, 1.5cqi, 8px);
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    border: 1px solid var(--theme-stroke);
    border-radius: clamp(8px, 1.5cqi, 12px);
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    cursor: pointer;
    transition: all 150ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .bpm-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
    transform: translateY(-1px);
  }

  .bpm-btn:active {
    transform: translateY(0) scale(0.97);
    transition-duration: 50ms;
  }

  .bpm-btn.active {
    background: color-mix(in srgb, var(--theme-accent-strong) 25%, transparent);
    border-color: color-mix(
      in srgb,
      var(--theme-accent-strong) 45%,
      transparent
    );
    color: white;
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--theme-accent-strong) 15%, transparent),
      0 4px 12px color-mix(in srgb, var(--theme-accent-strong) 25%, transparent);
  }

  .bpm-btn.active:hover {
    background: color-mix(in srgb, #8b5cf6 35%, transparent);
    border-color: color-mix(
      in srgb,
      var(--theme-accent-strong) 55%,
      transparent
    );
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--theme-accent-strong) 20%, transparent),
      0 4px 16px color-mix(in srgb, var(--theme-accent-strong) 35%, transparent);
  }

  .bpm-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, #8b5cf6 50%, transparent);
    outline-offset: 2px;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px; /* WCAG touch target */
    padding: clamp(8px, 1.5cqi, 12px) clamp(8px, 1.5cqi, 10px);
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    border: 1px solid var(--theme-stroke);
    border-radius: clamp(8px, 1.5cqi, 12px);
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 600;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    cursor: pointer;
    transition: all 150ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .toggle-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
    transform: translateY(-1px);
  }

  .toggle-btn:active {
    transform: translateY(0) scale(0.97);
    transition-duration: 50ms;
  }

  .toggle-btn.active {
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 25%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 45%,
      transparent
    );
    color: white;
    box-shadow:
      0 0 0 1px
        color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 15%,
          transparent
        ),
      0 4px 12px
        color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 25%,
          transparent
        );
  }

  .toggle-btn.active:hover {
    background: color-mix(in srgb, var(--theme-accent) 35%, transparent);
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 55%,
      transparent
    );
    box-shadow:
      0 0 0 1px
        color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 20%,
          transparent
        ),
      0 4px 16px
        color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 35%,
          transparent
        );
  }

  .toggle-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    outline-offset: 2px;
  }

  /* Trail Preset Controls */
  .trail-preset-row {
    display: flex;
    align-items: center;
    gap: clamp(4px, 1cqi, 8px);
  }

  .preset-buttons {
    display: flex;
    gap: clamp(4px, 1cqi, 6px);
    flex: 1;
  }

  .preset-btn {
    flex: 1;
    min-height: 44px; /* WCAG touch target */
    padding: clamp(8px, 1.5cqi, 12px) clamp(8px, 1.5cqi, 10px);
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    border: 1px solid var(--theme-stroke);
    border-radius: clamp(8px, 1.5cqi, 12px);
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 600;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    cursor: pointer;
    transition: all 150ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .preset-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
    transform: translateY(-1px);
  }

  .preset-btn:active {
    transform: translateY(0) scale(0.97);
    transition-duration: 50ms;
  }

  .preset-btn.active {
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 25%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 45%,
      transparent
    );
    color: white;
    box-shadow:
      0 0 0 1px
        color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 15%,
          transparent
        ),
      0 4px 12px
        color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 25%,
          transparent
        );
  }

  .preset-btn.active:hover {
    background: color-mix(in srgb, var(--theme-accent) 35%, transparent);
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 55%,
      transparent
    );
    box-shadow:
      0 0 0 1px
        color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 20%,
          transparent
        ),
      0 4px 16px
        color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 35%,
          transparent
        );
  }

  .preset-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    outline-offset: 2px;
  }

  /* Ends Toggle Button */
  .ends-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 1cqi, 6px);
    min-height: 44px; /* WCAG touch target */
    padding: clamp(8px, 1.5cqi, 12px) clamp(10px, 2cqi, 14px);
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    border: 1px solid var(--theme-stroke);
    border-radius: clamp(8px, 1.5cqi, 12px);
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 600;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    cursor: pointer;
    transition: all 150ms ease;
    -webkit-tap-highlight-color: transparent;
    white-space: nowrap;
  }

  .ends-toggle i {
    font-size: var(--font-size-sm);
  }

  .ends-label {
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .ends-toggle:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
    transform: translateY(-1px);
  }

  .ends-toggle:active {
    transform: translateY(0) scale(0.97);
    transition-duration: 50ms;
  }

  .ends-toggle.active {
    background: color-mix(in srgb, var(--theme-accent-strong) 25%, transparent);
    border-color: color-mix(
      in srgb,
      var(--theme-accent-strong) 45%,
      transparent
    );
    color: white;
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--theme-accent-strong) 15%, transparent),
      0 4px 12px color-mix(in srgb, var(--theme-accent-strong) 25%, transparent);
  }

  .ends-toggle.active:hover {
    background: color-mix(in srgb, var(--theme-accent-strong) 35%, transparent);
    border-color: color-mix(
      in srgb,
      var(--theme-accent-strong) 55%,
      transparent
    );
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--theme-accent-strong) 20%, transparent),
      0 4px 16px color-mix(in srgb, var(--theme-accent-strong) 35%, transparent);
  }

  .ends-toggle:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--theme-accent-strong) 50%, transparent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .settings-panel,
    .toggle-btn,
    .mode-btn,
    .bpm-btn,
    .preset-btn,
    .ends-toggle {
      transition: none;
    }
  }

  @media (prefers-contrast: high) {
    .toggle-btn,
    .mode-btn,
    .bpm-btn,
    .preset-btn,
    .ends-toggle,
    .settings-panel {
      border-width: 2px;
    }

    .toggle-btn.active,
    .preset-btn.active {
      border-color: var(--theme-accent, var(--theme-accent));
    }

    .mode-btn.active {
      border-color: var(--theme-accent);
    }

    .bpm-btn.active,
    .ends-toggle.active {
      border-color: var(--theme-accent-strong);
    }

    .toggle-btn:focus-visible,
    .mode-btn:focus-visible,
    .bpm-btn:focus-visible,
    .preset-btn:focus-visible,
    .ends-toggle:focus-visible {
      outline-width: 3px;
    }
  }

  /* Compact width adjustments */
  @container animation-panel (max-width: 280px) {
    .panel-header {
      gap: 6px;
    }

    .panel-icon {
      width: 24px;
      height: 24px;
    }

    .group-label {
      font-size: 10px;
      letter-spacing: 0.3px;
    }

    .ends-label {
      display: none;
    }
  }
</style>
