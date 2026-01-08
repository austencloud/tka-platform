<!--
  AnimationDesktopControls.svelte

  Expanded desktop layout for animation visibility controls.
  Displayed when panel width is 320px or above.
-->
<script lang="ts">
  import type {
    TrailStyle,
    PlaybackMode,
  } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

  interface Props {
    playbackMode: PlaybackMode;
    bpm: number;
    bpmPresets: number[];
    gridVisible: boolean;
    beatNumbersVisible: boolean;
    tkaGlyphVisible: boolean;
    wordHeaderVisible: boolean;
    trailStyle: TrailStyle;
    showBilateralToggle: boolean;
    isBothEnds: boolean;
    onPlaybackModeChange: (mode: PlaybackMode) => void;
    onBpmChange: (bpm: number) => void;
    onToggle: (key: string) => void;
    onTrailPreset: (preset: TrailStyle) => void;
    onToggleBothEnds: () => void;
  }

  let {
    playbackMode,
    bpm,
    bpmPresets,
    gridVisible,
    beatNumbersVisible,
    tkaGlyphVisible,
    wordHeaderVisible,
    trailStyle,
    showBilateralToggle,
    isBothEnds,
    onPlaybackModeChange,
    onBpmChange,
    onToggle,
    onTrailPreset,
    onToggleBothEnds,
  }: Props = $props();
</script>

<div class="desktop-controls">
  <div class="control-group">
    <span class="group-label">Playback</span>
    <div class="playback-mode-toggle">
      <button
        class="mode-btn"
        class:active={playbackMode === "continuous"}
        aria-pressed={playbackMode === "continuous"}
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
        aria-pressed={playbackMode === "step"}
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
          aria-pressed={bpm === presetBpm}
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
        aria-pressed={gridVisible}
        onclick={() => onToggle("grid")}>Grid</button
      >
      <button
        class="toggle-btn"
        class:active={beatNumbersVisible}
        aria-pressed={beatNumbersVisible}
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
          aria-pressed={trailStyle === "off"}
          onclick={() => onTrailPreset("off")}
          type="button"
        >
          Off
        </button>
        <button
          class="preset-btn"
          class:active={trailStyle === "subtle"}
          aria-pressed={trailStyle === "subtle"}
          onclick={() => onTrailPreset("subtle")}
          type="button"
        >
          Subtle
        </button>
        <button
          class="preset-btn"
          class:active={trailStyle === "vivid"}
          aria-pressed={trailStyle === "vivid"}
          onclick={() => onTrailPreset("vivid")}
          type="button"
        >
          Vivid
        </button>
      </div>

      {#if showBilateralToggle}
        <button
          class="ends-toggle"
          class:active={isBothEnds}
          aria-pressed={isBothEnds}
          onclick={onToggleBothEnds}
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
        aria-pressed={tkaGlyphVisible}
        onclick={() => onToggle("tka")}>TKA Glyph</button
      >
      <button
        class="toggle-btn"
        class:active={wordHeaderVisible}
        aria-pressed={wordHeaderVisible}
        onclick={() => onToggle("wordHeader")}>Word</button
      >
    </div>
  </div>
</div>

<style>
  .desktop-controls {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.5cqi, 10px);
    width: 100%;
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
    color: var(--theme-text-dim);
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

  .toggle-grid.triple {
    grid-template-columns: repeat(3, 1fr);
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
    min-height: 44px;
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
    min-height: 44px;
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

  .bpm-btn:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--theme-accent-strong) 50%, transparent);
    outline-offset: 2px;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
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
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 45%, transparent);
    color: white;
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--theme-accent) 15%, transparent),
      0 4px 12px color-mix(in srgb, var(--theme-accent) 25%, transparent);
  }

  .toggle-btn.active:hover {
    background: color-mix(in srgb, var(--theme-accent) 35%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 55%, transparent);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--theme-accent) 20%, transparent),
      0 4px 16px color-mix(in srgb, var(--theme-accent) 35%, transparent);
  }

  .toggle-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    outline-offset: 2px;
  }

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
    min-height: 44px;
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
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 45%, transparent);
    color: white;
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--theme-accent) 15%, transparent),
      0 4px 12px color-mix(in srgb, var(--theme-accent) 25%, transparent);
  }

  .preset-btn.active:hover {
    background: color-mix(in srgb, var(--theme-accent) 35%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 55%, transparent);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--theme-accent) 20%, transparent),
      0 4px 16px color-mix(in srgb, var(--theme-accent) 35%, transparent);
  }

  .preset-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    outline-offset: 2px;
  }

  .ends-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 1cqi, 6px);
    min-height: 44px;
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
    .ends-toggle {
      border-width: 2px;
    }

    .toggle-btn.active,
    .preset-btn.active,
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
</style>
