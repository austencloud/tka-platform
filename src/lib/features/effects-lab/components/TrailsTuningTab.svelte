<!--
  TrailsTuningTab.svelte

  Trail effect tuning: enable/disable, appearance controls (line width,
  opacity, glow), and behavior controls (fade duration, tracking mode,
  hide props). All settings write directly to the shared animationSettings
  singleton and persist automatically.
-->
<script lang="ts">
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { TrackingMode } from "$lib/shared/animation-engine/domain/types/TrailTypes";

  // Reactive reads from the shared settings singleton
  let trail = $derived(animationSettings.trail);
  let enabled = $derived(trail.enabled);

  // Local reactive copies for slider binding (sliders need writable state)
  let fadeDuration = $state(animationSettings.trail.fadeDurationMs);
  let lineWidth = $state(animationSettings.trail.lineWidth);
  let minOpacity = $state(animationSettings.trail.minOpacity);
  let maxOpacity = $state(animationSettings.trail.maxOpacity);
  let glowBlur = $state(animationSettings.trail.glowBlur);

  // Sync local state back from the singleton when it changes externally
  $effect(() => {
    fadeDuration = animationSettings.trail.fadeDurationMs;
    lineWidth = animationSettings.trail.lineWidth;
    minOpacity = animationSettings.trail.minOpacity;
    maxOpacity = animationSettings.trail.maxOpacity;
    glowBlur = animationSettings.trail.glowBlur;
  });

  function handleEnabledToggle() {
    animationSettings.setTrailEnabled(!enabled);
  }

  function handleFadeDuration(ms: number) {
    fadeDuration = ms;
    animationSettings.setFadeDuration(ms);
  }

  function handleLineWidth(width: number) {
    lineWidth = width;
    animationSettings.setTrailAppearance({ lineWidth: width });
  }

  function handleMinOpacity(opacity: number) {
    minOpacity = opacity;
    animationSettings.setTrailAppearance({ minOpacity: opacity });
  }

  function handleMaxOpacity(opacity: number) {
    maxOpacity = opacity;
    animationSettings.setTrailAppearance({ maxOpacity: opacity });
  }

  function handleGlowBlur(blur: number) {
    glowBlur = blur;
    animationSettings.setTrailAppearance({ glowBlur: blur });
  }

  function handleTrackingMode(mode: TrackingMode) {
    animationSettings.setTrackingMode(mode);
  }

  function handleHideProps(hide: boolean) {
    animationSettings.setHideProps(hide);
  }

  const TRACKING_OPTIONS: { mode: TrackingMode; label: string; aria: string }[] = [
    { mode: TrackingMode.LEFT_END, label: "Left", aria: "Track left end only" },
    { mode: TrackingMode.RIGHT_END, label: "Right", aria: "Track right end only" },
    { mode: TrackingMode.BOTH_ENDS, label: "Both", aria: "Track both ends" },
  ];
</script>

