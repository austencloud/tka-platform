<!--
  EffectsControlPanel.svelte - Control panel for 3D visual effects

  Collapsible overlay panel positioned over the 3D viewer.
  Controls trails, particles, motion effects, and post-processing.
-->
<script lang="ts">
  import EffectSection from "./EffectSection.svelte";
  import { getEffectsConfigState } from "../state/effects-config-state.svelte";

  // Get singleton state
  const state = getEffectsConfigState();

  // Trail mode options
  const TRAIL_MODES = [
    { value: "color", label: "Color" },
    { value: "rainbow", label: "Rainbow" },
  ] as const;

  // Sparkle color presets
  const SPARKLE_COLORS = [
    { value: "#ffd700", label: "Gold" },
    { value: "#ffffff", label: "White" },
    { value: "#00ffff", label: "Cyan" },
    { value: "#ff69b4", label: "Pink" },
  ] as const;

  // Derived trail mode from color
  let trailMode = $derived(
    state.trails.color === "rainbow" ? "rainbow" : "color"
  );
</script>

<div class="effects-panel" class:collapsed={state.isCollapsed}>
  <!-- Header -->
  <header class="panel-header">
    <button
      class="header-toggle"
      onclick={() => state.toggleCollapsed()}
      aria-expanded={!state.isCollapsed}
      aria-controls="effects-panel-content"
    >
      <span class="header-icon">
        <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
      </span>
      <span class="header-title">Effects</span>
      {#if state.enabledCount > 0}
        <span class="enabled-badge">{state.enabledCount}</span>
      {/if}
      <i
        class="fas fa-chevron-up collapse-icon"
        class:collapsed={state.isCollapsed}
        aria-hidden="true"
      ></i>
    </button>
  </header>

  <!-- Content -->
  {#if !state.isCollapsed}
    <div class="panel-content" id="effects-panel-content">
      <!-- Trails -->
      <EffectSection
        label="Trails"
        icon="fas fa-wind"
        enabled={state.trails.enabled}
        onToggle={() => state.toggleTrails()}
      >
        <div class="control-row">
          <span class="control-label">Mode</span>
          <div class="button-group">
            {#each TRAIL_MODES as mode}
              <button
                class="mode-btn"
                class:active={trailMode === mode.value}
                onclick={() => state.setTrailMode(mode.value)}
              >
                {mode.label}
              </button>
            {/each}
          </div>
        </div>

        <div class="control-row">
          <label class="control-label" for="trail-width">Width</label>
          <input
            type="range"
            id="trail-width"
            min="0.01"
            max="0.2"
            step="0.01"
            value={state.trails.width}
            oninput={(e) =>
              state.updateTrails({ width: parseFloat(e.currentTarget.value) })}
            class="slider"
          />
          <span class="value-display">{state.trails.width.toFixed(2)}</span>
        </div>

        <div class="control-row">
          <label class="control-label" for="trail-length">Length</label>
          <input
            type="range"
            id="trail-length"
            min="10"
            max="100"
            step="5"
            value={state.trails.length}
            oninput={(e) =>
              state.updateTrails({ length: parseInt(e.currentTarget.value) })}
            class="slider"
          />
          <span class="value-display">{state.trails.length}</span>
        </div>

        <div class="control-row">
          <label class="control-label" for="trail-fade">Fade Out</label>
          <label class="mini-toggle">
            <input
              type="checkbox"
              id="trail-fade"
              checked={state.trails.fadeOut}
              onchange={() =>
                state.updateTrails({ fadeOut: !state.trails.fadeOut })}
            />
            <span class="mini-slider"></span>
          </label>
        </div>
      </EffectSection>

      <!-- Fire -->
      <EffectSection
        label="Fire"
        icon="fas fa-fire"
        enabled={state.fire.enabled}
        onToggle={() => state.toggleFire()}
      >
        <div class="control-row">
          <label class="control-label" for="fire-intensity">Intensity</label>
          <input
            type="range"
            id="fire-intensity"
            min="0.1"
            max="2"
            step="0.1"
            value={state.fire.intensity}
            oninput={(e) =>
              state.updateFire({
                intensity: parseFloat(e.currentTarget.value),
              })}
            class="slider"
          />
          <span class="value-display">{state.fire.intensity.toFixed(1)}</span>
        </div>

        <div class="control-row">
          <label class="control-label" for="fire-height">Height</label>
          <input
            type="range"
            id="fire-height"
            min="0.1"
            max="1"
            step="0.05"
            value={state.fire.height}
            oninput={(e) =>
              state.updateFire({ height: parseFloat(e.currentTarget.value) })}
            class="slider"
          />
          <span class="value-display">{state.fire.height.toFixed(2)}</span>
        </div>
      </EffectSection>

      <!-- Sparkles -->
      <EffectSection
        label="Sparkles"
        icon="fas fa-star"
        enabled={state.sparkles.enabled}
        onToggle={() => state.toggleSparkles()}
      >
        <div class="control-row">
          <label class="control-label" for="sparkle-intensity">Intensity</label>
          <input
            type="range"
            id="sparkle-intensity"
            min="0.1"
            max="2"
            step="0.1"
            value={state.sparkles.intensity}
            oninput={(e) =>
              state.updateSparkles({
                intensity: parseFloat(e.currentTarget.value),
              })}
            class="slider"
          />
          <span class="value-display"
            >{state.sparkles.intensity.toFixed(1)}</span
          >
        </div>

        <div class="control-row">
          <span class="control-label">Color</span>
          <div class="color-options">
            {#each SPARKLE_COLORS as color}
              <button
                class="color-btn"
                class:active={state.sparkles.color === color.value}
                style="--swatch-color: {color.value}"
                onclick={() => state.updateSparkles({ color: color.value })}
                aria-label={color.label}
                title={color.label}
              >
                <span class="color-swatch"></span>
              </button>
            {/each}
          </div>
        </div>
      </EffectSection>

      <!-- Electricity -->
      <EffectSection
        label="Electricity"
        icon="fas fa-bolt"
        enabled={state.electricity.enabled}
        onToggle={() => state.toggleElectricity()}
      >
        <div class="control-row">
          <label class="control-label" for="elec-intensity">Intensity</label>
          <input
            type="range"
            id="elec-intensity"
            min="0.1"
            max="2"
            step="0.1"
            value={state.electricity.intensity}
            oninput={(e) =>
              state.updateElectricity({
                intensity: parseFloat(e.currentTarget.value),
              })}
            class="slider"
          />
          <span class="value-display"
            >{state.electricity.intensity.toFixed(1)}</span
          >
        </div>

        <div class="control-row">
          <label class="control-label" for="elec-frequency">Frequency</label>
          <input
            type="range"
            id="elec-frequency"
            min="2"
            max="30"
            step="2"
            value={state.electricity.frequency}
            oninput={(e) =>
              state.updateElectricity({
                frequency: parseInt(e.currentTarget.value),
              })}
            class="slider"
          />
          <span class="value-display">{state.electricity.frequency}/s</span>
        </div>
      </EffectSection>

      <!-- Motion Effects -->
      <EffectSection
        label="Motion Effects"
        icon="fas fa-wind"
        enabled={state.motion.blur || state.motion.speedLines}
        onToggle={() => {
          // Toggle both if neither is on, or toggle off both
          if (!state.motion.blur && !state.motion.speedLines) {
            state.updateMotion({ blur: true, speedLines: true });
          } else {
            state.updateMotion({ blur: false, speedLines: false });
          }
        }}
      >
        <div class="control-row">
          <label class="control-label" for="motion-blur">Motion Blur</label>
          <label class="mini-toggle">
            <input
              type="checkbox"
              id="motion-blur"
              checked={state.motion.blur}
              onchange={() => state.toggleMotionBlur()}
            />
            <span class="mini-slider"></span>
          </label>
        </div>

        <div class="control-row">
          <label class="control-label" for="speed-lines">Speed Lines</label>
          <label class="mini-toggle">
            <input
              type="checkbox"
              id="speed-lines"
              checked={state.motion.speedLines}
              onchange={() => state.toggleSpeedLines()}
            />
            <span class="mini-slider"></span>
          </label>
        </div>

        <div class="control-row">
          <label class="control-label" for="motion-threshold">Threshold</label>
          <input
            type="range"
            id="motion-threshold"
            min="0.5"
            max="5"
            step="0.5"
            value={state.motion.threshold}
            oninput={(e) =>
              state.updateMotion({
                threshold: parseFloat(e.currentTarget.value),
              })}
            class="slider"
          />
          <span class="value-display">{state.motion.threshold.toFixed(1)}</span>
        </div>
      </EffectSection>

      <!-- Bloom (Glow) -->
      <EffectSection
        label="Bloom (Glow)"
        icon="fas fa-sun"
        enabled={state.bloom.enabled}
        onToggle={() => state.toggleBloom()}
      >
        <div class="control-row">
          <label class="control-label" for="bloom-intensity">Intensity</label>
          <input
            type="range"
            id="bloom-intensity"
            min="0.1"
            max="2"
            step="0.1"
            value={state.bloom.intensity}
            oninput={(e) =>
              state.updateBloom({
                intensity: parseFloat(e.currentTarget.value),
              })}
            class="slider"
          />
          <span class="value-display">{state.bloom.intensity.toFixed(1)}</span>
        </div>

        <div class="control-row">
          <label class="control-label" for="bloom-threshold">Threshold</label>
          <input
            type="range"
            id="bloom-threshold"
            min="0.1"
            max="1"
            step="0.05"
            value={state.bloom.threshold}
            oninput={(e) =>
              state.updateBloom({
                threshold: parseFloat(e.currentTarget.value),
              })}
            class="slider"
          />
          <span class="value-display">{state.bloom.threshold.toFixed(2)}</span>
        </div>
      </EffectSection>

      <!-- Reset Button -->
      <div class="panel-footer">
        <button class="reset-btn" onclick={() => state.resetToDefaults()}>
          <i class="fas fa-rotate-left" aria-hidden="true"></i>
          Reset All
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .effects-panel {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 280px;
    max-height: calc(100% - 2rem);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.95));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    z-index: 100;
  }

  .effects-panel.collapsed {
    width: auto;
    max-height: none;
  }

  /* Header */
  .panel-header {
    flex-shrink: 0;
  }

  .header-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--theme-text, #ffffff);
    font-size: 0.875rem;
    font-weight: 600;
    text-align: left;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  }

  .header-toggle:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.05));
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    color: var(--theme-accent);
    font-size: 0.75rem;
  }

  .header-title {
    flex: 1;
  }

  .enabled-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--theme-accent);
    color: white;
    font-size: 0.6875rem;
    font-weight: 600;
  }

  .collapse-icon {
    font-size: 0.625rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    transition: transform 0.2s ease;
  }

  .collapse-icon.collapsed {
    transform: rotate(180deg);
  }

  /* Content */
  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 0 1rem;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .panel-content::-webkit-scrollbar {
    width: 4px;
  }

  .panel-content::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .panel-content::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 2px;
  }

  /* Control Row */
  .control-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 28px;
  }

  .control-label {
    flex-shrink: 0;
    font-size: 0.75rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    min-width: 60px;
  }

  .value-display {
    flex-shrink: 0;
    font-size: 0.6875rem;
    font-family: "SF Mono", Consolas, monospace;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    min-width: 36px;
    text-align: right;
  }

  /* Slider */
  .slider {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    border-radius: 2px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    cursor: pointer;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--theme-accent);
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    transition: transform 0.1s ease;
  }

  .slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }

  .slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--theme-accent);
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }

  /* Button Group */
  .button-group {
    display: flex;
    gap: 2px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 6px;
    padding: 2px;
    flex: 1;
  }

  .mode-btn {
    flex: 1;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.6875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mode-btn:hover {
    color: var(--theme-text, #ffffff);
  }

  .mode-btn.active {
    background: var(--theme-accent);
    color: white;
  }

  /* Color Options */
  .color-options {
    display: flex;
    gap: 4px;
    flex: 1;
    justify-content: flex-end;
  }

  .color-btn {
    width: 24px;
    height: 24px;
    padding: 2px;
    border: 2px solid transparent;
    border-radius: 50%;
    background: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .color-btn.active {
    border-color: var(--theme-accent);
  }

  .color-swatch {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: var(--swatch-color);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  /* Mini Toggle */
  .mini-toggle {
    position: relative;
    display: inline-block;
    width: 32px;
    height: 18px;
    cursor: pointer;
    margin-left: auto;
  }

  .mini-toggle input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
    margin: 0;
    z-index: 2;
  }

  .mini-slider {
    position: absolute;
    inset: 0;
    background: rgba(120, 120, 128, 0.32);
    border-radius: 999px;
    transition: all 0.2s ease;
  }

  .mini-slider::before {
    content: "";
    position: absolute;
    height: 14px;
    width: 14px;
    left: 2px;
    top: 2px;
    background: white;
    border-radius: 50%;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .mini-toggle input:checked + .mini-slider {
    background: var(--theme-accent, #007aff);
  }

  .mini-toggle input:checked + .mini-slider::before {
    left: 16px;
  }

  /* Footer */
  .panel-footer {
    padding: 0.75rem 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin-top: 0.5rem;
  }

  .reset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem;
    border: none;
    border-radius: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .reset-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  /* Responsive */
  @media (max-width: 400px) {
    .effects-panel {
      width: calc(100% - 2rem);
      max-width: 280px;
    }
  }

  /* Accessibility */
  @media (prefers-reduced-motion: reduce) {
    .collapse-icon,
    .slider::-webkit-slider-thumb,
    .mode-btn,
    .color-btn,
    .mini-slider,
    .mini-slider::before,
    .reset-btn {
      transition: none;
    }
  }
</style>
