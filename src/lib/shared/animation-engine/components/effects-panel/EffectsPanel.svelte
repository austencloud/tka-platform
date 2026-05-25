<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { Snippet } from "svelte";
  import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import type { EffectType } from "../../domain/types/TipEffectTypes";
  import EffectSelector from "./EffectSelector.svelte";
  import EffectPresetsSection from "./EffectPresetsSection.svelte";
  import LedCustomize from "./customize/LedCustomize.svelte";
  import FireCustomize from "./customize/FireCustomize.svelte";
  import TrailCustomize from "./customize/TrailCustomize.svelte";
  import CharcoalCustomize from "./customize/CharcoalCustomize.svelte";
  import ZapCustomize from "./customize/ZapCustomize.svelte";
  import ComingSoonCustomize from "./customize/ComingSoonCustomize.svelte";
  import TempoControl from "$lib/shared/sequence-viewer/components/TempoControl.svelte";
  import TransportControls from "$lib/shared/animation-engine/components/controls/TransportControls.svelte";
  import { LED_PRESET_GROUP } from "./presets/led-presets";
  import { FIRE_PRESET_GROUP } from "./presets/fire-presets";
  import { TRAIL_PRESET_GROUP } from "./presets/trail-presets";
  import { CHARCOAL_PRESET_GROUP } from "./presets/charcoal-presets";
  import { ZAP_PRESET_GROUP } from "./presets/zap-presets";
  import { SPARKLES_PRESET_GROUP } from "./presets/sparkles-presets";
  import SparklesCustomize from "./customize/SparklesCustomize.svelte";
  import { ECHO_PRESET_GROUP } from "./presets/echo-presets";
  import EchoCustomize from "./customize/EchoCustomize.svelte";
  import { BLOOM_PRESET_GROUP } from "./presets/bloom-presets";
  import BloomCustomize from "./customize/BloomCustomize.svelte";
  import { WATER_PRESET_GROUP } from "./presets/water-presets";
  import WaterCustomize from "./customize/WaterCustomize.svelte";
  import { BUBBLES_PRESET_GROUP } from "./presets/bubbles-presets";
  import BubblesCustomize from "./customize/BubblesCustomize.svelte";
  import { PETALS_PRESET_GROUP } from "./presets/petals-presets";
  import PetalsCustomize from "./customize/PetalsCustomize.svelte";
  import { SMOKE_PRESET_GROUP } from "./presets/smoke-presets";
  import SmokeCustomize from "./customize/SmokeCustomize.svelte";
  import { INK_PRESET_GROUP } from "./presets/ink-presets";
  import InkCustomize from "./customize/InkCustomize.svelte";
  import { FROST_PRESET_GROUP } from "./presets/frost-presets";
  import FrostCustomize from "./customize/FrostCustomize.svelte";
  import { SILK_PRESET_GROUP } from "./presets/silk-presets";
  import SilkCustomize from "./customize/SilkCustomize.svelte";
  import { PULSE_PRESET_GROUP } from "./presets/pulse-presets";
  import PulseCustomize from "./customize/PulseCustomize.svelte";
  import type { EffectPresetGroup } from "./presets/types";
  import { EFFECT_COLORS, EFFECT_LABELS } from "./effect-registry";

  interface Props {
    // Playback state (from parent - the parent owns the playback engine)
    bpm: number;
    onBpmChange: (bpm: number) => void;
    isPlaying: boolean;
    onPlaybackToggle: () => void;
    onStepForward?: () => void;
    onStepBackward?: () => void;
    onHalfStepForward?: () => void;
    onHalfStepBackward?: () => void;

    // Layout control
    showPlayback?: boolean;       // default true
    showTransport?: boolean;      // default true - when false, hide play/step buttons (e.g. lab uses canvas overlay)
    showExportControls?: boolean; // default false

    // Svelte 5 snippet for slot content (export controls, source picker, etc.)
    children?: Snippet;
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
    children,
  }: Props = $props();

  const vm = getAnimationVisibilityManager();
  // Capture once at init - Svelte 5 forbids getContext() inside event handlers
  // or reactive computations. Presets receive this state explicitly.
  const effectsConfigState = getEffectsConfigContext();

  // ── Preset persistence ─────────────────────────────────────────────
  const PRESET_STORAGE_KEY = "tka_active_effect_presets";

  function loadPresetMap(): Record<string, string> {
    try {
      const raw = localStorage.getItem(PRESET_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  }

  function savePresetId(effect: string, presetId: string | null): void {
    try {
      const map = loadPresetMap();
      if (presetId) {
        map[effect] = presetId;
      } else {
        delete map[effect];
      }
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
  }

  // Internal state
  // Initialize synchronously from EffectsConfigState so the preset section renders on
  // first paint instead of appearing after onMount (which caused CLS - the
  // panel would grow once the active effect came back as non-"none").
  let activeEffect = $state<string>(effectsConfigState?.activeEffect ?? vm.getActiveEffect());
  let customizeOpen = $state(false);
  let activePresetId = $state<string | null>(
    (effectsConfigState?.activeEffect ?? vm.getActiveEffect()) === "led"
      ? (effectsConfigState?.activePresets.led ?? null)
      : null
  );
  // Tick counter to force summary recompute when VM state changes
  let summaryTick = $state(0);


  function syncFromVM(): void {
    activeEffect = effectsConfigState?.activeEffect ?? vm.getActiveEffect();
    if (activeEffect === "led") {
      activePresetId = effectsConfigState?.activePresets.led ?? null;
    }
    summaryTick++;
  }

  onMount(() => {
    syncFromVM();
    // Config values are persisted by EffectsConfigState - just restore UI highlight.
    // LED is handled by syncFromVM (VM is authoritative for LED presets).
    if (activeEffect !== "none" && activeEffect !== "led" && effectsConfigState) {
      const ap = effectsConfigState.activePresets as Record<string, string | null>;
      activePresetId = ap[activeEffect] ?? loadPresetMap()[activeEffect] ?? null;
    }
    vm.registerObserver(syncFromVM);
  });

  onDestroy(() => {
    vm.unregisterObserver(syncFromVM);
  });

  function handleEffectSelect(effectId: string): void {
    customizeOpen = false;
    // Click the active chip to disable - round-trip to "none"
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

  function getPresetGroup(effect: string): EffectPresetGroup | null {
    switch (effect) {
      case "led": return LED_PRESET_GROUP;
      case "fire": return FIRE_PRESET_GROUP;
      case "trails": return TRAIL_PRESET_GROUP;
      case "charcoal": return CHARCOAL_PRESET_GROUP;
      case "zap": return ZAP_PRESET_GROUP;
      case "sparkles": return SPARKLES_PRESET_GROUP;
      case "echo": return ECHO_PRESET_GROUP;
      case "bloom": return BLOOM_PRESET_GROUP;
      case "water": return WATER_PRESET_GROUP;
      case "bubbles": return BUBBLES_PRESET_GROUP;
      case "petals": return PETALS_PRESET_GROUP;
      case "smoke": return SMOKE_PRESET_GROUP;
      case "ink": return INK_PRESET_GROUP;
      case "frost": return FROST_PRESET_GROUP;
      case "silk": return SILK_PRESET_GROUP;
      case "pulse": return PULSE_PRESET_GROUP;
      default: return null;
    }
  }

  function handlePresetSelect(presetId: string): void {
    const group = getPresetGroup(activeEffect);
    if (!group) return;
    const preset = group.presets.find((p) => p.id === presetId);
    if (!preset) return;
    if (effectsConfigState) preset.apply(effectsConfigState);
    activePresetId = presetId;
    savePresetId(activeEffect, presetId);
  }

  const currentSummary = $derived.by(() => {
    // summaryTick makes this reactive to VM observer changes
    summaryTick;
    const group = getPresetGroup(activeEffect);
    if (!group || !effectsConfigState) return "";
    return group.getSummary(effectsConfigState);
  });


</script>

<div class="effects-panel">
  {#if showPlayback}
    <div class="sb-section">
      <TempoControl {bpm} {onBpmChange} showPresets={false} showPractice={false} presetsMode="popover" />
      {#if showTransport}
        <TransportControls
          {isPlaying}
          onPlaybackToggle={onPlaybackToggle}
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
    <EffectSelector {activeEffect} onSelect={handleEffectSelect} />
  </div>

  {#if activeEffect !== "none" && !customizeOpen}
    {@const group = getPresetGroup(activeEffect)}
    {#if group}
      <div class="sb-section">
        <EffectPresetsSection
          presetGroup={group}
          {activePresetId}
          onSelectPreset={handlePresetSelect}
          onCustomize={() => (customizeOpen = true)}
          effectLabel={EFFECT_LABELS[activeEffect] ?? ""}
          accentColor={EFFECT_COLORS[activeEffect] ?? "#8b5cf6"}
          summary={currentSummary}
        />
      </div>
    {/if}

  {/if}

  {#if customizeOpen}
    <div class="sb-section">
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
      {:else if activeEffect === "silk"}
        <SilkCustomize onBack={() => (customizeOpen = false)} />
      {:else if activeEffect === "pulse"}
        <PulseCustomize onBack={() => (customizeOpen = false)} />
      {/if}
    </div>
  {/if}

  {#if children}
    {@render children()}
  {/if}
</div>

<style>
  .effects-panel {
    display: flex;
    flex-direction: column;
  }

  .sb-section {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .sb-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
    margin-bottom: 8px;
  }

</style>
