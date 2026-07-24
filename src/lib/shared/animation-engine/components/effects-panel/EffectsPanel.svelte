<script lang="ts">
  import type { Snippet, Component } from "svelte";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import {
    isEffectId,
    type EffectId,
  } from "$lib/shared/effects/state/effects-config-state.svelte";
  import EffectSelector from "./EffectSelector.svelte";
  import EffectPresetsSection from "./EffectPresetsSection.svelte";
  import {
    EFFECT_COLORS,
    EFFECT_LABELS,
    EFFECTS,
    getRegistration,
  } from "./effect-registry";
  import type { EffectRegistration } from "./effect-registry";
  import { matchPresetId, valuesEqual } from "./presets/match-preset";
  import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
  import ConfirmDialog from "$lib/shared/foundation/ui/ConfirmDialog.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import EffectTuneStrip from "$lib/shared/effects/components/EffectTuneStrip.svelte";
  import { createEffectControlOverrides } from "$lib/shared/effects/effect-control-fields";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";

  /** Synthetic chip id for the factory default look (not a named preset). */
  const DEFAULT_CHIP_ID = "__default__";
  /** Synthetic chip id for the user's auto-captured custom look. */
  const CUSTOM_CHIP_ID = "__custom__";
  import TempoControl from "$lib/shared/animation-panel/components/TempoControl.svelte";
  import TransportControls from "$lib/shared/animation-engine/components/controls/TransportControls.svelte";
  import type { PrimaryParamSpec } from "./effect-primary-param";

  interface Props {
    bpm: number;
    onBpmChange: (bpm: number) => void;
    isPlaying: boolean;
    onPlaybackToggle: () => void;
    onStepForward?: () => void;
    onStepBackward?: () => void;
    onHalfStepForward?: () => void;
    onHalfStepBackward?: () => void;
    showPlayback?: boolean;
    showTransport?: boolean;
    showExportControls?: boolean;
    layout?: "sidebar" | "strip" | "grid";
    children?: Snippet;
    onSettingChange?: (
      setting: string,
      previousValue: string | number | boolean | null,
      value: string | number | boolean | null,
      coalesce?: boolean
    ) => void;
  }

  const {
    bpm,
    onBpmChange,
    isPlaying,
    onPlaybackToggle,
    onStepForward,
    onStepBackward,
    onHalfStepForward,
    onHalfStepBackward,
    showPlayback = true,
    showTransport = true,
    showExportControls = false,
    layout = "sidebar",
    children,
    onSettingChange,
  }: Props = $props();

  const effectsConfigState = getEffectsConfigContext()!;

  let customizeOpen = $state(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let CustomizeComponent = $state<Component<any> | null>(null);

  const activeEffect = $derived(effectsConfigState.activeEffect);
  const registration = $derived<EffectRegistration | undefined>(
    activeEffect !== "none" ? getRegistration(activeEffect) : undefined
  );

  // Trails and fire keep a few values outside their effect intent. Both viewer
  // surfaces use the same adapters so their FX controls display and edit the
  // same values.
  const tuneOverrides = $derived(
    isEffectId(activeEffect)
      ? createEffectControlOverrides(
          activeEffect,
          effectsConfigState,
          animationSettings
        )
      : undefined
  );

  // Honest highlight. Priority:
  //   1. live config == factory default            → Default chip (canonical anchor)
  //   2. live config matches a named preset's patch → that preset
  //   3. live config == your captured custom look   → Custom chip
  // Tuning away from all three lights nothing.
  const activePresetId = $derived.by(() => {
    if (activeEffect === "none" || !registration) return null;
    const fx = activeEffect as EffectId;
    const effectConfig = effectsConfigState.effect(fx) as unknown as Record<
      string,
      unknown
    >;
    // 1. The factory default look → the synthetic Default chip.
    const factory = (
      DEFAULT_EFFECTS_CONFIG as unknown as Record<string, unknown>
    )[fx];
    if (valuesEqual(effectConfig, factory)) return DEFAULT_CHIP_ID;
    // 2. A named preset whose static patch the live config matches.
    const matched = matchPresetId(registration.presetGroup, effectConfig);
    if (matched) return matched;
    // 3. Your captured custom look → the synthetic Custom chip.
    const custom = effectsConfigState.personalDefault(fx) as unknown as Record<
      string,
      unknown
    > | null;
    if (
      custom &&
      effectsConfigState.hasCustom(fx) &&
      valuesEqual(effectConfig, custom)
    )
      return CUSTOM_CHIP_ID;
    return null;
  });

  const currentSummary = $derived.by(() => {
    if (!registration) return "";
    return registration.presetGroup.getSummary(effectsConfigState);
  });

  const primarySpec = $derived<PrimaryParamSpec | undefined>(
    registration?.primaryParam
  );
  const primaryValue = $derived.by(() => {
    if (!primarySpec) return 0;
    return primarySpec.get(effectsConfigState);
  });

  type SettingValue = string | number | boolean | null;
  function reportSetting(
    setting: string,
    previousValue: SettingValue,
    value: SettingValue,
    coalesce = false
  ): void {
    if (previousValue === value) return;
    onSettingChange?.(setting, previousValue, value, coalesce);
  }

  function primitiveSnapshot(effectId: EffectId): Record<string, SettingValue> {
    const current = effectsConfigState.effect(effectId) as unknown as Record<
      string,
      unknown
    >;
    const snapshot: Record<string, SettingValue> = {};

    function collect(path: string, value: unknown): void {
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        snapshot[path] = value;
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item, index) => collect(`${path}_${index + 1}`, item));
        return;
      }
      if (value && typeof value === "object") {
        for (const [field, item] of Object.entries(value)) {
          collect(`${path}_${field}`, item);
        }
      }
    }

    for (const [field, value] of Object.entries(current)) {
      collect(field, value);
    }
    return snapshot;
  }

  // Desktop customize components mutate the shared effects state directly. A
  // primitive-field diff keeps those controls observable without exporting a
  // config blob. Mobile tuning reports at the shared control primitive below.
  let observedCustomizationEffect: EffectId | null = null;
  let customizationSnapshot: Record<string, SettingValue> | null = null;
  function syncCustomizationSnapshot(): void {
    if (activeEffect === "none" || !isEffectId(activeEffect)) return;
    observedCustomizationEffect = activeEffect;
    customizationSnapshot = primitiveSnapshot(activeEffect);
  }
  $effect(() => {
    void effectsConfigState.version;
    if (
      !onSettingChange ||
      layout === "strip" ||
      !customizeOpen ||
      activeEffect === "none" ||
      !isEffectId(activeEffect)
    ) {
      observedCustomizationEffect = null;
      customizationSnapshot = null;
      return;
    }

    const current = primitiveSnapshot(activeEffect);
    if (customizationSnapshot && observedCustomizationEffect === activeEffect) {
      for (const [field, value] of Object.entries(current)) {
        const previous = customizationSnapshot[field];
        if (previous !== undefined && previous !== value) {
          reportSetting(
            `tuning_${activeEffect}_${field}`,
            previous,
            value,
            true
          );
        }
      }
    }
    observedCustomizationEffect = activeEffect;
    customizationSnapshot = current;
  });

  function handleEffectSelect(effectId: string): void {
    const previous = activeEffect;
    customizeOpen = false;
    CustomizeComponent = null;
    if (effectId === activeEffect) {
      effectsConfigState.setActiveEffect("none");
      reportSetting("active_effect", previous, "none");
      return;
    }
    if (isEffectId(effectId)) {
      effectsConfigState.setActiveEffect(effectId);
      reportSetting("active_effect", previous, effectId);
    }
  }

  // ── Mobile drill-down (layout="strip") ────────────────────────────────────
  // The Instagram-filter contract: tapping a tile applies the effect live and
  // STAYS in the picker (browsing costs zero navigation); tapping the
  // already-active tile drills into its detail screen (looks + primary slider +
  // More tuning). An explicit Off tile replaces the old tap-again-to-disable
  // toggle, which the drill gesture now owns.
  let detailOpen = $state(false);

  const stripView = $derived<"picker" | "detail" | "customize">(
    customizeOpen && CustomizeComponent
      ? "customize"
      : detailOpen && activeEffect !== "none" && registration
        ? "detail"
        : "picker"
  );

  function handleTileTap(effectId: string): void {
    if (effectId === activeEffect) {
      detailOpen = true;
      return;
    }
    if (isEffectId(effectId)) {
      const previous = activeEffect;
      effectsConfigState.setActiveEffect(effectId);
      reportSetting("active_effect", previous, effectId);
    }
  }

  function handleOffTap(): void {
    const previous = activeEffect;
    detailOpen = false;
    effectsConfigState.setActiveEffect("none");
    reportSetting("active_effect", previous, "none");
  }

  // Hover/press intent: warm the effect's webgl renderer before the click so the
  // switch never freezes. No-op downstream for non-webgl effects.
  function handleEffectPrewarm(effectId: string): void {
    if (isEffectId(effectId)) effectsConfigState.requestPrewarm(effectId);
  }

  function handlePresetSelect(presetId: string): void {
    if (!registration) return;
    const effectId = activeEffect;
    const previous = activePresetId ?? "customized";
    // The Default chip resets to the factory default look.
    if (presetId === DEFAULT_CHIP_ID) {
      if (isEffectId(activeEffect))
        effectsConfigState.resetToFactory(activeEffect);
      syncCustomizationSnapshot();
      reportSetting(`preset_${effectId}`, previous, presetId);
      return;
    }
    // The Custom chip restores your auto-captured custom look.
    if (presetId === CUSTOM_CHIP_ID) {
      if (isEffectId(activeEffect))
        effectsConfigState.restorePersonalDefault(activeEffect);
      syncCustomizationSnapshot();
      reportSetting(`preset_${effectId}`, previous, presetId);
      return;
    }
    const group = registration.presetGroup;
    const preset = group.presets.find((p) => p.id === presetId);
    if (!preset) return;
    const patch = preset.resolvePatch
      ? preset.resolvePatch()
      : (preset.patch ?? {});
    effectsConfigState.applyPreset(group.effectType, preset.id, patch);
    syncCustomizationSnapshot();
    reportSetting(`preset_${effectId}`, previous, presetId);
  }

  // ── Global factory reset (escape hatch in the panel footer) ──────────────
  // Per-effect reset lives on the Default chip itself (clicking Default resets
  // that effect to factory), so there is no separate per-effect reset button.
  let confirmResetAllOpen = $state(false);

  function handleResetAll(): void {
    effectsConfigState.resetAllToFactory();
    reportSetting("reset_all", "configured", "factory_defaults");
  }

  // ── Custom chip (your auto-captured look) ────────────────────────────────
  /** Disabled until the user has captured a custom look (first manual edit). */
  const customDisabled = $derived(
    activeEffect === "none" ||
      !isEffectId(activeEffect) ||
      !effectsConfigState.hasCustom(activeEffect as EffectId)
  );
  /** Trail's Custom chip shows the captured custom blue/red dots; other effects use accent. */
  const customColors = $derived.by(() => {
    if (activeEffect !== "trails") return null;
    const c = effectsConfigState.personalDefault("trails");
    return c ? { blue: c.blueColor, red: c.redColor } : null;
  });

  async function handleCustomizeOpen(): Promise<void> {
    if (!registration) return;
    const mod = await registration.customizeComponent();
    CustomizeComponent = mod.default;
    customizeOpen = true;
  }

  function handleCustomizeClose(): void {
    customizeOpen = false;
    CustomizeComponent = null;
  }

  function handleSliderInput(ev: Event): void {
    if (!primarySpec) return;
    const previous = primaryValue;
    const v = parseFloat((ev.currentTarget as HTMLInputElement).value);
    primarySpec.set(effectsConfigState, v);
    reportSetting(`primary_${activeEffect}`, previous, v, true);
  }
