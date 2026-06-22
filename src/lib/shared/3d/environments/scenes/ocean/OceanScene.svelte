<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { useGltf, useKtx2, useMeshopt } from "@threlte/extras";
  import { FogExp2, Color } from "three";
  import {
    detectOceanQuality,
    getOceanQualityConfig,
  } from "./quality/ocean-quality";
  import { oceanQualityOverride } from "./quality/ocean-quality-override.svelte";
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

  const qualityTier = $derived(
    oceanQualityOverride.tier !== "auto"
      ? oceanQualityOverride.tier
      : detectOceanQuality(renderer.current ?? null),
  );
  const quality = $derived(getOceanQualityConfig(qualityTier));

  // ── Scene feature readiness ────────────────────────────────────────────

  const sceneFeatures = getSceneFeatureContext();

  // ── Environment GLB ───────────────────────────────────────────────────

  const environmentGlb = useGltf("/models/ocean/ocean-environment.glb", {
    meshoptDecoder: useMeshopt(),
    ktx2Loader: useKtx2("/basis/"),
  });

  // The environment feature loads two GLBs: the seabed (ocean-environment.glb,
  // above) and the flora scene (inside FloraInstances). The loading bar must
  // represent BOTH, and never bounce — so we fold them into one combined
  // fraction here. Seabed is a binary step (useGltf gives no byte progress);
  // flora reports real loaded/total. Ready fires only when both have landed.
  const SEABED_WEIGHT = 0.4;
  const FLORA_WEIGHT = 0.6;

  let floraFraction = $state(0);
  let floraLoaded = $state(false);

  function handleFloraProgress(fraction: number) {
    floraFraction = fraction;
  }

  function handleFloraReady() {
    floraLoaded = true;
    floraFraction = 1;
  }

  $effect(() => {
    const seabed = $environmentGlb ? 1 : 0;
    const combined = seabed * SEABED_WEIGHT + floraFraction * FLORA_WEIGHT;
    sceneFeatures?.reportProgress("environment", combined);
    if ($environmentGlb && floraLoaded) {
      sceneFeatures?.reportReady("environment");
    }
  });

  // ── Fog ───────────────────────────────────────────────────────────────

  $effect(() => {
    const s = scene.current;
    if (!s) return;
    const fogColor = new Color("#0d0d10");
    s.fog = new FogExp2(fogColor.getHex(), 0.012);
    s.background = fogColor;
    return () => {
      if (s) {
        s.fog = null;
        s.background = null;
      }
    };
  });

  // ── Device-pixel-ratio cap ─────────────────────────────────────────────
  // maxPixelRatio is defined per quality tier but was never applied to the live
  // renderer — only the offline exporter capped DPR. Retina phones (DPR 2.5-3)
  // therefore rendered the full caustic/boid/particle fragment load at native
  // resolution. Cap it here and restore the prior ratio on teardown so other
  // scenes are unaffected. Re-runs when the tier (and thus maxPixelRatio) changes.
  $effect(() => {
    const r = renderer.current;
    if (!r) return;
    const prev = r.getPixelRatio();
    r.setPixelRatio(Math.min(window.devicePixelRatio, quality.maxPixelRatio));
    return () => {
      r.setPixelRatio(prev);
    };
  });
</script>

{#if $environmentGlb}
  <T is={$environmentGlb.scene} />
{/if}

<FloraInstances {quality} onProgress={handleFloraProgress} onReady={handleFloraReady} />

<OceanRuntimeSystems {quality} {performerCount} {stageWidth} {stageDepth} {stageZOffset} />
