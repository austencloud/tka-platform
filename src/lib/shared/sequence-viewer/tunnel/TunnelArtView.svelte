<script lang="ts">
  import { onMount } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { ViewerPlaybackState } from "../domain/viewer-prop-groups";
  import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/tip-effect-types";
  import type { TunnelViewController } from "./tunnel-view-controller.svelte";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";

  const {
    sequence,
    playback,
    controller,
    bluePropType,
    redPropType,
  }: {
    sequence: SequenceData;
    playback: ViewerPlaybackState;
    /** Shared controller owned by ArtPane — its controls live in ArtSettingsPanel. */
    controller: TunnelViewController;
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
