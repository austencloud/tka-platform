<script lang="ts">
  /**
   * One motif station with its own isolated effects config.
   *
   * Every effect in EffectsLayer gates on the effects-config CONTEXT
   * (`config.tipEffectMap["*"].effect`), not on the tipEffectMap prop, so six
   * stations showing six different effects need six separate config states.
   *
   * persist:false keeps this harness out of the shared tka_effects_config key.
   */
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import TelekineticFormation3D from "$lib/features/museum/components/game/TelekineticFormation3D.svelte";
  import type { EffectType } from "$lib/shared/animation-engine/domain/types/tip-effect-types";

  interface Props {
    stationId: string;
    worldX: number;
    worldZ: number;
    sequenceId: string;
    effectId: string;
    showProps: boolean;
    playing: boolean;
  }
  const props: Props = $props();

  const effectsState = createEffectsConfigState(undefined, { persist: false });
  setEffectsConfigContext(effectsState);

  $effect(() => {
    effectsState.setTipEffectMap({ "*": { effect: props.effectId as EffectType } });
  });
</script>

<TelekineticFormation3D
  stationId={props.stationId}
  worldX={props.worldX}
  worldZ={props.worldZ}
  sequenceId={props.sequenceId}
  presentation="sculpture"
  effectId={props.effectId}
  showProps={props.showProps}
  autoPlay={props.playing}
/>
