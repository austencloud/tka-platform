<script lang="ts">
  import { WaterAbsorptionEffect, type WaterAbsorptionOptions } from "./WaterAbsorptionEffect";
  import { getEffectComposerContext } from "threlte-postprocessing";
  import { onMount, tick } from "svelte";
  import { Vector3 } from "three";

  interface Props extends WaterAbsorptionOptions {
    composerId?: string;
  }

  let { composerId, ...props }: Props = $props();

  const context = getEffectComposerContext(composerId);
  const _effect = new WaterAbsorptionEffect(props);

  onMount(() => {
    tick().then(() => {
      $context.push(_effect);
    });

    return () => {
      _effect.dispose();
    };
  });

  $effect(() => {
    if (props.absorptionR !== undefined || props.absorptionG !== undefined || props.absorptionB !== undefined) {
      _effect.absorptionCoeff = new Vector3(
        props.absorptionR ?? 0.45,
        props.absorptionG ?? 0.07,
        props.absorptionB ?? 0.02,
      );
    }
    if (props.maxDepth !== undefined) _effect.maxDepth = props.maxDepth;
    if (props.scatterColor !== undefined) _effect.scatterColor = props.scatterColor;
    $context.render();
  });
</script>
