<!--
  AnimationPanel.svelte

  Settings panel for controlling animation playback, speed, canvas overlays,
  trails, and visibility toggles. Shows a live animation preview alongside
  the controls so changes are immediately visible.
-->
<script lang="ts">
  import type { TrailVisibility, PlaybackMode } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { animationSettings, TrailMode, TrackingMode } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";

  interface Props {
    gridMode: string;
    stepNumbersVisible: boolean;
    armsVisible: boolean;
    propsVisible: boolean;
    pathLinesVisible: boolean;
    trailStyle: TrailVisibility;
    playbackMode: PlaybackMode;
    bpm: number;
    tkaGlyphVisible: boolean;
    wordHeaderVisible: boolean;
    progressBarVisible: boolean;
    onToggle: (key: string) => void;
    onTrailStyleChange: (style: TrailVisibility) => void;
    onPlaybackModeChange: (mode: PlaybackMode) => void;
    onBpmChange: (bpm: number) => void;
    isMobileHidden?: boolean;
  }

  let {
    gridMode,
    stepNumbersVisible,
    armsVisible,
    propsVisible,
    pathLinesVisible,
    trailStyle,
    playbackMode,
    bpm,
    tkaGlyphVisible,
    wordHeaderVisible,
    progressBarVisible,
    onToggle,
    onTrailStyleChange,
    onPlaybackModeChange,
    onBpmChange,
    isMobileHidden = false,
  }: Props = $props();

  // Trail "Both Ends" toggle - reads live from animationSettings reactive state
  const trailsOn = $derived(trailStyle !== "off");
  const bothEnds = $derived(
    animationSettings.trail.trackingMode === TrackingMode.BOTH_ENDS
  );

  /**
   * Toggle trails on/off. When turning on, apply default vivid appearance
   * so the trail looks good out of the box.
   */
  function toggleTrails() {
    const next: TrailVisibility = trailStyle === "off" ? "on" : "off";
    onTrailStyleChange(next);
    if (next === "on") {
      animationSettings.setTrailMode(TrailMode.FADE);
      animationSettings.setFadeDuration(2500);
      animationSettings.setTrailAppearance({ lineWidth: 4, maxOpacity: 0.95 });
    } else {
      animationSettings.setTrailMode(TrailMode.OFF);
    }
  }

  /**
   * Toggle whether trails track both prop ends or just one.
   */
  function toggleBothEnds() {
    const next =
      animationSettings.trail.trackingMode === TrackingMode.BOTH_ENDS
        ? TrackingMode.RIGHT_END
        : TrackingMode.BOTH_ENDS;
    animationSettings.setTrackingMode(next);
  }

  const BPM_PRESETS = [30, 60, 90, 120] as const;
</script>

<section
  class="settings-panel animation-panel"
  class:mobile-hidden={isMobileHidden}
