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
  import TransportControls from "$lib/features/compose/components/controls/TransportControls.svelte";
  import { LED_PRESET_GROUP } from "./presets/led-presets";
  import { FIRE_PRESET_GROUP } from "./presets/fire-presets";
  import { TRAIL_PRESET_GROUP } from "./presets/trail-presets";
  import { CHARCOAL_PRESET_GROUP } from "./presets/charcoal-presets";
  import { ZAP_PRESET_GROUP } from "./presets/zap-presets";
  import { SPARKLES_PRESET_GROUP } from "./presets/sparkles-presets";
  import SparklesCustomize from "./customize/SparklesCustomize.svelte";
  import { MOTION_PRESET_GROUP } from "./presets/motion-presets";
  import MotionCustomize from "./customize/MotionCustomize.svelte";
  import type { EffectPresetGroup } from "./presets/types";

  interface Props {
    // Playback state (from parent — the parent owns the playback engine)
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
    showTransport?: boolean;      // default true — when false, hide play/step buttons (e.g. lab uses canvas overlay)
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
  // Capture once at init — Svelte 5 forbids getContext() inside event handlers
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
  // Initialize synchronously from the VM so the preset section renders on
  // first paint instead of appearing after onMount (which caused CLS — the
  // panel would grow once the VM's active effect came back as non-"none").
  let activeEffect = $state<string>(vm.getActiveEffect());
  let customizeOpen = $state(false);
  let activePresetId = $state<string | null>(
    vm.getActiveEffect() === "led" ? vm.getActivePresetId() : null
  );
  // Tick counter to force summary recompute when VM state changes
  let summaryTick = $state(0);

  const EFFECT_COLORS: Record<string, string> = {
    fire: "#f97316",
    led: "#22c55e",
    trails: "#60a5fa",
    charcoal: "#a855f7",
    zap: "#38bdf8",
    sparkles: "#fbbf24",
    motion: "#22d3ee",
    bloom: "#f472b6",
  };

  const EFFECT_LABELS: Record<string, string> = {
    fire: "Fire",
    led: "LED",
    trails: "Trails",
    charcoal: "Charcoal",
    zap: "Zap",
    sparkles: "Sparkle",
    motion: "Motion",
    bloom: "Bloom",
  };

  function syncFromVM(): void {
    activeEffect = vm.getActiveEffect();
    if (activeEffect === "led") {
      activePresetId = vm.getActivePresetId();
    }
    summaryTick++;
  }

  onMount(() => {
    syncFromVM();
    // Restore persisted preset for the active effect
    if (activeEffect !== "none") {
      const saved = loadPresetMap()[activeEffect];
      if (saved) {
        activePresetId = saved;
        // Re-apply the preset so colors/settings match the selection
        handlePresetSelect(saved);
      }
    }
    vm.registerObserver(syncFromVM);
  });

  onDestroy(() => {
    vm.unregisterObserver(syncFromVM);
  });

  function handleEffectSelect(effectId: string): void {
    customizeOpen = false;
    // Click the active chip to disable — round-trip to "none"
    if (effectId === activeEffect) {
      vm.setActiveEffect("none" as EffectType);
      activeEffect = "none";
      activePresetId = null;
      return;
    }
    vm.setActiveEffect(effectId as EffectType);
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
      case "motion": return MOTION_PRESET_GROUP;
      default: return null;
    }
  }

  function handlePresetSelect(presetId: string): void {
    const group = getPresetGroup(activeEffect);
    if (!group) return;
    const preset = group.presets.find((p) => p.id === presetId);
    if (!preset) return;
    preset.apply(vm, effectsConfigState);
    activePresetId = presetId;
    savePresetId(activeEffect, presetId);
  }

  const currentSummary = $derived.by(() => {
    // summaryTick makes this reactive to VM observer changes
    summaryTick;
    const group = getPresetGroup(activeEffect);
    if (!group) return "";
    return group.getSummary(vm, effectsConfigState);
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
      {:else if activeEffect === "motion"}
        <MotionCustomize onBack={() => (customizeOpen = false)} />
      {:else if activeEffect === "bloom"}
        <ComingSoonCustomize effectLabel="Bloom" onBack={() => (customizeOpen = false)} />
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
