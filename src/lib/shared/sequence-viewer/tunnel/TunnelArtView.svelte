<script lang="ts">
  import { onMount } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { ViewerPlaybackState } from "../domain/viewer-prop-groups";
  import type { Fold } from "./tunnel-fold-math";
  import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/tip-effect-types";
  import { TunnelViewController } from "./tunnel-view-controller.svelte";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";

  const {
    sequence,
    playback,
    bluePropType,
    redPropType,
  }: {
    sequence: SequenceData;
    playback: ViewerPlaybackState;
    bluePropType?: string;
    redPropType?: string;
  } = $props();

  // An art view animates on its own clock (like the mandala) — it must not
  // depend on the 2D transport being played. Effects/props/effort come from the
  // viewer's shared effects-config; the only tunnel-unique knobs are fold + mirror.
  const effectsConfig = getEffectsConfigContext();
  const controller = new TunnelViewController({
    getSequence: () => playback.animationState.sequenceData ?? sequence,
  });
  controller.active = true;

  const folds: Fold[] = [2, 4, 8];

  const seq = $derived(playback.animationState.sequenceData ?? sequence);
  const gridMode = $derived(seq?.gridMode);
  const stepCount = $derived(seq?.steps?.length ?? 0);

  // Self-driven playhead (1-indexed fractional, matching the controller's
  // step convention). Speed scales down as the stack gets busier.
  let step = $state(1);
  const speed = $derived(controller.fold >= 8 ? 0.25 : controller.fold === 4 ? 0.35 : 0.6);

  onMount(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (stepCount > 0) {
        const beat = (step - 1 + dt * speed) % stepCount;
        step = beat + 1;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  const base = $derived(controller.basePropsAt(step));
  const additionalLayers = $derived(controller.additionalLayersAt(step));

  // Reuse the sidebar's chosen effect, applied uniformly across every layer.
  const activeEffect = $derived(effectsConfig?.activeEffect ?? "none");
  const tipEffectMap = $derived<TipEffectMap | undefined>(
    activeEffect === "none" ? undefined : { "*": { effect: activeEffect } },
  );

  const heavyLoad = $derived(
    TunnelViewController.HEAVY_EFFECTS.has(activeEffect) &&
      (controller.fold === 8 || controller.mirror),
  );

  let newName = $state("");
</script>

<div class="tunnel-art">
  <div class="stage">
    {#if seq}
      <AnimatorCanvas
        blueProp={base.blue}
        redProp={base.red}
        {additionalLayers}
        {bluePropType}
        {redPropType}
        sequenceData={seq}
        currentStep={step}
        isPlaying={true}
        {gridMode}
        {tipEffectMap}
        effectsConfigState={effectsConfig ?? undefined}
        gridVisible={false}
        hideHeader={true}
        hideProgressBar={true}
        hideTkaGlyph={true}
        hideStepNumbers={true}
        hidePathLines={true}
        fillContainer={true}
        fireConfig={{ disableFrameCache: true }}
      />
    {/if}
  </div>

  <div class="controls">
    <div class="group">
      <span class="lbl">Fold</span>
      {#each folds as f (f)}
        <button class:active={controller.fold === f} onclick={() => controller.setFold(f)}>{f}×</button>
      {/each}
      <button class:active={controller.mirror} onclick={() => (controller.mirror = !controller.mirror)}>Mirror</button>
    </div>

    {#if heavyLoad}
      <p class="warn">Heavy effect on a large stack — may drop frames on weaker devices.</p>
    {/if}

    <div class="presets">
      <input
        class="name-input"
        type="text"
        placeholder="name this look…"
        bind:value={newName}
        onkeydown={(e) => { if (e.key === "Enter") { controller.saveCurrentAs(newName); newName = ""; } }}
      />
      <button onclick={() => { controller.saveCurrentAs(newName); newName = ""; }}>Save</button>
      {#each controller.presets as p (p.id)}
        <div class="chip">
          <button class="chip-apply" onclick={() => controller.applyPreset(p)}>{p.name}</button>
          <button class="chip-del" aria-label={`Delete ${p.name}`} onclick={() => controller.deletePreset(p.id)}>×</button>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .tunnel-art {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .stage {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .stage :global(canvas) { max-width: 100%; max-height: 100%; }
  .controls {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
  }
  .group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: center; }
  .lbl { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.5; }
  button {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: inherit; padding: 6px 11px; border-radius: 9px; font-size: 0.8rem; cursor: pointer;
    min-height: 40px;
  }
  button.active {
    background: var(--theme-accent, #8b5cf6); border-color: transparent; color: #fff;
  }
  .warn { margin: 0; font-size: 0.72rem; color: var(--semantic-warning, #fbbf24); text-align: center; }
  .presets { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center; }
  .name-input {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    color: inherit; padding: 6px 11px; border-radius: 9px; font-size: 0.8rem; min-height: 40px; width: 150px;
  }
  .chip { display: inline-flex; border: 1px solid var(--theme-accent, rgba(150,120,240,0.4)); border-radius: 999px; overflow: hidden; }
  .chip-apply { border: none; border-radius: 0; }
  .chip-del { border: none; border-radius: 0; padding: 6px 9px; }
</style>
