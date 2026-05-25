<!--
  MobileEffectsPanel.svelte

  Compact horizontal-strips layout for the mobile Effects sub-sheet in
  the viewer bento. Three visible rows when an effect is active:
    1. Effect tile strip (horizontal scroll, 10 tiles, 64x64 each)
    2. Preset chip strip (driven by PRESET_GROUP for the active effect)
    3. Primary slider (dominant param via effect-primary-param adapter)
  Plus a "More tuning…" button that swaps to the full existing
  *Customize.svelte component for the active effect.

  Desktop EffectsPanel.svelte is untouched - this is the mobile variant.
  Shares state (VM + effects-config-context) and preset persistence with
  desktop, so switching between the two surfaces keeps settings aligned.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import type { EffectType } from "../../domain/types/TipEffectTypes";
  import { EFFECTS, EFFECT_LABELS } from "./effect-registry";
  import {
    PRIMARY_PARAMS,
    getPrimaryParam,
    setPrimaryParam,
  } from "./effect-primary-param";
  import { LED_PRESET_GROUP } from "./presets/led-presets";
  import { FIRE_PRESET_GROUP } from "./presets/fire-presets";
  import { TRAIL_PRESET_GROUP } from "./presets/trail-presets";
  import { CHARCOAL_PRESET_GROUP } from "./presets/charcoal-presets";
  import { ZAP_PRESET_GROUP } from "./presets/zap-presets";
  import { SPARKLES_PRESET_GROUP } from "./presets/sparkles-presets";
  import { ECHO_PRESET_GROUP } from "./presets/echo-presets";
  import { BLOOM_PRESET_GROUP } from "./presets/bloom-presets";
  import { WATER_PRESET_GROUP } from "./presets/water-presets";
  import { BUBBLES_PRESET_GROUP } from "./presets/bubbles-presets";
  import { PETALS_PRESET_GROUP } from "./presets/petals-presets";
  import { SMOKE_PRESET_GROUP } from "./presets/smoke-presets";
  import { INK_PRESET_GROUP } from "./presets/ink-presets";
  import { FROST_PRESET_GROUP } from "./presets/frost-presets";
  import type { EffectPresetGroup } from "./presets/types";
  import LedCustomize from "./customize/LedCustomize.svelte";
  import FireCustomize from "./customize/FireCustomize.svelte";
  import TrailCustomize from "./customize/TrailCustomize.svelte";
  import CharcoalCustomize from "./customize/CharcoalCustomize.svelte";
  import ZapCustomize from "./customize/ZapCustomize.svelte";
  import SparklesCustomize from "./customize/SparklesCustomize.svelte";
  import EchoCustomize from "./customize/EchoCustomize.svelte";
  import BloomCustomize from "./customize/BloomCustomize.svelte";
  import WaterCustomize from "./customize/WaterCustomize.svelte";
  import BubblesCustomize from "./customize/BubblesCustomize.svelte";
  import PetalsCustomize from "./customize/PetalsCustomize.svelte";
  import SmokeCustomize from "./customize/SmokeCustomize.svelte";
  import InkCustomize from "./customize/InkCustomize.svelte";
  import FrostCustomize from "./customize/FrostCustomize.svelte";

  interface Props {
    /** "scroll" = horizontal-scroll strip (mobile bento default).
     *  "grid"   = wrapping auto-fill grid (desktop popover hosts). */
    layout?: "scroll" | "grid";
  }
  let { layout = "scroll" }: Props = $props();

  const vm = getAnimationVisibilityManager();
  const effectsConfigState = getEffectsConfigContext();

  const PRESET_STORAGE_KEY = "tka_active_effect_presets";

  function loadPresetMap(): Record<string, string> {
    try {
      const raw = localStorage.getItem(PRESET_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return {};
  }

  function savePresetId(effect: string, presetId: string | null): void {
    try {
      const map = loadPresetMap();
      if (presetId) map[effect] = presetId;
      else delete map[effect];
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  let activeEffect = $state<string>(effectsConfigState?.activeEffect ?? vm.getActiveEffect());
  let activePresetId = $state<string | null>(
    (effectsConfigState?.activeEffect ?? vm.getActiveEffect()) === "led"
      ? (effectsConfigState?.activePresets.led ?? null)
      : null,
  );
  let customizeOpen = $state(false);
  // Tick bumps when VM state changes OR slider moves, so $derived recomputes.
  let syncTick = $state(0);

  function syncFromVM(): void {
    activeEffect = effectsConfigState?.activeEffect ?? vm.getActiveEffect();
    if (activeEffect === "led") activePresetId = effectsConfigState?.activePresets.led ?? null;
    syncTick++;
  }

  onMount(() => {
    syncFromVM();
    if (activeEffect !== "none") {
      const saved = loadPresetMap()[activeEffect];
      if (saved) {
        activePresetId = saved;
        handlePresetSelect(saved);
      }
    }
    vm.registerObserver(syncFromVM);
  });

  onDestroy(() => {
    vm.unregisterObserver(syncFromVM);
  });

  function getPresetGroup(effect: string): EffectPresetGroup | null {
    switch (effect) {
      case "led":
        return LED_PRESET_GROUP;
      case "fire":
        return FIRE_PRESET_GROUP;
      case "trails":
        return TRAIL_PRESET_GROUP;
      case "charcoal":
        return CHARCOAL_PRESET_GROUP;
      case "zap":
        return ZAP_PRESET_GROUP;
      case "sparkles":
        return SPARKLES_PRESET_GROUP;
      case "echo":
        return ECHO_PRESET_GROUP;
      case "bloom":
        return BLOOM_PRESET_GROUP;
      case "water":
        return WATER_PRESET_GROUP;
      case "bubbles":
        return BUBBLES_PRESET_GROUP;
      case "petals":
        return PETALS_PRESET_GROUP;
      case "smoke":
        return SMOKE_PRESET_GROUP;
      case "ink":
        return INK_PRESET_GROUP;
      case "frost":
        return FROST_PRESET_GROUP;
      default:
        return null;
    }
  }

  function handleEffectSelect(effectId: string): void {
    customizeOpen = false;
    if (effectId === activeEffect) {
      if (effectsConfigState) effectsConfigState.setActiveEffect("none");
      else vm.setActiveEffect("none" as EffectType);
      activeEffect = "none";
      activePresetId = null;
      return;
    }
    if (effectsConfigState) effectsConfigState.setActiveEffect(effectId);
    else vm.setActiveEffect(effectId as EffectType);
    activeEffect = effectId;
    activePresetId = null;
  }

  function handlePresetSelect(presetId: string): void {
    const group = getPresetGroup(activeEffect);
    if (!group) return;
    const preset = group.presets.find((p) => p.id === presetId);
    if (!preset) return;
    if (effectsConfigState) preset.apply(effectsConfigState);
    activePresetId = presetId;
    savePresetId(activeEffect, presetId);
    syncTick++;
  }

  const primarySpec = $derived(
    activeEffect !== "none" ? (PRIMARY_PARAMS[activeEffect] ?? null) : null,
  );

  const primaryValue = $derived.by(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    syncTick;
    if (!primarySpec || !effectsConfigState) return 0;
    return getPrimaryParam(activeEffect, effectsConfigState);
  });

  function handleSliderInput(ev: Event) {
    if (!primarySpec || !effectsConfigState) return;
    const v = parseFloat((ev.currentTarget as HTMLInputElement).value);
    setPrimaryParam(activeEffect, effectsConfigState, v);
    syncTick++;
  }
</script>

<div class="mep">
  {#if customizeOpen && activeEffect !== "none"}
    <button
      type="button"
      class="back-row"
      onclick={() => (customizeOpen = false)}
      aria-label="Back to effect presets"
    >
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
      <span class="back-row-title">
        <span class="back-row-label">{EFFECT_LABELS[activeEffect] ?? activeEffect}</span>
        <span class="back-row-sub">More tuning</span>
      </span>
    </button>

    {#if activeEffect === "led"}
      <LedCustomize onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "fire"}
      <FireCustomize onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "trails"}
      <TrailCustomize onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "charcoal"}
      <CharcoalCustomize onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "zap"}
      <ZapCustomize onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "sparkles"}
      <SparklesCustomize onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "echo"}
      <EchoCustomize onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "bloom"}
      <BloomCustomize onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "water"}
      <WaterCustomize onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "bubbles"}
      <BubblesCustomize onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "petals"}
      <PetalsCustomize onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "smoke"}
      <SmokeCustomize onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "ink"}
      <InkCustomize onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "frost"}
      <FrostCustomize onBack={() => (customizeOpen = false)} />
    {/if}
  {:else}
    <div class="fx-strip" class:grid={layout === "grid"} role="radiogroup" aria-label="Select effect">
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
          onclick={() => handleEffectSelect(e.id)}
        >
          <i class="fas {e.icon}" aria-hidden="true"></i>
          <span>{e.label}</span>
          {#if isActive}<span class="dot" aria-hidden="true"></span>{/if}
        </button>
      {/each}
    </div>

    {#if activeEffect !== "none"}
      {@const group = getPresetGroup(activeEffect)}

      {#if group}
        <div
          class="preset-strip"
          role="radiogroup"
          aria-label="{EFFECT_LABELS[activeEffect] ?? activeEffect} presets"
        >
          {#each group.presets as preset (preset.id)}
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
      {/if}

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
            aria-label="{primarySpec.label} for {EFFECT_LABELS[activeEffect] ??
              activeEffect}"
          />
          <span class="slider-val">{primarySpec.format(primaryValue)}</span>
        </div>

        <button
          type="button"
          class="more-btn"
          onclick={() => (customizeOpen = true)}
        >
          <span>More tuning…</span>
          <i class="fas fa-chevron-right" aria-hidden="true"></i>
        </button>
      {/if}
    {/if}
  {/if}
</div>

<style>
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

  /* Desktop grid variant - wraps tiles into rows that auto-fit the host width.
     11 tiles + 8px gaps fit a 420px popover at 5 cols × 3 rows. */
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
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.65);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    position: relative;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }
  .fx-tile i {
    font-size: 18px;
    line-height: 1;
  }
  .fx-tile.active {
    background: color-mix(in srgb, var(--fx) 22%, rgba(20, 22, 32, 0.6));
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
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.65);
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }
  .preset-chip.active {
    background: color-mix(in srgb, #4a9eff 18%, rgba(20, 22, 32, 0.6));
    border-color: color-mix(in srgb, #4a9eff 45%, transparent);
    color: #c5ddff;
  }
  .preset-chip .swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
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

  .slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
  }
  .slider-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.55);
    width: 72px;
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
    background: rgba(255, 255, 255, 0.08);
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -5px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    cursor: pointer;
  }
  .slider::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.08);
  }
  .slider::-moz-range-progress {
    height: 6px;
    border-radius: 3px;
    background: #4a9eff;
  }
  .slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border: none;
    border-radius: 50%;
    background: white;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    cursor: pointer;
  }
  .slider-val {
    font-size: 11px;
    font-weight: 700;
    color: #c5ddff;
    min-width: 44px;
    text-align: right;
  }

  .more-btn {
    height: 40px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
    font-size: 11px;
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
    background: rgba(255, 255, 255, 0.07);
  }

  .back-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.75);
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
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(74, 158, 255, 0.8);
  }

  @media (prefers-reduced-motion: reduce) {
    .fx-tile,
    .preset-chip,
    .more-btn,
    .back-row {
      transition: none;
    }
  }
</style>