>
  <!-- Header -->
  <header class="panel-header">
    <span class="panel-icon animation-icon">
      <i class="fas fa-film" aria-hidden="true"></i>
    </span>
    <h3 class="panel-title">Animation</h3>
  </header>

  <!-- Controls -->
  <div class="panel-controls">

    <!-- ─── DESKTOP CONTROLS ─────────────────────────────────────────── -->
    <div class="desktop-controls">

      <!-- Playback -->
      <div class="control-group">
        <span class="group-label">Playback</span>
        <div class="segmented-pair">
          <button
            class="toggle-btn segment-half"
            class:active={playbackMode === "continuous"}
            onclick={() => onPlaybackModeChange("continuous")}
            aria-pressed={playbackMode === "continuous"}
          >
            <i class="fas fa-infinity" aria-hidden="true"></i>
            Continuous
          </button>
          <button
            class="toggle-btn segment-half"
            class:active={playbackMode === "step"}
            onclick={() => onPlaybackModeChange("step")}
            aria-pressed={playbackMode === "step"}
          >
            <i class="fas fa-step-forward" aria-hidden="true"></i>
            Step
          </button>
        </div>
      </div>

      <!-- Speed -->
      <div class="control-group">
        <span class="group-label">Speed</span>
        <div class="toggle-grid toggle-grid-4">
          {#each BPM_PRESETS as preset}
            <button
              class="toggle-btn"
              class:active={bpm === preset}
              onclick={() => onBpmChange(preset)}
              aria-pressed={bpm === preset}
            >
              {preset}
            </button>
          {/each}
        </div>
      </div>

      <!-- Grid -->
      <div class="control-group">
        <span class="group-label">Grid</span>
        <div class="toggle-grid toggle-grid-3">
          <button
            class="toggle-btn"
            class:active={gridMode === "none"}
            onclick={() => onToggle("gridOff")}
            aria-pressed={gridMode === "none"}
          >
            Off
          </button>
          <button
            class="toggle-btn"
            class:active={gridMode === "8point"}
            onclick={() => onToggle("grid8pt")}
            aria-pressed={gridMode === "8point"}
          >
            8-Point
          </button>
          <button
            class="toggle-btn"
            class:active={gridMode === "auto"}
            onclick={() => onToggle("gridAuto")}
            aria-pressed={gridMode === "auto"}
          >
            Auto
          </button>
        </div>
      </div>

      <!-- Canvas -->
      <div class="control-group">
        <span class="group-label">Canvas</span>
        <div class="toggle-grid toggle-grid-3">
          <button
            class="toggle-btn"
            class:active={propsVisible}
            onclick={() => onToggle("props")}
            aria-pressed={propsVisible}
          >
            <i class="fas fa-circle" aria-hidden="true"></i>
            Props
          </button>
          <button
            class="toggle-btn"
            class:active={stepNumbersVisible}
            onclick={() => onToggle("stepNumbers")}
            aria-pressed={stepNumbersVisible}
          >
            <i class="fas fa-hashtag" aria-hidden="true"></i>
            Beat #s
          </button>
          <button
            class="toggle-btn"
            class:active={pathLinesVisible}
            onclick={() => onToggle("pathLines")}
            aria-pressed={pathLinesVisible}
          >
            <i class="fas fa-route" aria-hidden="true"></i>
            Paths
          </button>
        </div>
      </div>

      <!-- Trails -->
      <div class="control-group">
        <span class="group-label">Trails</span>
        <div class="toggle-grid">
          <button
            class="toggle-btn"
            class:active={!trailsOn}
            onclick={() => { if (trailsOn) toggleTrails(); }}
            aria-pressed={!trailsOn}
          >
            <i class="fas fa-ban" aria-hidden="true"></i>
            Off
          </button>
          <button
            class="toggle-btn"
            class:active={trailsOn}
            onclick={() => { if (!trailsOn) toggleTrails(); }}
            aria-pressed={trailsOn}
          >
            <i class="fas fa-paint-brush" aria-hidden="true"></i>
            On
          </button>
        </div>
        {#if trailsOn}
          <button
            class="toggle-btn full-width"
            class:active={bothEnds}
            onclick={toggleBothEnds}
            aria-pressed={bothEnds}
          >
            <i class="fas fa-arrows-alt-h" aria-hidden="true"></i>
            Both Ends
          </button>
        {/if}
      </div>

      <!-- Overlays -->
      <div class="control-group">
        <span class="group-label">Overlays</span>
        <div class="toggle-grid">
          <button
            class="toggle-btn"
            class:active={tkaGlyphVisible}
            onclick={() => onToggle("tkaGlyph")}
            aria-pressed={tkaGlyphVisible}
          >
            <i class="fas fa-font" aria-hidden="true"></i>
            TKA Glyph
          </button>
          <button
            class="toggle-btn"
            class:active={wordHeaderVisible}
            onclick={() => onToggle("wordHeader")}
            aria-pressed={wordHeaderVisible}
          >
            <i class="fas fa-heading" aria-hidden="true"></i>
            Word Header
          </button>
          <button
            class="toggle-btn"
            class:active={progressBarVisible}
            onclick={() => onToggle("progressBar")}
            aria-pressed={progressBarVisible}
          >
            <i class="fas fa-tasks" aria-hidden="true"></i>
            Progress Bar
          </button>
        </div>
      </div>

    </div>
    <!-- /desktop-controls -->

    <!-- ─── MOBILE CONTROLS ──────────────────────────────────────────── -->
    <div class="mobile-controls">

      <!-- Row 1: Playback -->
      <div class="mobile-row">
        <button
          class="toggle-btn"
          class:active={playbackMode === "continuous"}
          onclick={() => onPlaybackModeChange("continuous")}
          aria-pressed={playbackMode === "continuous"}
        >
          <i class="fas fa-infinity" aria-hidden="true"></i>
          Loop
        </button>
        <button
          class="toggle-btn"
          class:active={playbackMode === "step"}
          onclick={() => onPlaybackModeChange("step")}
          aria-pressed={playbackMode === "step"}
        >
          <i class="fas fa-step-forward" aria-hidden="true"></i>
          Step
        </button>
      </div>

      <!-- Row 2: BPM presets -->
      <div class="mobile-row">
        {#each BPM_PRESETS as preset}
          <button
            class="toggle-btn"
            class:active={bpm === preset}
            onclick={() => onBpmChange(preset)}
            aria-pressed={bpm === preset}
          >
            {preset}
          </button>
        {/each}
      </div>

      <!-- Row 3: Grid mode -->
      <div class="mobile-row">
        <button
          class="toggle-btn"
          class:active={gridMode === "none"}
          onclick={() => onToggle("gridOff")}
        >
          Off
        </button>
        <button
          class="toggle-btn"
          class:active={gridMode === "8point"}
          onclick={() => onToggle("grid8pt")}
        >
          8-Pt
        </button>
        <button
          class="toggle-btn"
          class:active={gridMode === "auto"}
          onclick={() => onToggle("gridAuto")}
        >
          Auto
        </button>
      </div>

      <!-- Row 4: Canvas + Overlay toggles -->
      <div class="mobile-row mobile-row-wrap">
        <button
          class="toggle-btn"
          class:active={propsVisible}
          onclick={() => onToggle("props")}
          aria-pressed={propsVisible}
        >
          <i class="fas fa-circle" aria-hidden="true"></i>
          Props
        </button>
        <button
          class="toggle-btn"
          class:active={stepNumbersVisible}
          onclick={() => onToggle("stepNumbers")}
          aria-pressed={stepNumbersVisible}
        >
          <i class="fas fa-hashtag" aria-hidden="true"></i>
          Beat #
        </button>
        <button
          class="toggle-btn"
          class:active={pathLinesVisible}
          onclick={() => onToggle("pathLines")}
          aria-pressed={pathLinesVisible}
        >
          <i class="fas fa-route" aria-hidden="true"></i>
          Paths
        </button>
        <button
          class="toggle-btn"
          class:active={tkaGlyphVisible}
          onclick={() => onToggle("tkaGlyph")}
          aria-pressed={tkaGlyphVisible}
        >
          <i class="fas fa-font" aria-hidden="true"></i>
          TKA
        </button>
        <button
          class="toggle-btn"
          class:active={wordHeaderVisible}
          onclick={() => onToggle("wordHeader")}
          aria-pressed={wordHeaderVisible}
        >
          <i class="fas fa-heading" aria-hidden="true"></i>
          Word
        </button>
        <button
          class="toggle-btn"
          class:active={progressBarVisible}
          onclick={() => onToggle("progressBar")}
          aria-pressed={progressBarVisible}
        >
          <i class="fas fa-tasks" aria-hidden="true"></i>
          Progress
        </button>
      </div>

      <!-- Row 4: Trail toggles + both ends -->
      <div class="mobile-row">
        <button
          class="toggle-btn"
          class:active={!trailsOn}
          onclick={() => { if (trailsOn) toggleTrails(); }}
          aria-pressed={!trailsOn}
        >
          <i class="fas fa-ban" aria-hidden="true"></i>
          No Trail
        </button>
        <button
          class="toggle-btn"
          class:active={trailsOn}
          onclick={() => { if (!trailsOn) toggleTrails(); }}
          aria-pressed={trailsOn}
        >
          <i class="fas fa-paint-brush" aria-hidden="true"></i>
          Trail
        </button>
        {#if trailsOn}
          <button
            class="toggle-btn"
            class:active={bothEnds}
            onclick={toggleBothEnds}
            aria-pressed={bothEnds}
          >
            <i class="fas fa-arrows-alt-h" aria-hidden="true"></i>
            Both
          </button>
        {/if}
      </div>

    </div>
    <!-- /mobile-controls -->

  </div>
</section>

<style>
  .settings-panel {
    container-type: inline-size;
    container-name: animation-panel;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
    overflow: hidden;
    padding: 20px;
    gap: 16px;
  }

  .settings-panel.mobile-hidden {
    display: none;
  }

  /* ── Header ─────────────────────────────────────────────────────── */

  .panel-header {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .panel-icon {
    --icon-color: #818cf8;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--icon-color) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--icon-color) 30%, transparent);
    color: var(--icon-color);
    font-size: 15px;
    flex-shrink: 0;
    box-shadow: 0 0 12px color-mix(in srgb, var(--icon-color) 20%, transparent);
  }

  .animation-icon {
    --icon-color: #f472b6;
  }

  .panel-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, #ffffff);
    letter-spacing: 0.02em;
    margin: 0;
  }

  /* ── Controls Wrapper ────────────────────────────────────────────── */

  .panel-controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  /* Desktop layout: shown when panel is wide enough */
  .desktop-controls {
    display: none;
    flex-direction: column;
    gap: 16px;
  }

  /* Mobile layout: shown by default */
  .mobile-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  @container animation-panel (min-width: 320px) {
    .desktop-controls {
      display: flex;
    }

    .mobile-controls {
      display: none;
    }
  }

  /* ── Control Groups (desktop) ────────────────────────────────────── */

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* ── Toggle Grids ────────────────────────────────────────────────── */

  .toggle-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .toggle-grid-3 {
    grid-template-columns: 1fr 1fr 1fr;
  }

  .toggle-grid-4 {
    grid-template-columns: repeat(4, 1fr);
  }

  /* ── Segmented Pair ─────────────────────────────────────────────── */

  .segmented-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .segmented-pair .toggle-btn.segment-half {
    border-radius: 0;
    border: none;
  }

  .segmented-pair .toggle-btn.segment-half:first-child {
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* ── Mobile Rows ─────────────────────────────────────────────────── */

  .mobile-row {
    display: flex;
    gap: 6px;
  }

  .mobile-row .toggle-btn {
    flex: 1;
  }

  .mobile-row-wrap {
    flex-wrap: wrap;
  }

  .mobile-row-wrap .toggle-btn {
    flex: 1 1 calc(33.33% - 6px);
    min-width: 0;
  }

  /* ── Full-Width Button ───────────────────────────────────────────── */

  .full-width {
    width: 100%;
  }

  /* ── Toggle Buttons ──────────────────────────────────────────────── */

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--min-touch-target, 44px);
    padding: 10px 12px;
    background: color-mix(
      in srgb,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 80%,
      transparent
    );
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui,
      sans-serif;
    cursor: pointer;
    transition: all 150ms ease;
    -webkit-tap-highlight-color: transparent;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .toggle-btn i {
    font-size: var(--font-size-sm, 14px);
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .toggle-btn:hover:not(:disabled) {
    background: color-mix(
      in srgb,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 100%,
      transparent
    );
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, #ffffff);
  }

  .toggle-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .toggle-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: var(--theme-text, #ffffff);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--theme-accent) 15%, transparent),
      0 2px 8px color-mix(in srgb, var(--theme-accent) 25%, transparent);
  }

  .toggle-btn.active i {
    filter: drop-shadow(0 0 4px var(--theme-accent));
  }

  .toggle-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .toggle-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    outline-offset: 2px;
  }

  /* ── Reduced Motion ──────────────────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .toggle-btn,
    .toggle-btn i {
      transition: none;
    }

    .toggle-btn:active:not(:disabled) {
      transform: none;
    }
  }

  /* ── High Contrast ───────────────────────────────────────────────── */

  @media (prefers-contrast: high) {
    .toggle-btn {
      border-width: 2px;
    }

    .toggle-btn.active {
      border-color: var(--theme-accent);
    }

    .toggle-btn:focus-visible {
      outline-width: 3px;
    }
  }
</style>
