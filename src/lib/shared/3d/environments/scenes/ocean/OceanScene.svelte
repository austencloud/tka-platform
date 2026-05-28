<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
  import { FogExp2, Color } from "three";
  import {
    detectOceanQuality,
    getOceanQualityConfig,
  } from "./quality/ocean-quality";
  import FloraInstances from "./authored/FloraInstances.svelte";
  import OceanRuntimeSystems from "./runtime/OceanRuntimeSystems.svelte";
  import { getSceneFeatureContext } from "../../../scene-features/context/scene-feature-context";

  // ── Props ─────────────────────────────────────────────────────────────

  interface Props {
    performerCount?: number;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
  }

  let {
    performerCount = 1,
    stageWidth = 6,
    stageDepth = 6,
    stageZOffset = 0,
  }: Props = $props();

  // ── Quality detection ─────────────────────────────────────────────────

  const { scene, renderer } = useThrelte();

  const qualityTier = $derived(detectOceanQuality(renderer.current ?? null));
  const quality = $derived(getOceanQualityConfig(qualityTier));

  // ── Scene feature readiness ────────────────────────────────────────────

  const sceneFeatures = getSceneFeatureContext();

  // ── Environment GLB ───────────────────────────────────────────────────

  const environmentGlb = useGltf(
    "/models/ocean/ocean-environment.glb",
    { meshoptDecoder: MeshoptDecoder }
  );

  function handleFloraProgress(fraction: number) {
    sceneFeatures?.reportProgress("environment", fraction * 0.9);
  }

  function handleFloraReady() {
    sceneFeatures?.reportReady("environment");
  }

  $effect(() => {
    if ($environmentGlb) {
      sceneFeatures?.reportProgress("environment", 0.05);
    }
  });

  // ── Fog ───────────────────────────────────────────────────────────────

  $effect(() => {
    const s = scene.current;
    if (!s) return;
    const fogColor = new Color("#4a8aaa");
    s.fog = new FogExp2(fogColor.getHex(), 0.004);
    s.background = fogColor;
    return () => {
      if (s) {
        s.fog = null;
        s.background = null;
      }
    };
  });
</script>

{#if $environmentGlb}
  <T is={$environmentGlb.scene} />
{/if}

<FloraInstances {quality} onProgress={handleFloraProgress} onReady={handleFloraReady} />

<OceanRuntimeSystems {quality} {performerCount} {stageWidth} {stageDepth} {stageZOffset} />
