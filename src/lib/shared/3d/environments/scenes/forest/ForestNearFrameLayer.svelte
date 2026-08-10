<script lang="ts">
  import { T } from "@threlte/core";
  import { useGltf, useMeshopt } from "@threlte/extras";
  import type { Mesh } from "three";
  import { tryGetAdaptiveQualityContext } from "../../../context/adaptive-quality-context";
  import ForestClearingWind from "./ForestClearingWind.svelte";
  import ForestAtmosphereMaterials from "./ForestAtmosphereMaterials.svelte";
  import { resolveForestNearFrameShadowRole } from "./forest-shadow-roles";
  import type { ForestMaterialResponseConfig } from "../../domain/models/scene-configs/forest-scene-config";

  interface Props {
    groundY: number;
    materialResponse?: ForestMaterialResponseConfig;
    onReady?: () => void;
  }

  let { groundY, materialResponse, onReady }: Props = $props();
  let readinessReported = $state(false);
  const adaptiveQuality = tryGetAdaptiveQualityContext();
  const shadowsEnabled = $derived(
    adaptiveQuality?.config.enableShadows ?? true
  );

  const nearFrame = useGltf("/models/forest/forest-near-frame.glb", {
    meshoptDecoder: useMeshopt(),
  });

  $effect(() => {
    if (!$nearFrame || readinessReported) return;
    readinessReported = true;
    onReady?.();
  });

  $effect(() => {
    if (!$nearFrame) return;

    $nearFrame.scene.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const shadowRole = resolveForestNearFrameShadowRole(
        child.userData?.tka_role,
        shadowsEnabled
      );
      mesh.castShadow = shadowRole.cast;
      mesh.receiveShadow = shadowRole.receive;
    });
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
