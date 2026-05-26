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

  // ── Environment GLB ───────────────────────────────────────────────────

  const environmentGlb = useGltf(
    "/models/ocean/ocean-environment.glb",
    { meshoptDecoder: MeshoptDecoder }
  );

  // ── Fog ───────────────────────────────────────────────────────────────

  $effect(() => {
    const s = scene.current;
    if (!s) return;
    s.fog = new FogExp2(new Color("#0a1a2a").getHex(), 0.04);
    return () => {
      if (s) s.fog = null;
    };
  });
</script>

{#if $environmentGlb}
  <T is={$environmentGlb.scene} />
{/if}

<FloraInstances {quality} />

<OceanRuntimeSystems {quality} {performerCount} {stageWidth} {stageDepth} {stageZOffset} />
