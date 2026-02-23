<!--
  AnimationMobileControls.svelte

  Compact mobile layout for animation visibility controls.
  Displayed when panel width is below 320px.
-->
<script lang="ts">
  import type {
    TrailVisibility,
    PlaybackMode,
  } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

  interface Props {
    playbackMode: PlaybackMode;
    bpm: number;
    bpmPresets: number[];
    gridVisible: boolean;
    stepNumbersVisible: boolean;
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
    trailStyle: TrailVisibility;
    showBilateralToggle: boolean;
    isBothEnds: boolean;
    onPlaybackModeChange: (mode: PlaybackMode) => void;
    onBpmChange: (bpm: number) => void;
    onToggle: (key: string) => void;
    onTrailPreset: (preset: TrailVisibility) => void;
    onToggleBothEnds: () => void;
  }

  let {
    playbackMode,
    bpm,
    bpmPresets,
    gridVisible,
    stepNumbersVisible,
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

<div class="mobile-controls">
  <!-- Row 1: Playback mode -->
  <div class="mobile-row">
    <button
      class="compact-btn"
      class:active={playbackMode === "continuous"}
      aria-pressed={playbackMode === "continuous"}
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
      aria-pressed={playbackMode === "step"}
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
        aria-pressed={bpm === presetBpm}
        onclick={() => onBpmChange(presetBpm)}
        type="button"
        aria-label="Set BPM to {presetBpm}"
      >
        {presetBpm}
      </button>
    {/each}
  </div>

  <!-- Row 3: Overlay toggles -->
  <div class="mobile-row">
    <button
      class="compact-btn"
      class:active={tkaGlyphVisible}
      aria-pressed={tkaGlyphVisible}
      onclick={() => onToggle("tka")}
      type="button"
    >
      <i class="fas fa-font" aria-hidden="true"></i>
      <span>TKA</span>
    </button>
    <button
      class="compact-btn"
      class:active={wordHeaderVisible}
      aria-pressed={wordHeaderVisible}
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
      aria-pressed={trailStyle === "off"}
      onclick={() => onTrailPreset("off")}
      type="button"
    >
      Off
    </button>
    <button
      class="compact-btn trail"
      class:active={trailStyle === "on"}
      aria-pressed={trailStyle === "on"}
      onclick={() => onTrailPreset("on")}
      type="button"
    >
      On
    </button>
    {#if showBilateralToggle}
      <button
        class="compact-btn trail ends"
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
      </button>
    {/if}
  </div>

  <!-- Row 5: Effects -->
  <div class="mobile-row">
    <button
      class="compact-btn"
      class:active={fireEffectEnabled}
      aria-pressed={fireEffectEnabled}
      onclick={() => onToggle("fireEffect")}
      type="button"
    >
      <i class="fas fa-fire" aria-hidden="true"></i>
      <span>Fire</span>
    </button>
    <button
      class="compact-btn"
      class:active={ledEffectEnabled}
      aria-pressed={ledEffectEnabled}
      onclick={() => onToggle("ledEffect")}
      type="button"
    >
      <i class="fas fa-lightbulb" aria-hidden="true"></i>
      <span>LED</span>
    </button>
  </div>
  {#if fireEffectEnabled}
    <!-- Fire/Charcoal toggle -->
    <div class="mobile-row">
      <button
        class="compact-btn"
        class:active={!useCharcoal}
        aria-pressed={!useCharcoal}
        onclick={() => onUseCharcoalChange(false)}
        type="button"
      >
        <i class="fas fa-fire" aria-hidden="true"></i>
        <span>Fire</span>
      </button>
      <button
        class="compact-btn"
        class:active={useCharcoal}
        aria-pressed={useCharcoal}
        onclick={() => onUseCharcoalChange(true)}
        type="button"
      >
        <i class="fas fa-circle" aria-hidden="true"></i>
        <span>Charcoal</span>
      </button>
    </div>
    <!-- Intensity slider -->
    <div class="slider-row">
      <span class="slider-label">Intensity</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={fireIntensity}
        oninput={(e) => onFireIntensityChange(parseFloat(e.currentTarget.value))}
        class="slider-input"
        aria-label="Fire intensity"
      />
      <span class="slider-value">{Math.round(fireIntensity * 100)}%</span>
    </div>
    {#if !useCharcoal}
      <!-- Smoke slider (fluid fire only) -->
      <div class="slider-row">
        <span class="slider-label">Smoke</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={smokeLevel}
          oninput={(e) => onSmokeLevelChange(parseFloat(e.currentTarget.value))}
          class="slider-input"
          aria-label="Smoke level"
        />
        <span class="slider-value">{Math.round(smokeLevel * 100)}%</span>
      </div>
    {/if}
    <!-- Color blend slider -->
    <div class="slider-row">
      <span class="slider-label">Color</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={colorBlend}
        oninput={(e) => onColorBlendChange(parseFloat(e.currentTarget.value))}
        class="slider-input"
        aria-label="Color blend"
      />
      <span class="slider-value">
        {#if colorBlend < 0.05}Nat{:else if colorBlend > 0.95}Col{:else}{Math.round(colorBlend * 100)}%{/if}
      </span>
    </div>
  {/if}
</div>

<style>
  .mobile-controls {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.5cqi, 10px);
    width: 100%;
  }

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
    min-height: 44px;
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
    transition: all var(--duration-fast) ease;
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

  .compact-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    outline-offset: 2px;
  }

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

  .compact-btn.trail {
    flex: 1;
  }

  .compact-btn.trail.ends {
    flex: 0 0 48px;
    padding: 8px;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: clamp(6px, 1cqi, 10px);
    margin-top: clamp(4px, 1cqi, 6px);
  }

  .slider-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim);
    white-space: nowrap;
    min-width: 52px;
  }

  .slider-input {
    flex: 1;
    min-height: 44px;
    accent-color: var(--theme-accent);
    cursor: pointer;
  }

  .slider-value {
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-dim);
    min-width: 32px;
    text-align: right;
  }

  @media (prefers-reduced-motion: reduce) {
    .compact-btn {
      transition: none;
    }
  }

  @media (prefers-contrast: high) {
    .compact-btn {
      border-width: 2px;
    }

    .compact-btn.active {
      border-color: var(--theme-accent);
    }

    .compact-btn:focus-visible {
      outline-width: 3px;
    }
  }
</style>
