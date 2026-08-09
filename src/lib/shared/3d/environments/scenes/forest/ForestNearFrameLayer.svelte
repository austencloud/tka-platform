<script lang="ts">
  import { T } from "@threlte/core";
  import { useGltf, useMeshopt } from "@threlte/extras";

  interface Props {
    groundY: number;
    onReady?: () => void;
  }

  let { groundY, onReady }: Props = $props();
  let readinessReported = $state(false);

  const nearFrame = useGltf("/models/forest/forest-near-frame.glb", {
    meshoptDecoder: useMeshopt(),
  });

  $effect(() => {
    if (!$nearFrame || readinessReported) return;
    readinessReported = true;
    onReady?.();
  });
</script>

{#if $nearFrame}
  <T is={$nearFrame.scene} position.y={groundY} />
{/if}
