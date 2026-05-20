<script lang="ts">
  import { UnderwaterDistortionEffect, type UnderwaterDistortionOptions } from "./UnderwaterDistortionEffect";
  import { getEffectComposerContext } from "threlte-postprocessing";
  import { onMount, tick } from "svelte";

  interface Props extends UnderwaterDistortionOptions {
    composerId?: string;
  }

  let { composerId, ...props }: Props = $props();

  const context = getEffectComposerContext(composerId);
  const _effect = new UnderwaterDistortionEffect(props);

  onMount(() => {
    tick().then(() => {
      $context.push(_effect);
    });

    return () => {
      _effect.dispose();
    };
  });

  $effect(() => {
    if (props.strength !== undefined) _effect.strength = props.strength;
    if (props.frequency !== undefined) _effect.frequency = props.frequency;
    if (props.speed !== undefined) _effect.speed = props.speed;
    $context.render();
  });
</script>
