<script lang="ts">
  import { onMount } from "svelte";
  import type { Object3D } from "three";
  import type { ForestMaterialResponseConfig } from "../../domain/models/scene-configs/forest-scene-config";
  import {
    createForestAtmosphereMaterialController,
    type ForestAtmosphereMaterialController,
    type ForestMaterialScope,
  } from "../../worlds/forest/forest-atmosphere-materials";

  interface Props {
    scene: Object3D;
    response: ForestMaterialResponseConfig;
    scope: ForestMaterialScope;
  }

  let { scene, response, scope }: Props = $props();
  let controller: ForestAtmosphereMaterialController | null = null;

  onMount(() => {
    controller = createForestAtmosphereMaterialController(
      scene,
      response,
      scope
    );
    return () => {
      controller?.dispose();
      controller = null;
    };
  });

  $effect(() => {
    controller?.update(response);
  });
</script>
