<script lang="ts">
  /**
   * EffectsSettingsPanel - Visual effects controls for 3D viewer
   *
   * Toggle trails, fire, sparkles, electricity, motion effects, and bloom.
   * Uses chip-style buttons consistent with GridSettingsPanel.
   */

  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { getEffectsConfigState } from "../../effects/state/effects-config-state.svelte";

  const config = getEffectsConfigState();

  // Effect definitions for rendering
  const effectChips = [
    { key: "trails", label: "Trails", icon: "route", color: "#a855f7" },
    { key: "fire", label: "Fire", icon: "fire", color: "#f97316" },
    { key: "sparkles", label: "Sparkles", icon: "star", color: "#fbbf24" },
    { key: "electricity", label: "Zap", icon: "bolt", color: "#38bdf8" },
    { key: "motion", label: "Motion", icon: "wind", color: "#22d3ee" },
    { key: "bloom", label: "Glow", icon: "sun", color: "#f472b6" },
  ] as const;

  type EffectKey = (typeof effectChips)[number]["key"];

  // Check if an effect is enabled
  function isEnabled(key: EffectKey): boolean {
    switch (key) {
      case "trails":
        return config.trails.enabled;
      case "fire":
        return config.fire.enabled;
      case "sparkles":
        return config.sparkles.enabled;
      case "electricity":
        return config.electricity.enabled;
      case "motion":
        return config.motion.blur || config.motion.speedLines;
      case "bloom":
        return config.bloom.enabled;
      default:
        return false;
    }
  }

  // Toggle an effect
  function toggle(key: EffectKey) {
    switch (key) {
      case "trails":
        config.toggleTrails();
        break;
      case "fire":
        config.toggleFire();
        break;
      case "sparkles":
        config.toggleSparkles();
        break;
      case "electricity":
        config.toggleElectricity();
        break;
      case "motion":
        // Toggle both blur and speed lines together
        const motionEnabled = config.motion.blur || config.motion.speedLines;
        config.updateMotion({
          blur: !motionEnabled,
          speedLines: !motionEnabled,
        });
        break;
      case "bloom":
        config.toggleBloom();
        break;
    }
  }

  // Trail mode toggle
  const trailModes = [
    { value: "rainbow", label: "Rainbow" },
    { value: "color", label: "Color" },
  ] as const;

  const isRainbow = $derived(config.trails.color === "rainbow");

  // Trail tracking mode (which prop end(s) to track)
  const trackingModeLabel = $derived(config.getTrackingModeLabel());

  // Intensity slider for active effects
  let expandedEffect = $state<EffectKey | null>(null);

  function toggleExpand(key: EffectKey) {
    expandedEffect = expandedEffect === key ? null : key;
  }

  function getIntensity(key: EffectKey): number {
    switch (key) {
      case "trails":
        return config.trails.width / 10; // Normalize 0-10 to 0-1
      case "fire":
        return config.fire.intensity;
      case "sparkles":
        return config.sparkles.rate / 50; // Normalize 0-50 to 0-1
      case "electricity":
        return config.electricity.intensity;
      case "motion":
        return config.motion.intensity;
      case "bloom":
        return config.bloom.intensity;
      default:
        return 0.5;
    }
  }

  function setIntensity(key: EffectKey, value: number) {
    switch (key) {
      case "trails":
        config.updateTrails({ width: value * 10 });
        break;
      case "fire":
        config.updateFire({ intensity: value });
        break;
      case "sparkles":
        config.updateSparkles({ rate: value * 50 });
        break;
      case "electricity":
        config.updateElectricity({ intensity: value });
        break;
      case "motion":
        config.updateMotion({ intensity: value });
        break;
      case "bloom":
        config.updateBloom({ intensity: value });
        break;
    }
  }
</script>