</script>

{#snippet customizeAnchors()}
  <!-- Quick anchors while tuning: snap to factory (Default) or your saved look
       (Custom) without leaving the Customize panel. -->
  <div class="anchor-row">
    <button
      type="button"
      class="anchor-btn"
      class:active={activePresetId === DEFAULT_CHIP_ID}
      onclick={() => handlePresetSelect(DEFAULT_CHIP_ID)}
    >
      Default
    </button>
    <button
      type="button"
      class="anchor-btn"
      class:active={activePresetId === CUSTOM_CHIP_ID}
      class:disabled={customDisabled}
      disabled={customDisabled}
      onclick={() => handlePresetSelect(CUSTOM_CHIP_ID)}
    >
      Custom
    </button>
  </div>
{/snippet}

{#if layout === "sidebar"}
  <div class="effects-panel">
    {#if showPlayback}
      <div class="sb-section">
        <TempoControl
          {bpm}
          {onBpmChange}
          showPresets={false}
          showPractice={false}
          presetsMode="popover"
        />
        {#if showTransport}
          <TransportControls
            {isPlaying}
            {onPlaybackToggle}
            onStepHalfBeatForward={onHalfStepForward}
            onStepHalfBeatBackward={onHalfStepBackward}
            onStepFullBeatForward={onStepForward}
            onStepFullBeatBackward={onStepBackward}
          />
        {/if}
      </div>
    {/if}

    <div class="sb-section">
      <span class="sb-label">EFFECTS</span>
      <EffectSelector
        {activeEffect}
        onSelect={handleEffectSelect}
        onPrewarm={handleEffectPrewarm}
      />
    </div>

    {#if activeEffect !== "none" && !customizeOpen && registration}
      <div class="sb-section">
        <EffectPresetsSection
          presetGroup={registration.presetGroup}
          {activePresetId}
          defaultChipId={DEFAULT_CHIP_ID}
          customChipId={CUSTOM_CHIP_ID}
          {customDisabled}
          {customColors}
          onSelectPreset={handlePresetSelect}
          onCustomize={handleCustomizeOpen}
          effectLabel={EFFECT_LABELS[activeEffect] ?? ""}
          accentColor={EFFECT_COLORS[activeEffect] ?? "#8b5cf6"}
          summary={currentSummary}
        />
      </div>
    {/if}

    {#if customizeOpen && CustomizeComponent}
      <div class="sb-section">
        {@render customizeAnchors()}
        <CustomizeComponent onBack={handleCustomizeClose} />
      </div>
    {/if}

    {#if children}{@render children()}{/if}

    <div class="sb-section sb-footer">
      <button
        type="button"
        class="reset-all-btn"
        onclick={() => (confirmResetAllOpen = true)}
      >
        Reset all effects to original
      </button>
    </div>
  </div>
{:else if layout === "strip"}
  <!-- Mobile drill-down: picker grid (all 16 + Off, no h-scroll) ⇄ per-effect
       detail screen ⇄ deep tuning. Tap a tile = apply live + stay; tap the
       active tile = drill into its detail. -->
  <div class="mep">
    <Crossfade key={stripView}>
      {#if stripView === "customize" && CustomizeComponent}
        <div class="drill-view">
          <!-- Slim one-line header: back + effect name + Default|Custom anchors,
               replacing the old stacked back-row (48px) + anchor-row (56px) with
               a single ~44px row. On a phone tray every reclaimed px goes to the
               canvas above. -->
          <div class="tune-header">
            <button
              type="button"
              class="tune-back"
              onclick={handleCustomizeClose}
              aria-label="Back to {EFFECT_LABELS[activeEffect] ?? activeEffect}"
            >
              <i class="fas fa-arrow-left" aria-hidden="true"></i>
            </button>
            <span class="tune-name"
              >{EFFECT_LABELS[activeEffect] ?? activeEffect}</span
            >
            <div class="tune-anchors">
              <button
                type="button"
                class="tune-anchor"
                class:active={activePresetId === DEFAULT_CHIP_ID}
                onclick={() => handlePresetSelect(DEFAULT_CHIP_ID)}
              >
                Default
              </button>
              <button
                type="button"
                class="tune-anchor"
                class:active={activePresetId === CUSTOM_CHIP_ID}
                disabled={customDisabled}
                onclick={() => handlePresetSelect(CUSTOM_CHIP_ID)}
              >
                Custom
              </button>
            </div>
          </div>
          <!-- Every effect drills through the shared tune-strip: knobs as a
               horizontal value-bearing chip rail, one control revealed at a time,
               so the canvas keeps the screen. Manifest-driven; cross-store fields
               (Trails tailLength/trackingMode, Fire flame colors) come in via
               `tuneOverrides`. CustomizeComponent still loads as the readiness
               signal for this view but is no longer rendered. -->
          {#if activeEffect !== "none"}
            <EffectTuneStrip
              effectId={activeEffect}
              config={effectsConfigState}
              overrides={tuneOverrides}
              onSettingChange={(setting, previousValue, value, coalesce) =>
                reportSetting(
                  `tuning_${activeEffect}_${setting}`,
                  previousValue,
                  value,
                  coalesce
                )}
            />
          {/if}
        </div>
      {:else if stripView === "detail" && registration && activeEffect !== "none"}
        <div class="drill-view">
          <div class="detail-head">
            <button
              type="button"
              class="back-btn"
              onclick={() => (detailOpen = false)}
              aria-label="All effects"
            >
              <i class="fas fa-arrow-left" aria-hidden="true"></i>
            </button>
            <i
              class="fas {EFFECTS.find((e) => e.id === activeEffect)
                ?.icon} detail-icon"
              style:color={EFFECT_COLORS[activeEffect]}
              aria-hidden="true"
            ></i>
            <span class="detail-name"
              >{EFFECT_LABELS[activeEffect] ?? activeEffect}</span
            >
          </div>

          <div
            class="preset-wrap"
            role="radiogroup"
            aria-label="{EFFECT_LABELS[activeEffect] ?? activeEffect} presets"
          >
            {#each registration.presetGroup.presets as preset (preset.id)}
              {@const isActive = activePresetId === preset.id}
              <button
                type="button"
                class="preset-chip"
                class:active={isActive}
                role="radio"
                aria-checked={isActive}
                onclick={() => handlePresetSelect(preset.id)}
              >
                {#if preset.previewColor === "rainbow"}
                  <span class="swatch rainbow" aria-hidden="true"></span>
                {:else if preset.previewColor === "custom"}
                  <span class="swatch custom" aria-hidden="true"></span>
                {:else if preset.previewColor2}
                  <span class="swatch dual" aria-hidden="true">
                    <span class="half" style:background={preset.previewColor}
                    ></span>
                    <span class="half" style:background={preset.previewColor2}
                    ></span>
                  </span>
                {:else}
                  <span
                    class="swatch"
                    style:background={preset.previewColor}
                    aria-hidden="true"
                  ></span>
                {/if}
                {preset.name}
              </button>
            {/each}
          </div>

          {#if primarySpec}
            <div class="slider-row">
              <span class="slider-label">{primarySpec.label}</span>
              <input
                type="range"
                class="slider"
                min={primarySpec.min}
                max={primarySpec.max}
                step={primarySpec.step}
                value={primaryValue}
                oninput={handleSliderInput}
                aria-label="{primarySpec.label} for {EFFECT_LABELS[
                  activeEffect
                ] ?? activeEffect}"
              />
              <span class="slider-val">{primarySpec.format(primaryValue)}</span>
            </div>
            <button
              type="button"
              class="more-btn"
              onclick={handleCustomizeOpen}
            >
              <span>More tuning…</span>
              <i class="fas fa-chevron-right" aria-hidden="true"></i>
            </button>
          {/if}
        </div>
      {:else}
        <div class="drill-view">
          <!-- Off lives above the grid (not as a 17th tile) so the picker stays
               a clean 4×4. Tapping the active effect's tile drills into tuning,
               so this chip is the one explicit kill switch. -->
          <div class="picker-bar">
            <button
              type="button"
              class="off-chip"
              class:active={activeEffect === "none"}
              aria-pressed={activeEffect === "none"}
              onclick={handleOffTap}
            >
              <i class="fas fa-ban" aria-hidden="true"></i>
              <span
                >{activeEffect === "none"
                  ? "Off"
                  : `Turn off ${EFFECT_LABELS[activeEffect] ?? ""}`}</span
              >
            </button>
          </div>
          <div class="fx-picker" role="radiogroup" aria-label="Select effect">
            {#each EFFECTS as e (e.id)}
              {@const isActive = activeEffect === e.id}
              <button
                type="button"
                class="fx-tile"
                class:active={isActive}
                role="radio"
                aria-checked={isActive}
                aria-label={isActive ? `Tune ${e.label}` : e.label}
                style:--fx={e.color}
                onpointerenter={() => handleEffectPrewarm(e.id)}
                onpointerdown={() => handleEffectPrewarm(e.id)}
                onclick={() => handleTileTap(e.id)}
              >
                <i class="fas {e.icon}" aria-hidden="true"></i>
                <span>{e.label}</span>
                {#if isActive}
                  <span class="tune-badge" aria-hidden="true"
                    ><i class="fas fa-sliders"></i></span
                  >
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </Crossfade>
  </div>
{:else if layout === "grid"}
  <!-- Desktop popover layout (3D controls): everything on one surface. -->
  <div class="mep">
    {#if customizeOpen && CustomizeComponent}
      <button
        type="button"
        class="back-row"
        onclick={handleCustomizeClose}
        aria-label="Back to effect presets"
      >
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span class="back-row-title">
          <span class="back-row-label"
            >{EFFECT_LABELS[activeEffect] ?? activeEffect}</span
          >
          <span class="back-row-sub">More tuning</span>
        </span>
      </button>
      {@render customizeAnchors()}
      <CustomizeComponent onBack={handleCustomizeClose} />
    {:else}
      <div class="fx-strip grid" role="radiogroup" aria-label="Select effect">
        {#each EFFECTS as e (e.id)}
          {@const isActive = activeEffect === e.id}
          <button
            type="button"
            class="fx-tile"
            class:active={isActive}
            role="radio"
            aria-checked={isActive}
            aria-label={e.label}
            style:--fx={e.color}
            onpointerenter={() => handleEffectPrewarm(e.id)}
            onpointerdown={() => handleEffectPrewarm(e.id)}
            onclick={() => handleEffectSelect(e.id)}
          >
            <i class="fas {e.icon}" aria-hidden="true"></i>
            <span>{e.label}</span>
            {#if isActive}<span class="dot" aria-hidden="true"></span>{/if}
          </button>
        {/each}
      </div>

      {#if activeEffect !== "none" && registration}
        <div
          class="preset-strip"
          role="radiogroup"
          aria-label="{EFFECT_LABELS[activeEffect] ?? activeEffect} presets"
        >
          {#each registration.presetGroup.presets as preset (preset.id)}
            {@const isActive = activePresetId === preset.id}
            <button
              type="button"
              class="preset-chip"
              class:active={isActive}
              role="radio"
              aria-checked={isActive}
              onclick={() => handlePresetSelect(preset.id)}
            >
              {#if preset.previewColor === "rainbow"}
                <span class="swatch rainbow" aria-hidden="true"></span>
              {:else if preset.previewColor === "custom"}
                <span class="swatch custom" aria-hidden="true"></span>
              {:else if preset.previewColor2}
                <span class="swatch dual" aria-hidden="true">
                  <span class="half" style:background={preset.previewColor}
                  ></span>
                  <span class="half" style:background={preset.previewColor2}
                  ></span>
                </span>
              {:else}
                <span
                  class="swatch"
                  style:background={preset.previewColor}
                  aria-hidden="true"
                ></span>
              {/if}
              {preset.name}
            </button>
          {/each}
        </div>

        {#if primarySpec}
          <div class="slider-row">
            <span class="slider-label">{primarySpec.label}</span>
            <input
              type="range"
              class="slider"
              min={primarySpec.min}
              max={primarySpec.max}
              step={primarySpec.step}
              value={primaryValue}
              oninput={handleSliderInput}
              aria-label="{primarySpec.label} for {EFFECT_LABELS[
                activeEffect
              ] ?? activeEffect}"
            />
            <span class="slider-val">{primarySpec.format(primaryValue)}</span>
          </div>
          <button type="button" class="more-btn" onclick={handleCustomizeOpen}>
            <span>More tuning…</span>
            <i class="fas fa-chevron-right" aria-hidden="true"></i>
          </button>
        {/if}
      {/if}
    {/if}
  </div>
{/if}

<ConfirmDialog
  bind:isOpen={confirmResetAllOpen}
  title="Reset all effects?"
  message="Every effect returns to its factory original. Your personal defaults and tuning are discarded. This can be undone."
  confirmText="Reset all"
  cancelText="Keep mine"
  variant="danger"
  onConfirm={handleResetAll}
  onCancel={() => {}}
/>

<style>
  /* Module accent: the animation-panel blue family (matches rail-tile.css).
     No global token covers this hue, so it's scoped here. */
  .effects-panel,
  .mep {
    --fx-accent: #4a9eff;
    --fx-accent-text: #c5ddff;
  }

  /* ── Sidebar layout ─────────────────────────────────────────────────────── */
  .effects-panel {
    display: flex;
    flex-direction: column;
  }

  .sb-section {
    padding: 12px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .sb-label {
    display: block;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
    margin-bottom: 8px;
  }

  /* ── Global factory reset (panel footer) ── */
  .sb-footer {
    display: flex;
    justify-content: center;
  }

  .reset-all-btn {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }

  .reset-all-btn:hover {
    color: var(--semantic-warning, #f59e0b);
    border-color: color-mix(
      in srgb,
      var(--semantic-warning, #f59e0b) 45%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--semantic-warning, #f59e0b) 8%,
      transparent
    );
  }

  .reset-all-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  /* ── Customize anchors (Default | Custom snap-row) ── */
  .anchor-row {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .anchor-btn {
    flex: 1;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 12px;
    border-radius: 8px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }

  .anchor-btn:hover:not(:disabled) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .anchor-btn.active {
    border-color: color-mix(in srgb, var(--fx-accent) 55%, transparent);
    background: color-mix(in srgb, var(--fx-accent) 15%, transparent);
    color: var(--fx-accent-text);
  }

  .anchor-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .anchor-btn:focus-visible {
    outline: 2px solid var(--fx-accent);
    outline-offset: 2px;
  }

  /* ── Strip / Grid layout (mobile + popover) ─────────────────────────────── */
  .mep {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .fx-strip,
  .preset-strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 2px;
  }
  .fx-strip::-webkit-scrollbar,
  .preset-strip::-webkit-scrollbar {
    display: none;
  }

  /* ── Mobile drill-down (strip layout) ── */
  .drill-view {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  /* Off chip row above the grid. Only child in its row, so its label growing
     ("Off" → "Turn off Sparkle") reflows nothing. */
  .picker-bar {
    display: flex;
  }
  .off-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }
  .off-chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.07));
    color: var(--theme-text, #fff);
  }
  .off-chip.active {
    background: color-mix(
      in srgb,
      var(--fx-accent) 18%,
      var(--theme-panel-bg, rgba(20, 22, 32, 0.6))
    );
    border-color: color-mix(in srgb, var(--fx-accent) 45%, transparent);
    color: var(--fx-accent-text);
  }

  /* Picker: every effect visible at once — no horizontal scroll, no hidden
     tail. 4 columns; tiles stretch to the cell so the grid owns sizing. */
  .fx-picker {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }
  /* 46px: just above the 44px touch floor. At 16 tiles / 4 cols that's 4 rows,
     so every px shaved here is 4px off the tray — the effect picker was eating
     ~46% of an iPhone SE; this pulls the media hero back. Icon+label still fit
     (icon 16 + gap + 10px label). */
  .fx-picker .fx-tile {
    width: 100%;
    height: 46px;
    gap: 2px;
  }
  .fx-picker .fx-tile i {
    font-size: 15px;
  }
  .fx-picker .fx-tile > span {
    font-size: 10px;
  }

  /* Tap-again affordance on the active tile: a sliders badge signals the
     second tap opens that effect's tuning screen. */
  .tune-badge {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(
      in srgb,
      var(--fx) 30%,
      var(--theme-panel-bg, rgba(20, 22, 32, 0.9))
    );
    box-shadow: 0 0 6px color-mix(in srgb, var(--fx) 60%, transparent);
  }
  .fx-tile .tune-badge i {
    font-size: 9px;
    color: var(--fx);
  }

  .detail-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .back-btn {
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    flex-shrink: 0;
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }
  .back-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.07));
  }
  .detail-icon {
    font-size: 18px;
  }
  .detail-name {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--theme-text, white);
  }

  /* Detail presets wrap — the screen has the whole tray, so every look is
     visible instead of h-scrolled. */
  .preset-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* Desktop grid variant - wraps tiles into rows that auto-fit the host width.
     16 tiles + 8px gaps fit a 420px popover at multiple rows. */
  .fx-strip.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(64px, 1fr));
    gap: 8px;
    overflow: visible;
  }
  .fx-strip.grid .fx-tile {
    width: 100%;
  }

  .fx-tile {
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 0 2px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    cursor: pointer;
    position: relative;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }
  /* Guard: 7-char labels (Sparkle, Bubbles) at the 12px floor are borderline
     in a 64px tile - clip instead of pushing the tile wider. */
  .fx-tile > span {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .fx-tile i {
    font-size: 18px;
    line-height: 1;
  }
  .fx-tile.active {
    background: color-mix(
      in srgb,
      var(--fx) 22%,
      var(--theme-panel-bg, rgba(20, 22, 32, 0.6))
    );
    border-color: color-mix(in srgb, var(--fx) 55%, transparent);
    color: var(--fx);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--fx) 30%, transparent);
  }
  .fx-tile .dot {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--fx);
    box-shadow: 0 0 6px var(--fx);
  }

  .preset-chip {
    flex-shrink: 0;
    height: 32px;
    padding: 0 10px;
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }
  .preset-chip.active {
    background: color-mix(
      in srgb,
      var(--fx-accent) 18%,
      var(--theme-panel-bg, rgba(20, 22, 32, 0.6))
    );
    border-color: color-mix(in srgb, var(--fx-accent) 45%, transparent);
    color: var(--fx-accent-text);
  }
  .preset-chip .swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  /* Deliberate effect-color swatch data, not UI chrome: these hexes preview the
     rainbow / custom preset colors themselves, so they stay literal. */
  .preset-chip .swatch.rainbow {
    background: conic-gradient(
      from 0deg,
      #ef4444,
      #f59e0b,
      #eab308,
      #22c55e,
      #06b6d4,
      #3b82f6,
      #8b5cf6,
      #ef4444
    );
  }
  .preset-chip .swatch.custom {
    background: linear-gradient(135deg, #666 50%, #aaa 50%);
  }
  .preset-chip .swatch.dual {
    display: flex;
    overflow: hidden;
    border-radius: 50%;
  }
  .preset-chip .swatch.dual .half {
    flex: 1;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    border-radius: 10px;
  }
  .slider-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    /* min-width (not fixed width): "Brightness" at the 12px floor overflows the
       old 72px slot; let long labels grow instead of clipping. */
    min-width: 72px;
    flex-shrink: 0;
  }
  .slider {
    flex: 1;
    height: 22px;
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    cursor: pointer;
  }
  .slider::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 3px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -5px;
    border-radius: 50%;
    background: var(--theme-text, white);
    box-shadow: 0 2px 6px var(--theme-shadow, rgba(0, 0, 0, 0.4));
    cursor: pointer;
  }
  .slider::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }
  .slider::-moz-range-progress {
    height: 6px;
    border-radius: 3px;
    background: var(--fx-accent);
  }
  .slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border: none;
    border-radius: 50%;
    background: var(--theme-text, white);
    box-shadow: 0 2px 6px var(--theme-shadow, rgba(0, 0, 0, 0.4));
    cursor: pointer;
  }
  .slider-val {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    color: var(--fx-accent-text);
    min-width: 44px;
    text-align: right;
  }

  .more-btn {
    height: 40px;
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }
  .more-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.07));
  }

  .back-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, rgba(255, 255, 255, 0.75));
    font: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    align-self: flex-start;
  }
  .back-row i {
    width: 20px;
    text-align: center;
  }
  .back-row-title {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.1;
  }
  .back-row-label {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .back-row-sub {
    font-size: var(--font-size-compact, 12px);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--fx-accent) 80%, transparent);
  }

  /* The strip's slim tune-header already carries a back arrow, so hide each
     customize panel's own full-width "Back to presets" button in this layout
     (avoids a redundant double-back row eating the phone tray). */
  .drill-view :global(.customize-view > .back-btn) {
    display: none;
  }

  /* ── Slim customize header (strip): back + name + Default|Custom, one row ── */
  .tune-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .tune-back {
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }
  .tune-back:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.07));
  }
  .tune-name {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--theme-text, white);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tune-anchors {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
  .tune-anchor {
    min-height: var(--min-touch-target, 44px);
    padding: 0 12px;
    border-radius: 8px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }
  .tune-anchor.active {
    border-color: color-mix(in srgb, var(--fx-accent) 55%, transparent);
    background: color-mix(in srgb, var(--fx-accent) 15%, transparent);
    color: var(--fx-accent-text);
  }
  .tune-anchor:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .tune-anchor:focus-visible {
    outline: 2px solid var(--fx-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .fx-tile,
    .preset-chip,
    .more-btn,
    .back-row,
    .reset-all-btn,
    .anchor-btn {
      transition: none;
    }
  }
</style>
