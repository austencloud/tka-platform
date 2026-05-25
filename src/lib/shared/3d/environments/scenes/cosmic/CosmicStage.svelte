<script lang="ts">
  import { T } from "@threlte/core";
  import { useGltf, useDraco } from "@threlte/extras";
  import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
  import { onDestroy } from "svelte";
  import type { Group } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";

  const groundY = $derived(userProportionsState.groundY);

  const dracoLoader = useDraco("/draco/");
  const gltf = useGltf("/models/cosmic/cosmic-stage.glb", {
    dracoLoader,
    meshoptDecoder: MeshoptDecoder,
  });

  let sceneRef = $state<Group | undefined>();

  onDestroy(() => {
    if (!sceneRef) return;
    sceneRef.traverse((child) => {
      if ("geometry" in child) {
        (child as any).geometry?.dispose();
      }
      if ("material" in child) {
        const mat = (child as any).material;
        if (Array.isArray(mat)) mat.forEach((m: any) => m?.dispose());
        else mat?.dispose();
      }
    });
  });
</script>

{#if $gltf}
  <T.Group position.y={groundY} bind:ref={sceneRef}>
    <T is={$gltf.scene} />
  </T.Group>
{/if}