<section class="effects-settings">
  <h3>{t("viewer3d_effects")}</h3>

  <!-- Effect Chips Grid -->
  <div class="effect-chips">
    {#each effectChips as effect}
      {@const enabled = isEnabled(effect.key)}
      <button
        class="effect-chip"
        class:active={enabled}
        style="--color: {effect.color}"
        onclick={() => toggle(effect.key)}
        ondblclick={() => enabled && toggleExpand(effect.key)}
        aria-label={enabled ? `${effect.label} (double-click to adjust)` : `Enable ${effect.label}`}
        aria-pressed={enabled}
        title={enabled ? "Double-click to adjust" : "Click to enable"}
      >
        <i class="fas fa-{effect.icon}" aria-hidden="true"></i>
        <span>{effect.label}</span>
      </button>
    {/each}
  </div>

  <!-- Trail Mode Toggle (when trails enabled) -->
  {#if config.trails.enabled}
    <div class="sub-control">
      <span class="sub-label">{t("viewer3d_color")}</span>
      <div class="mode-chips">
        <button
          class="mode-chip"
          class:active={isRainbow}
          onclick={() => config.setTrailMode("rainbow")}
          aria-label="Trail color: Rainbow"
          aria-pressed={isRainbow}
        >
          Rainbow
        </button>
        <button
          class="mode-chip"
          class:active={!isRainbow}
          onclick={() => config.setTrailMode("color")}
          aria-label="Trail color: Solid"
          aria-pressed={!isRainbow}
        >
          Solid
        </button>
      </div>
    </div>

    <!-- Trail Tracking Mode (which end(s) to track) -->
    <div class="sub-control">
      <span class="sub-label">{t("viewer3d_track")}</span>
      <div class="mode-chips triple">
        <button
          class="mode-chip"
          class:active={trackingModeLabel === "left"}
          onclick={() => config.setTrackingMode("left")}
          aria-label="Track left end only"
          aria-pressed={trackingModeLabel === "left"}
          title="Track left end only"
        >
          Left
        </button>
        <button
          class="mode-chip"
          class:active={trackingModeLabel === "both"}
          onclick={() => config.setTrackingMode("both")}
          aria-label="Track both ends"
          aria-pressed={trackingModeLabel === "both"}
          title="Track both ends"
        >
          Both
        </button>
        <button
          class="mode-chip"
          class:active={trackingModeLabel === "right"}
          onclick={() => config.setTrackingMode("right")}
          aria-label="Track right end only"
          aria-pressed={trackingModeLabel === "right"}
          title="Track right end only"
        >
          Right
        </button>
      </div>
    </div>
  {/if}

  <!-- Intensity Slider (when an effect is expanded) -->
  {#if expandedEffect && isEnabled(expandedEffect)}
    {@const effect = effectChips.find((e) => e.key === expandedEffect)!}
    <div class="intensity-control" style="--color: {effect.color}">
      <span class="sub-label">{effect.label} Intensity</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={getIntensity(expandedEffect)}
        oninput={(e) =>
          expandedEffect &&
          setIntensity(expandedEffect, parseFloat(e.currentTarget.value))}
        class="intensity-slider"
      />
    </div>
  {/if}

  <!-- Quick Info -->
  {#if config.enabledCount > 0}
    <div class="active-count">
      {config.enabledCount} effect{config.enabledCount > 1 ? "s" : ""} active
    </div>
  {/if}
</section>

<style>
  .effects-settings {
    padding: 1rem;
    background: var(--theme-card-bg);
    border-radius: 12px;
    border: 1px solid var(--theme-stroke);
  }

  h3 {
    margin: 0 0 0.75rem;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-dim);
  }

  .effect-chips {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .effect-chip {
    min-height: var(--min-touch-target);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .effect-chip i {
    font-size: 1rem;
    opacity: 0.6;
    transition: all var(--duration-fast);
  }

  .effect-chip:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
    border-color: var(--theme-stroke-strong);
  }

  .effect-chip:hover i {
    opacity: 0.9;
  }

  .effect-chip.active {
    background: color-mix(in srgb, var(--color) 20%, transparent);
    border-color: var(--color);
    color: var(--theme-text);
  }

  .effect-chip.active i {
    color: var(--color);
    opacity: 1;
  }

  .sub-control {
    margin-top: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sub-label {
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text-dim);
    flex-shrink: 0;
  }

  .mode-chips {
    display: flex;
    gap: 0.25rem;
    flex: 1;
  }

  .mode-chips.triple .mode-chip {
    padding: 0 0.5rem;
    font-size: var(--font-size-compact, 12px);
  }

  .mode-chip {
    flex: 1;
    min-height: 36px;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .mode-chip:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .mode-chip.active {
    background: var(--theme-accent);
    border-color: var(--theme-accent);
    color: white;
  }

  .intensity-control {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .intensity-slider {
    width: 100%;
    height: 6px;
    appearance: none;
    background: var(--theme-panel-bg);
    border-radius: 3px;
    outline: none;
    cursor: pointer;
  }

  .intensity-slider::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    background: var(--color);
    border-radius: 50%;
    cursor: pointer;
    transition: transform var(--duration-instant);
  }

  .intensity-slider::-webkit-slider-thumb:hover {
    transform: scale(1.1);
  }

  .intensity-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: var(--color);
    border: none;
    border-radius: 50%;
    cursor: pointer;
  }

  .active-count {
    margin-top: 0.75rem;
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text-dim);
    text-align: center;
  }

  @media (max-width: 400px) {
    .effect-chips {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
