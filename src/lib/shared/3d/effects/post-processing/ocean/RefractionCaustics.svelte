<script lang="ts">
  import { RefractionCausticsEffect, type RefractionCausticsOptions } from "./RefractionCausticsEffect";
  import { getEffectComposerContext } from "threlte-postprocessing";
  import { onMount, tick } from "svelte";

  interface Props extends RefractionCausticsOptions {
    composerId?: string;
  }

  let { composerId, ...props }: Props = $props();

  const context = getEffectComposerContext(composerId);
  const _effect = new RefractionCausticsEffect(props);

  onMount(() => {
    tick().then(() => {
      $context.push(_effect);
    });

    return () => {
      _effect.dispose();
    };
  });

  $effect(() => {
    if (props.intensity !== undefined) _effect.causticsIntensity = props.intensity;
    if (props.scale !== undefined) _effect.causticsScale = props.scale;
    if (props.speed !== undefined) _effect.causticsSpeed = props.speed;
    $context.render();
  });
</script>
