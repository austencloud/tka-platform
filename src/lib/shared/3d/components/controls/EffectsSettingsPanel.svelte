<script lang="ts">
  /**
   * EffectsSettingsPanel - Visual effects controls for 3D viewer
   *
   * 13 unified per-tip effects (trails/fire/led/charcoal/zap/sparkles/
   * echo/bloom/water/bubbles/petals/smoke/ink) + 1 scene-level motion modifier.
   * Uses chip-style buttons consistent with GridSettingsPanel.
   *
   * Three scopes, in precedence order:
   *   - `performers` (All-Performers mode): reads/writes EVERY performer's
   *     `setEffect()` as a group radio. The grid shows an effect active only
   *     when all performers share it; toggling broadcasts to all.
   *   - `performer` (single): reads/writes that one performer's override,
   *     inheriting the global default when the override is null.
   *   - neither (global): reads/writes the unified EffectsConfig wildcard via
   *     `getEffectsConfigContext()`.
   * Motion is a scene-level modifier in every scope.
   */

  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { getScene3DRenderContext } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";
  import { createScene3DRenderState } from "$lib/shared/3d/scene-features/state/scene-3d-render-state.svelte";
  import { EFFECTS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
  import { isEffectId } from "$lib/shared/effects/state/effects-config-state.svelte";
  import EffectControlStack from "$lib/shared/effects/components/EffectControlStack.svelte";
  import {
    EFFECTS_WITH_3D_RENDERER,
    advancedControls,
  } from "$lib/shared/effects/domain/effect-control-manifest";
  import type { EffectId } from "$lib/shared/effects/state/effects-config-state.svelte";
  import type { AvatarInstanceState } from "$lib/shared/3d/state/avatar-instance-state.svelte";
  import type { EffectType } from "$lib/shared/effects/domain/effects-config";

  interface Props {
    performer?: AvatarInstanceState | null;
    /** All-Performers mode: apply every change to this whole group. */
    performers?: AvatarInstanceState[] | null;
  }
  let { performer = null, performers = null }: Props = $props();

  // Non-empty group => broadcast scope (All-Performers). Takes precedence over
  // the single-performer path.
  const multi = $derived(performers && performers.length > 0 ? performers : null);

  const config = getEffectsConfigContext() ?? createEffectsConfigState();
  const scene3DRender = getScene3DRenderContext() ?? createScene3DRenderState();

  // Grid combines the 12 unified effects + motion (scene-level render modifier).
  // Registry is canonical for order, label, icon, color.
  type EffectKey = EffectType | "motion";
  // Only effects with a live 3D renderer are listed in the 3D viewer — the
  // renderer-less effects (zap/echo/water/…) are no-ops here. Motion stays as a
  // scene-level modifier.
  const effectChips: ReadonlyArray<{ key: EffectKey; label: string; icon: string; color: string }> = [
    ...EFFECTS.filter((e) => EFFECTS_WITH_3D_RENDERER.has(e.id as EffectId)).map((e) => ({
      key: e.id as EffectType,
      label: e.label,
      icon: e.icon.replace(/^fa-/, ""),
      color: e.color,
    })),
    { key: "motion" as const, label: "Motion", icon: "wind", color: "#22d3ee" },
  ];

  // The single per-performer effect now uses the canonical EffectType directly
  // (no legacy EffectId translation), so the full 16-effect grid is selectable
  // per performer. Motion stays a scene-level modifier in both modes.
  // The global default a performer inherits when it has no override is the
  // effects-config wildcard.
  const inheritedEffect = $derived(config.config.tipEffectMap["*"]?.effect ?? "none");
  const performerEffect = $derived.by<EffectKey | null>(() => {
    if (multi) {
      // The group shares an effect only when every performer resolves to the
      // same one; a mixed group reads as "none" (nothing highlighted).
      const first = multi[0]!.rawEffect ?? inheritedEffect;
      const allSame = multi.every((p) => (p.rawEffect ?? inheritedEffect) === first);
      return allSame ? first : "none";
    }
    return performer ? (performer.rawEffect ?? inheritedEffect) : null;
  });

  function isEnabled(key: EffectKey): boolean {
    if (key === "motion") {
      return scene3DRender.motion.blur || scene3DRender.motion.speedLines;
    }
    if (multi || performer) {
      return performerEffect === key;
    }
    return config.config.tipEffectMap["*"]?.effect === key;
  }

  function toggle(key: EffectKey) {
    if (key === "motion") {
      const motionEnabled = scene3DRender.motion.blur || scene3DRender.motion.speedLines;
      scene3DRender.updateMotion({
        blur: !motionEnabled,
        speedLines: !motionEnabled,
      });
      return;
    }
    if (multi) {
      // Group radio: if every performer already has this effect, clicking it
      // turns it off for all; otherwise set every performer to it.
      const allActive = multi.every((p) => (p.rawEffect ?? inheritedEffect) === key);
      for (const p of multi) p.setEffect(allActive ? "none" : (key as EffectType));
      return;
    }
    if (performer) {
      // Radio: clicking the active effect turns it off ("none"); clicking
      // another replaces it. Reset-to-inherit is the CascadeBadge's job.
      const active = performerEffect === key;
      performer.setEffect(active ? "none" : (key as EffectType));
      return;
    }
    // Global mode - wildcard tip map. Toggling the active effect off returns
    // to "none" so the grid has a consistent off-state semantic.
    const currentlyActive = config.config.tipEffectMap["*"]?.effect === key;
    config.setTipEffectMap({ "*": { effect: currentlyActive ? "none" : key } });
  }

  const globalEnabledCount = $derived(
    (config.config.tipEffectMap["*"]?.effect && config.config.tipEffectMap["*"].effect !== "none" ? 1 : 0) +
    (scene3DRender.motion.blur || scene3DRender.motion.speedLines ? 1 : 0),
  );

  // --- Curated per-effect tuning ---
  // The tuned params live in the shared EffectsConfig (global by design), so the
  // sliders show whenever an effect with a curated 3D knob set is the active
  // one — in every scope, no double-click. The currently-enabled chip IS the
  // selection; its knobs appear above the grid automatically.
  const activeEffectKey = $derived.by<EffectKey | null>(() => {
    for (const c of effectChips) {
      if (c.key !== "motion" && isEnabled(c.key)) return c.key;
    }
    return null;
  });
  // The active effect's id (if it's a real effect, not motion) — drives the
  // shared control stack rendered above the chip grid.
  const activeEffectId = $derived(
    activeEffectKey && isEffectId(activeEffectKey) ? (activeEffectKey as EffectId) : null,
  );
  let showAdvanced = $state(false);
  const hasAdvanced = $derived(activeEffectId ? advancedControls(activeEffectId).length > 0 : false);

  // --- Footer: Copy Diagnostic / Save Defaults / Reset ---
  let copyStatus = $state<"idle" | "copied" | "failed">("idle");
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  async function copyDiagnostic() {
    const { trails, fire, led, charcoal } = config.config;
    const json = JSON.stringify({ trails, fire, led, charcoal }, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      copyStatus = "copied";
    } catch {
      console.log("[3d-effect-tuning]", json);
      copyStatus = "failed";
    }
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copyStatus = "idle"), 2500);
  }

  const copyLabel = $derived(
    copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy failed" : "Copy Diagnostic",
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
        aria-label={enabled ? effect.label : `Enable ${effect.label}`}
        aria-pressed={enabled}
        title={enabled ? effect.label : "Click to enable"}
      >
        <i class="fas fa-{effect.icon}" aria-hidden="true"></i>
        <span>{effect.label}</span>
      </button>
    {/each}
  </div>

  <!-- Active effect's controls, from the shared manifest (same controls 2D
       renders). Shown automatically while that effect is on — no double-click. -->
  {#if activeEffectId}
    <div class="effect-controls">
      <EffectControlStack effect={activeEffectId} {config} />
      {#if hasAdvanced}
        <button
          type="button"
          class="advanced-toggle"
          aria-expanded={showAdvanced}
          onclick={() => (showAdvanced = !showAdvanced)}
        >
          <i class="fas fa-{showAdvanced ? 'chevron-up' : 'chevron-down'}" aria-hidden="true"></i>
          Advanced
        </button>
        {#if showAdvanced}
          <EffectControlStack effect={activeEffectId} {config} tiers={["advanced"]} />
        {/if}
      {/if}
    </div>
  {/if}

  <!-- Quick Info -->
  {#if multi || performer}
    {#if performerEffect && performerEffect !== "none"}
      <div class="active-count">1 effect active</div>
    {/if}
  {:else if globalEnabledCount > 0}
    <div class="active-count">
      {globalEnabledCount} effect{globalEnabledCount > 1 ? "s" : ""} active
    </div>
  {/if}

  <!-- Tuning footer: copy current tuning, save as baseline, reset to baseline.
       Tuning is global, so this shows in every scope. -->
  <div class="tune-footer">
    <button
      class="footer-btn copy-btn"
      class:copied={copyStatus === "copied"}
      class:failed={copyStatus === "failed"}
      onclick={copyDiagnostic}
      title="Copy current effect tuning as JSON (paste to bake into defaults)"
    >
      {copyLabel}
    </button>
    <button class="footer-btn" onclick={() => config.saveAsBaseline()} title="Save current tuning as the default Reset returns to">
      Save Defaults
    </button>
    <button class="footer-btn" onclick={() => config.resetToBaseline()} title="Reset tuning to the saved default">
      Reset
    </button>
  </div>
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

  /* Two rows of square touch-target buttons that flow into columns and expand
     widthwise (horizontal scroll past the panel width). */
  .effect-chips {
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: repeat(2, 1fr);
    grid-auto-columns: 64px;
    gap: 0.5rem;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 0.35rem;
    scrollbar-width: thin;
    scrollbar-color: var(--theme-stroke-strong) transparent;
  }

  .effect-chip {
    width: 64px;
    height: 64px;
    min-height: var(--min-touch-target);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 14px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .effect-chip span {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Icons carry their effect color at all times (matches the 2D panel), dimmed
     a touch until active. */
  .effect-chip i {
    font-size: 1.1rem;
    color: var(--color);
    opacity: 0.85;
    transition: all var(--duration-fast);
  }

  .effect-chip:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
    border-color: var(--theme-stroke-strong);
  }

  .effect-chip:hover i {
    opacity: 1;
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

  /* Active effect's control stack, rendered above the chip grid. */
  .effect-controls {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .advanced-toggle {
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: none;
    border: none;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 500;
    cursor: pointer;
    padding: 0.2rem 0;
  }
  .advanced-toggle:hover {
    color: var(--theme-text);
  }
  .advanced-toggle i {
    font-size: 0.7rem;
  }

  .active-count {
    margin-top: 0.75rem;
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text-dim);
    text-align: center;
  }

  /* Footer actions: equal thirds so the Copy label swapping
     ("Copy Diagnostic" → "Copied") can't reflow its neighbours. */
  .tune-footer {
    /* The parent (.effects-section) gives .effect-chips order:10; this keeps the
       Save/Reset/Copy row below the chip grid while the tuning sliders float
       above it. */
    order: 11;
    margin-top: 0.75rem;
    display: flex;
    gap: 0.4rem;
  }

  .footer-btn {
    flex: 1;
    min-width: 0;
    min-height: 36px;
    padding: 0 0.4rem;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: all var(--duration-fast);
  }

  .footer-btn:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
    border-color: var(--theme-stroke-strong);
  }

  .copy-btn.copied {
    color: var(--theme-success, #4ade80);
    border-color: var(--theme-success, #4ade80);
  }

  .copy-btn.failed {
    color: var(--theme-danger, #f87171);
    border-color: var(--theme-danger, #f87171);
  }

  @media (max-width: 400px) {
    .effect-chips {
      grid-auto-columns: 56px;
    }
    .effect-chip {
      width: 56px;
      height: 56px;
    }
  }
</style>
