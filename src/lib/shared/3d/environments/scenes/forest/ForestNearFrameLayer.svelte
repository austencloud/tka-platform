<script lang="ts">
  import { T } from "@threlte/core";
  import { useGltf, useMeshopt } from "@threlte/extras";
  import ForestClearingWind from "./ForestClearingWind.svelte";
  import ForestAtmosphereMaterials from "./ForestAtmosphereMaterials.svelte";
  import type { ForestMaterialResponseConfig } from "../../domain/models/scene-configs/forest-scene-config";

  interface Props {
    groundY: number;
    materialResponse?: ForestMaterialResponseConfig;
    onReady?: () => void;
  }

  let { groundY, materialResponse, onReady }: Props = $props();
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
  {#if materialResponse}
    <ForestAtmosphereMaterials
      scene={$nearFrame.scene}
      response={materialResponse}
      scope="near-frame"
    />
  {/if}
  <ForestClearingWind scene={$nearFrame.scene} />
{/if}
