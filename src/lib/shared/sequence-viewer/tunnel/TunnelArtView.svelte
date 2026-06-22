<script lang="ts">
  import { onMount } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { ViewerPlaybackState } from "../domain/viewer-prop-groups";
  import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/tip-effect-types";
  import type { TunnelViewController } from "./tunnel-view-controller.svelte";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";

  const {
    sequence,
    playback,
    controller,
    bpm = 60,
    bluePropType,
    redPropType,
  }: {
    sequence: SequenceData;
    playback: ViewerPlaybackState;
    /** Shared controller owned by ArtPane — its controls live in ArtSettingsPanel. */
    controller: TunnelViewController;
    /** Global tempo from the sidebar's Playback section. Drives the playhead so
     *  the tempo selector controls the kaleidoscope (60 BPM = 1 beat/sec). */
    bpm?: number;
    bluePropType?: string;
    redPropType?: string;
  } = $props();

  // An art view animates on its own clock (like the mandala) — it must not
  // depend on the 2D transport being played. Effects/props/effort come from the
  // viewer's shared effects-config; the only tunnel-unique knobs are fold + mirror
  // (driven through the shared controller from ArtSettingsPanel).
  const effectsConfig = getEffectsConfigContext();

  const seq = $derived(playback.animationState.sequenceData ?? sequence);
  const gridMode = $derived(seq?.gridMode);
  const stepCount = $derived(seq?.steps?.length ?? 0);

  // Self-driven playhead (1-indexed fractional, matching the controller's
  // step convention). Driven by the global tempo so the sidebar's tempo selector
  // controls the kaleidoscope: beats/sec = bpm/60 (60 BPM = 1 beat/sec, matching
  // the 2D engine's speed convention).
  let step = $state(1);
  const speed = $derived(Math.max(0, bpm) / 60);

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

  // The Art panel's Trail dials are split across two stores: tracking / length /
  // mode / fade live on the legacy animationSettings.trail, while the visual
  // dials (thickness, brightness, colors) write to the unified effects config.
  // The 2D trail overlay only reads the legacy TrailSettings, so fold the
  // effects-config visuals back in here — otherwise dragging a dial mutates a
  // store the renderer never reads. Mirrors resolveTrails2D's intent mapping.
  const trailSettings = $derived.by(() => {
    const base = animationSettings.trail;
    const tr = effectsConfig?.trails;
    if (!tr) return base;
    return {
      ...base,
      lineWidth: tr.thickness,
      maxOpacity: tr.brightness,
      minOpacity: tr.brightness * 0.3,
      blueColor: tr.blueColor,
      redColor: tr.redColor,
    };
  });
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
        {trailSettings}
        {tipEffectMap}
        effectsConfigState={effectsConfig ?? undefined}
        gridVisible={controller.gridVisible}
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
</style>
