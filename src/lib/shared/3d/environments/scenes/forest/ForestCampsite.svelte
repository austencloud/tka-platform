<script lang="ts">
  import { T } from "@threlte/core";
  import { useGltf, useMeshopt } from "@threlte/extras";
  import type { Mesh, Object3D } from "three";
  import ForestAtmosphereMaterials from "./ForestAtmosphereMaterials.svelte";
  import type { ForestMaterialResponseConfig } from "../../domain/models/scene-configs/forest-scene-config";

  interface Props {
    groundY: number;
    showTents: boolean;
    showCampfire: boolean;
    materialResponse?: ForestMaterialResponseConfig;
    onReady?: () => void;
    onError?: (error: Error) => void;
  }

  let {
    groundY,
    showTents,
    showCampfire,
    materialResponse,
    onReady,
    onError,
  }: Props = $props();

  const campsite = useGltf("/models/forest/forest-campsite.glb", {
    meshoptDecoder: useMeshopt(),
  });
  const campsiteError = campsite.error;
  let readinessReported = $state(false);
  let failureReported = $state(false);

  function applyVisibility(child: Object3D): void {
    const role = child.userData?.tka_role;
    if (role === "tent" || role === "tent-pad") {
      child.visible = showTents;
    } else if (role === "fire-pit" || role === "camp-chair") {
      child.visible = showCampfire;
    }
  }

  $effect(() => {
    if (!$campsite || readinessReported) return;

    $campsite.scene.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });

    readinessReported = true;
    onReady?.();
  });

  $effect(() => {
    if (!$campsite) return;
    $campsite.scene.traverse(applyVisibility);
  });

  $effect(() => {
    if (!$campsiteError || failureReported) return;
    failureReported = true;
    onError?.($campsiteError);
  });
</script>

{#if $campsite}
  <T.Group position.y={groundY}>
    <T is={$campsite.scene} dispose={false} />
    {#if materialResponse}
      <ForestAtmosphereMaterials
        scene={$campsite.scene}
        response={materialResponse}
        scope="camp"
      />
    {/if}
  </T.Group>
{/if}
