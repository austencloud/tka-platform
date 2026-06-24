<!--
  Effect Tuner — pick sensible shipped defaults for all 16 effects (throwaway).

  Gallery layout for ultrawide: big square stage on the left, the REAL
  production EffectsPanel on the right (EffectSelector + Choose-a-Look presets +
  Customize + primary slider) so the tuner shows exactly what the end user sees.

  Two scenes off the SAME base motion (flipping reuses base — no regeneration):
    • Clean  — single blue+red pair. Honest single-effect read.
    • Tunnel — rotated/mirrored kaleidoscope copies. Additive-overlap gate.
  Tune via the panel, then "Copy default JSON" → paste into
  DEFAULT_EFFECTS_CONFIG[effect] in src/lib/shared/effects/domain/defaults.ts.

  Driven by an ISOLATED effects config (persist:false → never touches the
  user's global tka_effects_config). Default prop = STAFF (2 tip ends reveal
  coverage/blowout). Spec: docs/superpowers/specs/active/2026-06-23-effect-tuner-design.md
-->
<script lang="ts">
  import { onMount } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import EffectsPanel from "$lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte";
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
  import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/tip-effect-types";

  // Isolated effects config — drives the real EffectsPanel via context.
  import {
    createEffectsConfigState,
    isEffectId,
  } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import BentoPropGrid from "$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { isBilateralProp } from "$lib/shared/pictograph/prop/domain/enums/prop-classification";
  import { TrackingMode } from "$lib/shared/animation-engine/domain/types/trail-types";

  const DEFAULT_PROP_STATE: PropState = { centerPathAngle: 0, staffRotationAngle: 0 };

  type Fold = 2 | 4 | 8;
  type Scene = "clean" | "tunnel";

  // persist:false → fully isolated; never touches the user's tka_effects_config.
  const effectsConfig = createEffectsConfigState(undefined, { persist: false });
  setEffectsConfigContext(effectsConfig);

  // ── Knobs ───────────────────────────────────────────────────
  let scene = $state<Scene>("clean");
  let fold = $state<Fold>(4);
  let mirror = $state(false);
  let speed = $state(0.3); // beats per second
  let isPlaying = $state(true);
  let showGrid = $state(true);
  let status = $state("loading…");
  let errorMsg = $state<string | null>(null);
  let layerCount = $state(1);
  let copyStatus = $state("");
  let bpm = $state(120); // EffectsPanel requires it; playback is driven by our own loop

  const folds: Fold[] = [2, 4, 8];

  // Prop selection flows through the REAL production source of truth
  // (settingsService) so the trail system + TrailsPanel gating + bilateral
  // tracking all see the same prop the canvas renders.
  const propType = $derived<PropType>(settingsService.settings.bluePropType ?? PropType.STAFF);

  function selectProp(p: PropType) {
    // In-memory only (NOT updateSetting) → picking a prop here never persists to
    // the user's real app settings (no localStorage / Firebase write). The
    // originals are snapshotted on mount and restored on unmount.
    settingsService.settings.bluePropType = p;
    settingsService.settings.redPropType = p;
    animationSettings.setCurrentPropType(String(p));
  }

  // trackingMode + tailLength live in animationSettings (NOT effectsConfig), so
  // AnimatorCanvas only respects them when we pass an explicit trailSettings.
  // Replicates AnimationPlayer: BOTH_ENDS collapses to one end on unilateral props.
  const trailSettings = $derived.by(() => {
    const t = animationSettings.trail;
    const settings = { ...t };
    if (settings.trackingMode === TrackingMode.BOTH_ENDS) {
      const blue = settingsService.settings.bluePropType;
      const red = settingsService.settings.redPropType;
      const hasBilateral =
        (blue != null && isBilateralProp(String(blue))) ||
        (red != null && isBilateralProp(String(red)));
      if (!hasBilateral) settings.trackingMode = TrackingMode.RIGHT_END;
    }
    return settings;
  });

  // EffectsPanel owns effect selection through the config — read it back.
  const activeEffect = $derived(effectsConfig.activeEffect);
  const activeTipEffectMap = $derived<TipEffectMap | undefined>(
    activeEffect === "none" ? undefined : effectsConfig.tipEffectMap,
  );

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
    // Tuner is a SANDBOX. effectsConfig is already isolated (persist:false →
    // effect tuning never touches the user's tka_effects_config). Prop + trail
    // trackingMode/tailLength route through GLOBAL singletons because the trail
    // system reads them (settingsService / animationSettings, the latter
    // auto-persists). So snapshot the user's originals now and restore on leave
    // — tuning here must never stick to their real app.
    const origBlue = settingsService.settings.bluePropType;
    const origRed = settingsService.settings.redPropType;
    const origTrail = { ...animationSettings.trail };
    const origPropType = animationSettings.currentPropType;

    // Open on a vivid effect so the stage isn't empty on first paint.
    effectsConfig.setActiveEffect("bloom");
    // Tell the trail system which prop is active (panel labels + bilateral gate).
    animationSettings.setCurrentPropType(String(propType));

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

    return () => {
      cancelAnimationFrame(raf);
      // Restore the user's real prop + trail settings. Prop is in-memory;
      // updateSettings re-persists the original trail, undoing any in-session
      // auto-save the trail singleton made.
      settingsService.settings.bluePropType = origBlue;
      settingsService.settings.redPropType = origRed;
      animationSettings.updateSettings({ trail: origTrail });
      animationSettings.setCurrentPropType(origPropType);
    };
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

  // ── Save the active effect's live intent straight into defaults.ts ──────────
  // Posts to the dev-only write-back endpoint, which patches
  // DEFAULT_EFFECTS_CONFIG[<effect>] in place. Vite then HMR-reloads the file.
  let saving = $state(false);
  async function saveAsDefault() {
    const fx = effectsConfig.activeEffect;
    if (fx === "none" || !isEffectId(fx)) {
      copyStatus = "Pick an effect first";
      return;
    }
    const intent = $state.snapshot(effectsConfig.effect(fx));
    saving = true;
    copyStatus = `Saving ${fx}…`;
    try {
      const res = await fetch("/test/effect-tuner/save-default", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ effect: fx, intent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.message ?? `${res.status} ${res.statusText}`);
      copyStatus = `Saved ${fx} as default ✓ — defaults.ts patched`;
    } catch (e) {
      copyStatus = `Save failed: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      saving = false;
    }
  }

  // ── Copy the active effect's live intent (manual paste fallback) ────────────
  function copyDefaultJson() {
    const fx = effectsConfig.activeEffect;
    if (fx === "none" || !isEffectId(fx)) {
      copyStatus = "Pick an effect first";
      return;
    }
    const intent = $state.snapshot(effectsConfig.effect(fx));
    const json = JSON.stringify(intent, null, 2);
    void navigator.clipboard
      .writeText(json)
      .then(() => { copyStatus = `Copied ${fx} default (${json.length} chars)`; })
      .catch(() => { copyStatus = "Clipboard blocked — JSON logged to console"; console.log(json); });
  }
</script>

<div class="page">
  <header>
    <h1>Effect Tuner</h1>
    <p class="sub">
      Real production panel · judge in Clean, confirm in Tunnel · Copy default JSON →
      <code>defaults.ts</code>. {scene === "tunnel" ? `${layerCount} layers · ${fold}-fold${mirror ? " + mirror" : ""}` : "single pair"}.
    </p>
  </header>

  <div class="body">
    <aside class="prop-col">
      <BentoPropGrid
        selectedPropType={propType}
        color="blue"
        title="Prop"
        variant="panel"
        onSelect={selectProp}
      />
    </aside>

    <div class="stage-col">
      <div class="toolbar">
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

        <div class="group push">
          <button class="save" disabled={activeEffect === "none" || saving} onclick={saveAsDefault}>
            {saving ? "Saving…" : "Save as default"}
          </button>
          <button class="copy" disabled={activeEffect === "none"} onclick={copyDefaultJson}>Copy JSON</button>
          {#if copyStatus}<span class="copy-status">{copyStatus}</span>{/if}
        </div>
      </div>

      <div class="stage-wrap">
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
              {trailSettings}
              tipEffectMap={activeTipEffectMap}
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
      </div>

      <div class="status">{status}</div>
      {#if errorMsg}
        <pre class="err">{errorMsg}</pre>
      {/if}
    </div>

    <aside class="panel-col">
      <EffectsPanel
        {bpm}
        onBpmChange={(v) => (bpm = v)}
        {isPlaying}
        onPlaybackToggle={() => (isPlaying = !isPlaying)}
        showPlayback={false}
        showTransport={false}
        layout="sidebar"
      />
    </aside>
  </div>
</div>

<style>
  .page {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: radial-gradient(circle at 30% 20%, #14141f 0%, #0a0a0f 70%);
    color: #e8e8f0;
    font-family: system-ui, sans-serif;
  }
  header { padding: 12px 20px 4px; }
  h1 { margin: 0; font-size: 1.3rem; }
  .sub { margin: 3px 0 0; opacity: 0.55; font-size: 0.82rem; }
  .sub code { background: rgba(255 255 255 / 0.1); padding: 1px 5px; border-radius: 5px; }

  .body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 232px minmax(0, 1fr) 360px;
    gap: 16px;
    padding: 8px 16px 16px;
  }

  .prop-col {
    overflow-y: auto;
    border-radius: 14px;
  }

  .stage-col {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 12px;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
  }
  .group { display: flex; align-items: center; gap: 8px; }
  .group.push { margin-left: auto; }
  .lbl { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.5; }
  .row { display: flex; gap: 6px; flex-wrap: wrap; }
  .val { font-variant-numeric: tabular-nums; width: 2.2ch; opacity: 0.7; }
  .copy-status { font-size: 0.78rem; opacity: 0.7; font-variant-numeric: tabular-nums; }

  .stage-wrap {
    flex: 1;
    min-height: 0;
    display: grid;
    place-items: center;
  }
  .stage {
    width: min(100%, 82vh);
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

  .panel-col {
    overflow-y: auto;
    border: 1px solid rgba(255 255 255 / 0.08);
    border-radius: 14px;
    background: rgba(18 18 28 / 0.55);
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
  button.save {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    border-color: transparent;
    color: #fff;
    font-weight: 600;
  }
  button.save:hover:not(:disabled) { filter: brightness(1.1); }

  .status { font-size: 0.78rem; opacity: 0.6; font-variant-numeric: tabular-nums; }
  .err {
    max-width: 100%;
    white-space: pre-wrap;
    background: rgba(220 60 60 / 0.12);
    border: 1px solid rgba(220 60 60 / 0.4);
    color: #ffb4b4;
    padding: 12px;
    border-radius: 10px;
    font-size: 0.72rem;
  }
</style>
