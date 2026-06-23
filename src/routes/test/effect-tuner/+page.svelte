<!--
  Effect Tuner — pick sensible shipped defaults for all 16 effects (throwaway).

  Renders any of the 16 real effects live on a real AnimatorCanvas, judged in
  two scenes off the SAME base motion:
    • Clean  — single blue+red pair (rotated = []). The honest single-effect read.
    • Tunnel — rotated/mirrored kaleidoscope copies. The additive-overlap gate.
  Flipping scene reuses base (no regeneration), so a locked default is judged
  against identical motion in both. Tune with the real per-effect panel, then
  "Copy default JSON" → paste into DEFAULT_EFFECTS_CONFIG[effect] in
  src/lib/shared/effects/domain/defaults.ts.

  Real components only, driven by an ISOLATED effects config (persist:false →
  never touches the user's global tka_effects_config). Default prop = STAFF
  (2 tip ends) because coverage/blowout only shows with 2-end props. Spec:
  docs/superpowers/specs/active/2026-06-23-effect-tuner-design.md
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { Component } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { AdditionalLayerProps } from "$lib/shared/animation-engine/domain/types/trail-capture-types";
  import { interpolatePropAngles } from "$lib/shared/animation-engine/services/prop-interpolator";
  import { rotateSequence, mirrorSequence } from "$lib/shared/create/services/sequence-transforms";
  import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/motion-query-handler";
  import { generationOrchestrator } from "$lib/shared/create/services/generation-orchestrator";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { DifficultyLevel } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { EffectType, TipEffectMap } from "$lib/shared/animation-engine/domain/types/tip-effect-types";

  // Isolated effects config + the real per-effect tuning panels.
  import {
    createEffectsConfigState,
    isEffectId,
  } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import FirePanel from "$lib/shared/animation-engine/components/settings-panels/FirePanel.svelte";
  import CharcoalPanel from "$lib/shared/animation-engine/components/settings-panels/CharcoalPanel.svelte";
  import LedPanel from "$lib/shared/animation-engine/components/settings-panels/LedPanel.svelte";
  import TrailsPanel from "$lib/shared/animation-engine/components/settings-panels/TrailsPanel.svelte";
  import ZapCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/ZapCustomize.svelte";
  import SparklesCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/SparklesCustomize.svelte";
  import EchoCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/EchoCustomize.svelte";
  import BloomCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/BloomCustomize.svelte";
  import WaterCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/WaterCustomize.svelte";
  import BubblesCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/BubblesCustomize.svelte";
  import PetalsCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/PetalsCustomize.svelte";
  import SmokeCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/SmokeCustomize.svelte";
  import InkCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/InkCustomize.svelte";
  import FrostCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/FrostCustomize.svelte";
  import SilkCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/SilkCustomize.svelte";
  import PulseCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/PulseCustomize.svelte";

  const DEFAULT_PROP_STATE: PropState = { centerPathAngle: 0, staffRotationAngle: 0 };

  type Fold = 2 | 4 | 8;
  type Scene = "clean" | "tunnel";

  // Isolated effects config — persist:false keeps it off the shared global key.
  const effectsConfig = createEffectsConfigState(undefined, { persist: false });
  setEffectsConfigContext(effectsConfig);

  // ── Knobs ───────────────────────────────────────────────────
  let scene = $state<Scene>("clean");
  let propType = $state<PropType>(PropType.STAFF); // 2 tip ends → reveals coverage/blowout
  let fold = $state<Fold>(4);
  let mirror = $state(false);
  let activeEffect = $state<EffectType>("none");
  let speed = $state(0.3); // beats per second
  let isPlaying = $state(true);
  let showGrid = $state(true);
  let status = $state("loading…");
  let errorMsg = $state<string | null>(null);
  let layerCount = $state(1);
  let copyStatus = $state("");

  const propChoices: { type: PropType; label: string }[] = [
    { type: PropType.STAFF, label: "Staff" },
    { type: PropType.BIGSTAFF, label: "Big Staff" },
    { type: PropType.SWORD, label: "Sword" },
    { type: PropType.BUUGENG, label: "Buugeng" },
    { type: PropType.DOUBLESTAR, label: "Doublestar" },
    { type: PropType.TRIQUETRA, label: "Triquetra" },
    { type: PropType.EIGHTRINGS, label: "Eightrings" },
    { type: PropType.TORCH, label: "Torch" },
  ];

  const folds: Fold[] = [2, 4, 8];

  const effectChoices: EffectType[] = [
    "none", "fire", "charcoal", "led", "trails", "zap", "sparkles", "echo",
    "bloom", "water", "bubbles", "petals", "smoke", "ink", "frost", "silk", "pulse",
  ];

  const tipEffectMap = $derived<TipEffectMap | undefined>(
    activeEffect === "none" ? undefined : { "*": { effect: activeEffect } },
  );

  // Active effect → its real tuning panel. Settings-panels (fire/charcoal/led/
  // trails) take no onBack; the customize views take an onBack (noop here).
  type PanelEntry = { comp: Component<any>; needsBack: boolean };
  const EFFECT_PANELS: Record<string, PanelEntry> = {
    fire: { comp: FirePanel, needsBack: false },
    charcoal: { comp: CharcoalPanel, needsBack: false },
    led: { comp: LedPanel, needsBack: false },
    trails: { comp: TrailsPanel, needsBack: false },
    zap: { comp: ZapCustomize, needsBack: true },
    sparkles: { comp: SparklesCustomize, needsBack: true },
    echo: { comp: EchoCustomize, needsBack: true },
    bloom: { comp: BloomCustomize, needsBack: true },
    water: { comp: WaterCustomize, needsBack: true },
    bubbles: { comp: BubblesCustomize, needsBack: true },
    petals: { comp: PetalsCustomize, needsBack: true },
    smoke: { comp: SmokeCustomize, needsBack: true },
    ink: { comp: InkCustomize, needsBack: true },
    frost: { comp: FrostCustomize, needsBack: true },
    silk: { comp: SilkCustomize, needsBack: true },
    pulse: { comp: PulseCustomize, needsBack: true },
  };
  const activePanel = $derived(activeEffect === "none" ? null : EFFECT_PANELS[activeEffect] ?? null);
  const noBack = () => {};

  // ── Sequences ───────────────────────────────────────────────
  let base = $state<SequenceData | null>(null);
  let rotated = $state<SequenceData[]>([]); // additional layers beyond base
  let playheadBeat = $state(0);

  function rotAmountsFor(f: Fold): number[] {
    if (f === 8) return [1, 2, 3, 4, 5, 6, 7]; // 45° steps
    if (f === 4) return [2, 4, 6]; // 90 / 180 / 270
    return [4]; // 180 only
  }

  // Generate a fresh base sequence, then build the scene's layers from it.
  async function generateBase() {
    status = "generating sequence…";
    errorMsg = null;
    base = null;
    rotated = [];
    try {
      const seq = await generationOrchestrator.generateSequence({
        length: 8,
        gridMode: GridMode.DIAMOND,
        propType: PropType.STAFF, // generation prop irrelevant; render prop is separate
        difficulty: DifficultyLevel.INTERMEDIATE,
        constraintPreset: "smooth",
      });
      base = seq;
      playheadBeat = 0;
      await rebuildLayers();
    } catch (e) {
      errorMsg = String(e instanceof Error ? (e.stack ?? e.message) : e);
      status = "error";
    }
  }

  // Build the additional layers for the current scene from the EXISTING base —
  // no regeneration, so Clean⇄Tunnel judges identical motion.
  async function rebuildLayers() {
    const seq = base;
    if (!seq) return;
    if (scene === "clean") {
      rotated = [];
      layerCount = 1;
      status = `clean · single pair · ${seq.steps.length} steps`;
      return;
    }
    status = "building tunnel layers…";
    const amounts = rotAmountsFor(fold);
    const rotExtras = await Promise.all(
      amounts.map((amt) => rotateSequence(seq, amt, motionQueryHandler)),
    );
    const layers: SequenceData[] = [...rotExtras];
    if (mirror) {
      const mirroredBase = await mirrorSequence(seq, motionQueryHandler);
      const mirroredExtras = await Promise.all(
        rotExtras.map((r) => mirrorSequence(r, motionQueryHandler)),
      );
      layers.push(mirroredBase, ...mirroredExtras);
    }
    rotated = layers;
    layerCount = layers.length + 1;
    status = `tunnel · ${layerCount} layers · ${fold}-fold${mirror ? " + mirror" : ""} · ${seq.steps.length} steps`;
  }

  // Rebuild when the scene topology changes (scene / fold / mirror). First run
  // (no base yet) generates one; later runs reuse base. Prop / effect / speed
  // are instant — no rebuild.
  let lastTopo = "";
  $effect(() => {
    const topo = `${scene}|${fold}|${mirror}`;
    if (topo !== lastTopo) {
      lastTopo = topo;
      if (!base) void generateBase();
      else void rebuildLayers();
    }
  });

  onMount(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (isPlaying && base && base.steps.length > 0) {
        playheadBeat = (playheadBeat + dt * speed) % base.steps.length;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  // ── Per-layer prop derivation at the shared playhead ────────
  type LayerProps = { blue: PropState; red: PropState; step: StepData | null; stepOneBased: number };

  function propsFor(seq: SequenceData | null): LayerProps {
    if (!seq || seq.steps.length === 0) {
      return { blue: { ...DEFAULT_PROP_STATE }, red: { ...DEFAULT_PROP_STATE }, step: null, stepOneBased: 1 };
    }
    const n = seq.steps.length;
    const idx = Math.min(n - 1, Math.max(0, Math.floor(playheadBeat)));
    const progress = Math.max(0, Math.min(0.9999, playheadBeat - Math.floor(playheadBeat)));
    const step = seq.steps[idx] ?? null;
    if (!step) {
      return { blue: { ...DEFAULT_PROP_STATE }, red: { ...DEFAULT_PROP_STATE }, step: null, stepOneBased: idx + 1 };
    }
    const r = interpolatePropAngles(step, progress);
    return {
      blue: r.isValid ? (r.blueAngles ?? { ...DEFAULT_PROP_STATE }) : { ...DEFAULT_PROP_STATE },
      red: r.isValid ? (r.redAngles ?? { ...DEFAULT_PROP_STATE }) : { ...DEFAULT_PROP_STATE },
      step,
      stepOneBased: idx + 1,
    };
  }

  const baseLayer = $derived(propsFor(base));
  const additionalLayers = $derived<AdditionalLayerProps[]>(
    rotated.map((seq) => {
      const p = propsFor(seq);
      return { blueProp: p.blue, redProp: p.red };
    }),
  );
  const propTypeStr = $derived(String(propType));
  const gridMode = $derived(base?.gridMode ?? GridMode.DIAMOND);

  // ── Copy the active effect's live intent for paste into defaults.ts ─────────
  function copyDefaultJson() {
    if (activeEffect === "none" || !isEffectId(activeEffect)) {
      copyStatus = "Pick an effect first";
      return;
    }
    const intent = $state.snapshot(effectsConfig.effect(activeEffect));
    const json = JSON.stringify(intent, null, 2);
    void navigator.clipboard
      .writeText(json)
      .then(() => { copyStatus = `Copied ${activeEffect} default (${json.length} chars)`; })
      .catch(() => { copyStatus = "Clipboard blocked — JSON logged to console"; console.log(json); });
  }
</script>

<div class="page">
  <header>
    <h1>Effect Tuner — pick sensible defaults</h1>
    <p class="sub">
      Judge each effect in Clean, confirm in Tunnel, Copy default JSON → paste
      into <code>defaults.ts</code>. {scene === "tunnel" ? `${layerCount} layers · ${fold}-fold${mirror ? " + mirror" : ""}` : "single pair"}.
    </p>
  </header>

  <div class="controls">
    <div class="group">
      <span class="lbl">Scene</span>
      <div class="row">
        <button class:active={scene === "clean"} onclick={() => (scene = "clean")}>Clean</button>
        <button class:active={scene === "tunnel"} onclick={() => (scene = "tunnel")}>Tunnel</button>
      </div>
    </div>

    {#if scene === "tunnel"}
      <div class="group">
        <span class="lbl">Fold</span>
        <div class="row">
          {#each folds as f (f)}
            <button class:active={fold === f} onclick={() => (fold = f)}>{f}×</button>
          {/each}
          <button class:active={mirror} onclick={() => (mirror = !mirror)}>Mirror</button>
        </div>
      </div>
    {/if}

    <div class="group">
      <span class="lbl">Speed</span>
      <input type="range" min="0.1" max="2.5" step="0.1" bind:value={speed} />
      <span class="val">{speed.toFixed(1)}</span>
    </div>

    <div class="group">
      <button class:active={isPlaying} onclick={() => (isPlaying = !isPlaying)}>{isPlaying ? "Pause" : "Play"}</button>
      <button class:active={showGrid} onclick={() => (showGrid = !showGrid)}>Grid</button>
      <button onclick={() => void generateBase()}>Regenerate</button>
    </div>
  </div>

  <div class="group">
    <span class="lbl">Prop</span>
    <div class="row">
      {#each propChoices as c (c.type)}
        <button class:active={propType === c.type} onclick={() => (propType = c.type)}>{c.label}</button>
      {/each}
    </div>
  </div>

  <div class="group effects">
    <span class="lbl">Effect</span>
    <div class="row">
      {#each effectChoices as e (e)}
        <button class:active={activeEffect === e} onclick={() => (activeEffect = e)}>{e}</button>
      {/each}
    </div>
  </div>

  <div class="group">
    <button class="copy" disabled={activeEffect === "none"} onclick={copyDefaultJson}>Copy default JSON</button>
    {#if copyStatus}<span class="copy-status">{copyStatus}</span>{/if}
  </div>

  {#if activePanel}
    {@const Panel = activePanel.comp}
    <div class="effect-panel">
      {#if activePanel.needsBack}
        <Panel onBack={noBack} />
      {:else}
        <Panel />
      {/if}
    </div>
  {/if}

  <div class="stage">
    {#if base}
      <AnimatorCanvas
        blueProp={baseLayer.blue}
        redProp={baseLayer.red}
        {additionalLayers}
        bluePropType={propTypeStr}
        redPropType={propTypeStr}
        sequenceData={base}
        stepData={baseLayer.step}
        currentStep={baseLayer.stepOneBased}
        {isPlaying}
        {gridMode}
        {tipEffectMap}
        effectsConfigState={effectsConfig}
        gridVisible={showGrid}
        hideHeader={true}
        hideProgressBar={true}
        hideTkaGlyph={true}
        hideStepNumbers={true}
        fillContainer={true}
        fireConfig={{ disableFrameCache: true }}
      />
    {:else}
      <div class="placeholder">{status}</div>
    {/if}
  </div>

  <div class="status">{status}</div>
  {#if errorMsg}
    <pre class="err">{errorMsg}</pre>
  {/if}
</div>

<style>
  .page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 20px;
    background: radial-gradient(circle at 50% 30%, #14141f 0%, #0a0a0f 70%);
    color: #e8e8f0;
    font-family: system-ui, sans-serif;
  }
  header { text-align: center; }
  h1 { margin: 0; font-size: 1.4rem; }
  .sub { margin: 4px 0 0; opacity: 0.6; font-size: 0.85rem; }
  .sub code { background: rgba(255 255 255 / 0.1); padding: 1px 5px; border-radius: 5px; }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    justify-content: center;
    align-items: center;
  }
  .group { display: flex; align-items: center; gap: 8px; }
  .group.effects { flex-direction: column; gap: 6px; max-width: 760px; }
  .lbl { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.5; }
  .row { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
  .val { font-variant-numeric: tabular-nums; width: 2.2ch; opacity: 0.7; }
  .copy-status { font-size: 0.78rem; opacity: 0.7; font-variant-numeric: tabular-nums; }

  /* Hosts the real per-effect tuning panel. The panel brings its own
     theme-token styling (with fallbacks), so just give it a constrained card. */
  .effect-panel {
    width: min(560px, 100%);
    padding: 14px 16px;
    border: 1px solid rgba(150 120 240 / 0.3);
    border-radius: 12px;
    background: rgba(20 20 30 / 0.6);
  }

  button {
    background: rgba(255 255 255 / 0.06);
    border: 1px solid rgba(255 255 255 / 0.12);
    color: inherit;
    padding: 7px 12px;
    border-radius: 9px;
    font-size: 0.82rem;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, transform 0.12s;
  }
  button:hover { background: rgba(255 255 255 / 0.12); }
  button:active { transform: scale(0.96); }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  button.active {
    background: linear-gradient(135deg, #6d5ef0, #b14ddb);
    border-color: transparent;
    color: #fff;
  }
  button.copy { background: rgba(150 120 240 / 0.18); border-color: rgba(150 120 240 / 0.5); }
  button.copy:hover:not(:disabled) { background: rgba(150 120 240 / 0.3); }

  .stage {
    width: min(72vmin, 620px);
    aspect-ratio: 1 / 1;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid rgba(255 255 255 / 0.1);
    background: #07070b;
    box-shadow: 0 20px 60px rgba(0 0 0 / 0.5);
  }
  .placeholder {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    opacity: 0.5;
    font-size: 0.9rem;
  }

  .status { font-size: 0.8rem; opacity: 0.6; font-variant-numeric: tabular-nums; text-align: center; }
  .err {
    max-width: 760px;
    white-space: pre-wrap;
    background: rgba(220 60 60 / 0.12);
    border: 1px solid rgba(220 60 60 / 0.4);
    color: #ffb4b4;
    padding: 12px;
    border-radius: 10px;
    font-size: 0.72rem;
  }
</style>