<div class="trails-tuning-tab">
  <div class="controls-panel themed-scrollbar">

    <!-- Enable toggle -->
    <div class="control-section">
      <div class="toggle-row">
        <span class="toggle-label">
          <i class="fas fa-wave-square" aria-hidden="true"></i>
          Trails
        </span>
        <button
          class="toggle-btn"
          class:active={enabled}
          onclick={handleEnabledToggle}
          aria-label={enabled ? "Disable trail effect" : "Enable trail effect"}
          aria-pressed={enabled}
        >
          {enabled ? "ON" : "OFF"}
        </button>
      </div>
    </div>

    <!-- Appearance section -->
    <div class="control-section" class:disabled={!enabled} aria-disabled={!enabled}>
      <h3>Appearance</h3>

      <!-- Line width -->
      <div class="slider-row">
        <label for="trail-line-width">Line width</label>
        <input
          id="trail-line-width"
          type="range"
          min="1"
          max="10"
          step="0.5"
          value={lineWidth}
          disabled={!enabled}
          oninput={(e) => handleLineWidth(parseFloat(e.currentTarget.value))}
          aria-label="Trail line width"
        />
        <span class="slider-value">{lineWidth.toFixed(1)}</span>
      </div>

      <!-- Min opacity -->
      <div class="slider-row">
        <label for="trail-min-opacity">Min opacity</label>
        <input
          id="trail-min-opacity"
          type="range"
          min="0.0"
          max="0.5"
          step="0.05"
          value={minOpacity}
          disabled={!enabled}
          oninput={(e) => handleMinOpacity(parseFloat(e.currentTarget.value))}
          aria-label="Trail minimum opacity (tail)"
        />
        <span class="slider-value">{(minOpacity * 100).toFixed(0)}%</span>
      </div>

      <!-- Max opacity -->
      <div class="slider-row">
        <label for="trail-max-opacity">Max opacity</label>
        <input
          id="trail-max-opacity"
          type="range"
          min="0.5"
          max="1.0"
          step="0.05"
          value={maxOpacity}
          disabled={!enabled}
          oninput={(e) => handleMaxOpacity(parseFloat(e.currentTarget.value))}
          aria-label="Trail maximum opacity (head)"
        />
        <span class="slider-value">{(maxOpacity * 100).toFixed(0)}%</span>
      </div>

      <!-- Glow blur -->
      <div class="slider-row">
        <label for="trail-glow-blur">Glow blur</label>
        <input
          id="trail-glow-blur"
          type="range"
          min="0"
          max="10"
          step="1"
          value={glowBlur}
          disabled={!enabled}
          oninput={(e) => handleGlowBlur(parseInt(e.currentTarget.value, 10))}
          aria-label="Trail glow blur radius"
        />
        <span class="slider-value">{glowBlur}</span>
      </div>
    </div>

    <!-- Behavior section -->
    <div class="control-section" class:disabled={!enabled} aria-disabled={!enabled}>
      <h3>Behavior</h3>

      <!-- Fade duration -->
      <div class="slider-row">
        <label for="trail-fade-duration">Fade duration</label>
        <input
          id="trail-fade-duration"
          type="range"
          min="500"
          max="5000"
          step="100"
          value={fadeDuration}
          disabled={!enabled}
          oninput={(e) => handleFadeDuration(parseInt(e.currentTarget.value, 10))}
          aria-label="Trail fade duration in milliseconds"
        />
        <span class="slider-value">{(fadeDuration / 1000).toFixed(1)}s</span>
      </div>

      <!-- Tracking mode -->
      <div class="tracking-row">
        <span class="row-label">Track end</span>
        <div class="tracking-toggle" role="radiogroup" aria-label="Tracking mode">
          {#each TRACKING_OPTIONS as opt (opt.mode)}
            <button
              role="radio"
              class="tracking-btn"
              class:active={trail.trackingMode === opt.mode}
              aria-checked={trail.trackingMode === opt.mode}
              aria-label={opt.aria}
              disabled={!enabled}
              onclick={() => handleTrackingMode(opt.mode)}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Hide props toggle -->
      <div class="toggle-row">
        <span class="toggle-label">Hide props</span>
        <button
          class="toggle-btn"
          class:active={trail.hideProps}
          disabled={!enabled}
          onclick={() => handleHideProps(!trail.hideProps)}
          aria-label={trail.hideProps ? "Show props" : "Hide props — trails only"}
          aria-pressed={trail.hideProps}
        >
          {trail.hideProps ? "ON" : "OFF"}
        </button>
      </div>
    </div>

  </div>
</div>

<style>
  .trails-tuning-tab {
    /* Trail domain color tokens */
    --effect-accent: #3b82f6;
    --effect-accent-bright: #60a5fa;
    --effect-accent-dim: rgba(59, 130, 246, 0.08);
    --effect-accent-mid: rgba(59, 130, 246, 0.15);
    --effect-accent-border: rgba(59, 130, 246, 0.3);
    --effect-accent-border-strong: rgba(59, 130, 246, 0.5);

    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .controls-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 16px);
    padding: var(--spacing-md, 16px);
    overflow-y: auto;
    min-height: 0;
    flex: 1;
  }

  .control-section {
    padding: var(--spacing-md, 16px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
    transition: opacity 150ms ease;
  }

  .control-section.disabled {
    opacity: 0.45;
    pointer-events: none;
  }

  .control-section h3 {
    margin: 0 0 var(--spacing-xs, 4px);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  /* Enable toggle row (at the top section level) */
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 44px;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .toggle-label i {
    color: var(--effect-accent);
  }

  .toggle-btn {
    padding: 6px 16px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 9999px;
    background: color-mix(in srgb, var(--theme-text) 5%, transparent);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    min-width: 56px;
    min-height: 44px;
  }

  .toggle-btn.active {
    background: var(--effect-accent-mid);
    border-color: var(--effect-accent-border-strong);
    color: var(--effect-accent-bright);
  }

  .toggle-btn:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--theme-text) 30%, transparent);
  }

  .toggle-btn.active:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--effect-accent) 70%, transparent);
  }

  .toggle-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  /* Slider rows */
  .slider-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    min-height: 44px;
  }

  .slider-row label {
    min-width: 110px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
  }

  .slider-row input[type="range"] {
    flex: 1;
    accent-color: var(--effect-accent);
    cursor: pointer;
  }

  .slider-row input[type="range"]:disabled {
    cursor: not-allowed;
  }

  .slider-value {
    min-width: 40px;
    text-align: right;
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, white);
  }

  /* Tracking mode row */
  .tracking-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm, 8px);
    min-height: 44px;
  }

  .row-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
  }

  .tracking-toggle {
    display: flex;
    gap: 2px;
    background: color-mix(in srgb, var(--theme-text) 3%, transparent);
    border-radius: var(--border-radius-md, 8px);
    padding: 3px;
  }

  .tracking-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 7px 14px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    min-height: 36px;
  }

  .tracking-btn:hover:not(:disabled) {
    color: var(--theme-text, white);
    background: color-mix(in srgb, var(--theme-text) 6%, transparent);
  }

  .tracking-btn.active {
    background: var(--effect-accent-mid);
    color: var(--effect-accent-bright);
    box-shadow: 0 1px 3px var(--theme-overlay-dark, rgba(0, 0, 0, 0.2));
  }

  .tracking-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: -2px;
  }

  .tracking-btn:disabled {
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .control-section,
    .toggle-btn,
    .tracking-btn {
      transition: none;
    }
  }
</style>
