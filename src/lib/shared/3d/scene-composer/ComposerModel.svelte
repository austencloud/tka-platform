<script lang="ts">
  import { T } from "@threlte/core";
  import { useGltf } from "@threlte/extras";

  interface Props {
    src: string;
  }

  const { src }: Props = $props();
  const gltf = useGltf(src);
  const model = $derived($gltf?.scene.clone(true));
</script>

{#if model}
  <T is={model} />
{/if}
