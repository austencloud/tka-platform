<script lang="ts">
  import type { Snippet, Component } from "svelte";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import EffectSelector from "./EffectSelector.svelte";
  import EffectPresetsSection from "./EffectPresetsSection.svelte";
  import { EFFECT_COLORS, EFFECT_LABELS, EFFECTS, getRegistration } from "./effect-registry";
  import type { EffectRegistration } from "./effect-registry";
  import TempoControl from "$lib/shared/sequence-viewer/components/TempoControl.svelte";
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
  }

  const {
    bpm, onBpmChange, isPlaying, onPlaybackToggle,
    onStepForward, onStepBackward, onHalfStepForward, onHalfStepBackward,
    showPlayback = true, showTransport = true, showExportControls = false,
    layout = "sidebar",
    children,
  }: Props = $props();

  const effectsConfigState = getEffectsConfigContext()!;

  // Preset persistence
  const PRESET_STORAGE_KEY = "tka_active_effect_presets";
  function loadPresetMap(): Record<string, string> {
    try { const raw = localStorage.getItem(PRESET_STORAGE_KEY); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
    return {};
  }
  function savePresetId(effect: string, presetId: string | null): void {
    try { const map = loadPresetMap(); if (presetId) map[effect] = presetId; else delete map[effect]; localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
  }

  let customizeOpen = $state(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let CustomizeComponent = $state<Component<any> | null>(null);

  const activeEffect = $derived(effectsConfigState.activeEffect);
  const registration = $derived<EffectRegistration | undefined>(
    activeEffect !== "none" ? getRegistration(activeEffect) : undefined
  );

  const activePresetId = $derived.by(() => {
    if (activeEffect === "none") return null;
    const ap = effectsConfigState.activePresets as Record<string, string | null>;
    return ap[activeEffect] ?? loadPresetMap()[activeEffect] ?? null;
  });

  const currentSummary = $derived.by(() => {
    if (!registration) return "";
    return registration.presetGroup.getSummary(effectsConfigState);
  });

  const primarySpec = $derived<PrimaryParamSpec | undefined>(registration?.primaryParam);
  const primaryValue = $derived.by(() => {
    if (!primarySpec) return 0;
    return primarySpec.get(effectsConfigState);
  });

  function handleEffectSelect(effectId: string): void {
    customizeOpen = false;
    CustomizeComponent = null;
    if (effectId === activeEffect) {
      effectsConfigState.setActiveEffect("none");
      return;
    }
    effectsConfigState.setActiveEffect(effectId);
  }

  function handlePresetSelect(presetId: string): void {
    if (!registration) return;
    const preset = registration.presetGroup.presets.find(p => p.id === presetId);
    if (!preset) return;
    preset.apply(effectsConfigState);
    savePresetId(activeEffect, presetId);
  }

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
    const v = parseFloat((ev.currentTarget as HTMLInputElement).value);
    primarySpec.set(effectsConfigState, v);
  }
</script>

{#if layout === "sidebar"}
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

    {#if activeEffect !== "none" && !customizeOpen && registration}
      <div class="sb-section">
        <EffectPresetsSection
          presetGroup={registration.presetGroup}
          {activePresetId}
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
        <CustomizeComponent onBack={handleCustomizeClose} />
      </div>
    {/if}

    {#if children}{@render children()}{/if}
  </div>
{:else if layout === "strip" || layout === "grid"}
  <!-- Mobile / popover layout -->
  <div class="mep">
    {#if customizeOpen && CustomizeComponent}
      <button type="button" class="back-row" onclick={handleCustomizeClose} aria-label="Back to effect presets">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span class="back-row-title">
          <span class="back-row-label">{EFFECT_LABELS[activeEffect] ?? activeEffect}</span>
          <span class="back-row-sub">More tuning</span>
        </span>
      </button>
      <CustomizeComponent onBack={handleCustomizeClose} />
    {:else}
      <div class="fx-strip" class:grid={layout === "grid"} role="radiogroup" aria-label="Select effect">
        {#each EFFECTS as e (e.id)}
          {@const isActive = activeEffect === e.id}
          <button type="button" class="fx-tile" class:active={isActive} role="radio" aria-checked={isActive} aria-label={e.label} style:--fx={e.color} onclick={() => handleEffectSelect(e.id)}>
            <i class="fas {e.icon}" aria-hidden="true"></i>
            <span>{e.label}</span>
            {#if isActive}<span class="dot" aria-hidden="true"></span>{/if}
          </button>
        {/each}
      </div>

      {#if activeEffect !== "none" && registration}
        <div class="preset-strip" role="radiogroup" aria-label="{EFFECT_LABELS[activeEffect] ?? activeEffect} presets">
          {#each registration.presetGroup.presets as preset (preset.id)}
            {@const isActive = activePresetId === preset.id}
            <button type="button" class="preset-chip" class:active={isActive} role="radio" aria-checked={isActive} onclick={() => handlePresetSelect(preset.id)}>
              {#if preset.previewColor === "rainbow"}
                <span class="swatch rainbow" aria-hidden="true"></span>
              {:else if preset.previewColor === "custom"}
                <span class="swatch custom" aria-hidden="true"></span>
              {:else if preset.previewColor2}
                <span class="swatch dual" aria-hidden="true">
                  <span class="half" style:background={preset.previewColor}></span>
                  <span class="half" style:background={preset.previewColor2}></span>
                </span>
              {:else}
                <span class="swatch" style:background={preset.previewColor} aria-hidden="true"></span>
              {/if}
              {preset.name}
            </button>
          {/each}
        </div>

        {#if primarySpec}
          <div class="slider-row">
            <span class="slider-label">{primarySpec.label}</span>
            <input type="range" class="slider" min={primarySpec.min} max={primarySpec.max} step={primarySpec.step} value={primaryValue} oninput={handleSliderInput} aria-label="{primarySpec.label} for {EFFECT_LABELS[activeEffect] ?? activeEffect}" />
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

<style>
  /* ── Sidebar layout ─────────────────────────────────────────────────────── */
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
