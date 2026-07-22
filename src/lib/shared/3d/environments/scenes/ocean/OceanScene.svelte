<script lang="ts">
  import { T, useThrelte, useTask } from "@threlte/core";
  import { useGltf, useKtx2, useMeshopt } from "@threlte/extras";
  import {
    FogExp2,
    Color,
    PMREMGenerator,
    Mesh,
    MeshStandardMaterial,
    type Scene,
    type WebGLRenderer,
  } from "three";
  import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
  import { userProportionsState } from "@austencloud/scene-3d";
  import {
    detectOceanQuality,
    getOceanQualityConfig,
  } from "./quality/ocean-quality";
  import { oceanQualityOverride } from "./quality/ocean-quality-override.svelte";
  import { oceanDebugToggles } from "./quality/ocean-debug-toggles.svelte";
  import {
    causticUniforms,
    patchCausticsMaterial,
  } from "./runtime/atmosphere/seabed-caustics";
  import FloraInstances from "./authored/FloraInstances.svelte";
  import OceanRuntimeSystems from "./runtime/OceanRuntimeSystems.svelte";
  import { getSceneFeatureContext } from "../../../scene-features/context/scene-feature-context";
  import { tryGetAdaptiveQualityContext } from "../../../context/adaptive-quality-context";

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

  const { scene, renderer } = useThrelte() as unknown as {
    scene: Scene;
    renderer: WebGLRenderer;
  };
  const adaptiveQuality = tryGetAdaptiveQualityContext();

  const qualityTier = $derived(
    oceanQualityOverride.tier !== "auto"
      ? oceanQualityOverride.tier
      : adaptiveQuality
        ? adaptiveQuality.tier === "high"
          ? "ultra"
          : adaptiveQuality.tier
        : detectOceanQuality(renderer)
  );
  const quality = $derived(getOceanQualityConfig(qualityTier));
  const floraRequired = $derived(quality.enableAuthoredFlora);

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

  $effect(() => {
    if (floraRequired) {
      floraFraction = 0;
      floraLoaded = false;
      return;
    }

    // LOW keeps the seabed, stage, lighting, and underwater colour, but skips
    // the 54M-vertex reef. The loading curtain should not wait for an asset this
    // tier deliberately does not request.
    floraFraction = 1;
    floraLoaded = true;
  });

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
    if ($environmentGlb && (!floraRequired || floraLoaded)) {
      sceneFeatures?.reportReady("environment");
    }
  });

  // ── Fog ───────────────────────────────────────────────────────────────

  $effect(() => {
    const s = scene;
    // Deep blue-teal so distance dissolves into water, not a dead-black void
    // (was #0d0d10). Pairs with the absorption depth-grade in ScenePostProcessing.
    const fogColor = new Color("#0a2438");
    // Keep the backdrop colour always; the dev `fog` toggle only removes the
    // distance haze veil so a reviewer can see how much of the washout it owns.
    s.background = fogColor;
    s.fog = oceanDebugToggles.fog
      ? new FogExp2(fogColor.getHex(), 0.012)
      : null;
    return () => {
      if (s) {
        s.fog = null;
        s.background = null;
      }
    };
  });

  // ── Image-based lighting ───────────────────────────────────────────────
  // The scene was flat-lit: every material sets envMapIntensity but
  // scene.environment was null, so that intensity multiplied nothing. Assign a
  // cheap PMREM env (low-energy RoomEnvironment) to activate it — soft fresnel /
  // spec breakup gives the coral a wet look instead of a flat diffuse read.
  $effect(() => {
    const r = renderer;
    const s = scene;
    // Dev `ibl` toggle — drop the env entirely to A/B how much the reflective
    // wash owns the washed-out read.
    if (!quality.enableImageBasedLighting || !oceanDebugToggles.ibl) {
      s.environment = null;
      return;
    }
    const pmrem = new PMREMGenerator(r);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    s.environment = envTex;
    pmrem.dispose();
    return () => {
      if (s.environment === envTex) s.environment = null;
      envTex.dispose();
    };
  });

  // ── Seabed caustics ────────────────────────────────────────────────────
  // Patch the seabed GLB's materials so the floor catches the same animated
  // caustic dapple as the flora/structures (FloraInstances patches those).
  $effect(() => {
    const g = $environmentGlb;
    if (!g || !quality.enableCaustics) return;
    g.scene.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (mat instanceof MeshStandardMaterial) patchCausticsMaterial(mat);
      }
    });
  });

  // Single caustic clock for every patched material (seabed + flora). Keep the
  // mask anchored to the live seabed height, and let the dev `caustics` toggle
  // A/B the cue by zeroing strength (no shader recompile).
  useTask((delta) => {
    causticUniforms.uTime.value += delta;
  });
  $effect(() => {
    causticUniforms.uGroundY.value = userProportionsState.groundY;
  });
  $effect(() => {
    // Live-tunable via the dev Caustics slider; the toggle still hard-zeroes it.
    causticUniforms.uCausticStrength.value =
      quality.enableCaustics && oceanDebugToggles.caustics
        ? oceanDebugToggles.causticStrength
        : 0;
  });

  // ── Device-pixel-ratio cap ─────────────────────────────────────────────
  // maxPixelRatio is defined per quality tier but was never applied to the live
  // renderer — only the offline exporter capped DPR. Retina phones (DPR 2.5-3)
  // therefore rendered the full caustic/boid/particle fragment load at native
  // resolution. Cap it here and restore the prior ratio on teardown so other
  // scenes are unaffected. Re-runs when the tier (and thus maxPixelRatio) changes.
  $effect(() => {
    if (adaptiveQuality) return;
    const r = renderer;
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

{#if floraRequired}
  <FloraInstances
    {quality}
    onProgress={handleFloraProgress}
    onReady={handleFloraReady}
  />
{/if}

<OceanRuntimeSystems
  {quality}
  {performerCount}
  {stageWidth}
  {stageDepth}
  {stageZOffset}
/>
