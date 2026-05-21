<script lang="ts">
  /**
   * EffectsSettingsPanel - Visual effects controls for 3D viewer
   *
   * 13 unified per-tip effects (trails/fire/led/charcoal/zap/sparkles/
   * echo/bloom/water/bubbles/petals/smoke/ink) + 1 scene-level motion modifier.
   * Uses chip-style buttons consistent with GridSettingsPanel.
   *
   * Accepts an optional `performer` prop. When provided, reads/writes that
   * performer's `settings.effects` Set via `performer.toggleEffect()`.
   * When absent, reads the unified EffectsConfig via
   * `getEffectsConfigContext()` plus the Scene3DRenderConfig for motion.
   */

  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { getScene3DRenderContext } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";
  import { createScene3DRenderState } from "$lib/shared/3d/scene-features/state/scene-3d-render-state.svelte";
  import {
    getPrimaryParam,
    setPrimaryParam,
    PRIMARY_PARAMS,
  } from "$lib/shared/animation-engine/components/effects-panel/effect-primary-param";
  import { EFFECTS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
  import type { AvatarInstanceState } from "$lib/shared/3d/state/avatar-instance-state.svelte";
  import type { EffectId } from "$lib/shared/3d/state/performer-settings-types";
  import type { EffectType } from "$lib/shared/effects/domain/EffectsConfig";

  interface Props {
    performer?: AvatarInstanceState | null;
  }
  let { performer = null }: Props = $props();

  const config = getEffectsConfigContext() ?? createEffectsConfigState();
  const scene3DRender = getScene3DRenderContext() ?? createScene3DRenderState();

  // Grid combines the 12 unified effects + motion (scene-level render modifier).
  // Registry is canonical for order, label, icon, color.
  type EffectKey = EffectType | "motion";
  const effectChips: ReadonlyArray<{ key: EffectKey; label: string; icon: string; color: string }> = [
    ...EFFECTS.map((e) => ({
      key: e.id as EffectType,
      label: e.label,
      icon: e.icon.replace(/^fa-/, ""),
      color: e.color,
    })),
    { key: "motion" as const, label: "Motion", icon: "wind", color: "#22d3ee" },
  ];

  // Per-performer Sets use the legacy EffectId union. Translate between the
  // canonical EffectType and EffectId where they diverge; unrepresentable
  // keys (echo/water/bubbles/petals/smoke/ink) hide from the per-performer
  // toggle - Phase 2.5 migrates the per-performer Set to the canonical enum.
  function toPerformerEffect(key: EffectKey): EffectId | null {
    if (key === "zap") return "electricity";
    if (key === "motion") return "motion";
    if (
      key === "echo" ||
      key === "water" ||
      key === "bubbles" ||
      key === "petals" ||
      key === "smoke" ||
      key === "ink" ||
      key === "none"
    ) {
      return null;
    }
    return key as EffectId;
  }

  function isEnabled(key: EffectKey): boolean {
    if (performer) {
      const pk = toPerformerEffect(key);
      return pk !== null && performer.effectiveEffects.has(pk);
    }
    if (key === "motion") {
      return scene3DRender.motion.blur || scene3DRender.motion.speedLines;
    }
    return config.config.tipEffectMap["*"]?.effect === key;
  }

  function toggle(key: EffectKey) {
    if (performer) {
      const pk = toPerformerEffect(key);
      if (pk !== null) performer.toggleEffect(pk);
      return;
    }
    if (key === "motion") {
      const motionEnabled = scene3DRender.motion.blur || scene3DRender.motion.speedLines;
      scene3DRender.updateMotion({
        blur: !motionEnabled,
        speedLines: !motionEnabled,
      });
      return;
    }
    // Global fallback - wildcard tip map. Toggling the active effect off
    // returns to "none" so the grid has a consistent off-state semantic.
    const currentlyActive = config.config.tipEffectMap["*"]?.effect === key;
    config.setTipEffectMap({ "*": { effect: currentlyActive ? "none" : key } });
  }

  // Intensity slider for active effects
  let expandedEffect = $state<EffectKey | null>(null);

  function toggleExpand(key: EffectKey) {
    expandedEffect = expandedEffect === key ? null : key;
  }

  function getIntensity(key: EffectKey): number {
    if (key === "motion") return scene3DRender.motion.intensity;
    const spec = PRIMARY_PARAMS[key as EffectType];
    if (!spec) return 0.5;
    const raw = getPrimaryParam(key as EffectType, config);
    return (raw - spec.min) / (spec.max - spec.min);
  }

  function setIntensity(key: EffectKey, value: number) {
    if (key === "motion") {
      scene3DRender.updateMotion({ intensity: value });
      return;
    }
    const spec = PRIMARY_PARAMS[key as EffectType];
    if (!spec) return;
    const raw = spec.min + value * (spec.max - spec.min);
    const snapped = Math.round(raw / spec.step) * spec.step;
    setPrimaryParam(key as EffectType, config, snapped);
  }

  const globalEnabledCount = $derived(
    (config.config.tipEffectMap["*"]?.effect && config.config.tipEffectMap["*"].effect !== "none" ? 1 : 0) +
    (scene3DRender.motion.blur || scene3DRender.motion.speedLines ? 1 : 0),
  );
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

  <!-- Trail Mode + Tracking (when trails enabled globally) -->
  {#if isEnabled("trails") && !performer}
    <div class="sub-control">
      <span class="sub-label">{t("viewer3d_color")}</span>
      <div class="mode-chips">
        <button
          class="mode-chip"
          class:active={config.trails.rainbow}
          onclick={() => config.updateTrails({ rainbow: true })}
          aria-label="Trail color: Rainbow"
          aria-pressed={config.trails.rainbow}
        >
          Rainbow
        </button>
        <button
          class="mode-chip"
          class:active={!config.trails.rainbow}
          onclick={() => config.updateTrails({ rainbow: false })}
          aria-label="Trail color: Solid"
          aria-pressed={!config.trails.rainbow}
        >
          Solid
        </button>
      </div>
    </div>

    <div class="sub-control">
      <span class="sub-label">{t("viewer3d_track")}</span>
      <div class="mode-chips triple">
        <button
          class="mode-chip"
          class:active={config.trails.trackingMode === "left_end"}
          onclick={() => config.updateTrails({ trackingMode: "left_end" })}
          aria-label="Track left end only"
          aria-pressed={config.trails.trackingMode === "left_end"}
          title="Track left end only"
        >
          Left
        </button>
        <button
          class="mode-chip"
          class:active={config.trails.trackingMode === "both_ends"}
          onclick={() => config.updateTrails({ trackingMode: "both_ends" })}
          aria-label="Track both ends"
          aria-pressed={config.trails.trackingMode === "both_ends"}
          title="Track both ends"
        >
          Both
        </button>
        <button
          class="mode-chip"
          class:active={config.trails.trackingMode === "right_end"}
          onclick={() => config.updateTrails({ trackingMode: "right_end" })}
          aria-label="Track right end only"
          aria-pressed={config.trails.trackingMode === "right_end"}
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
  {#if performer}
    {@const count = performer.effectiveEffects.size}
    {#if count > 0}
      <div class="active-count">
        {count} effect{count > 1 ? "s" : ""} active
      </div>
    {/if}
  {:else if globalEnabledCount > 0}
    <div class="active-count">
      {globalEnabledCount} effect{globalEnabledCount > 1 ? "s" : ""} active
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
