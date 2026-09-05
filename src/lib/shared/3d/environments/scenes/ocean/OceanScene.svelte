<script lang="ts">
  import { T, useThrelte, useTask } from "@threlte/core";
  import { useGltf, useKtx2, useMeshopt } from "@threlte/extras";
  import {
    FogExp2,
    Color,
    Mesh,
    MeshStandardMaterial,
    type Scene,
    type WebGLRenderer,
  } from "three";
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
  import OceanDepthGradient from "./runtime/OceanDepthGradient.svelte";
  import { getSceneFeatureContext } from "../../../scene-features/context/scene-feature-context";
  import { getRoomEnvironmentTexture } from "../../../rendering/room-environment";
  import { tryGetAdaptiveQualityContext } from "../../../context/adaptive-quality-context";

  // RoomEnvironment is intentionally only a soft specular fill. Direct light,
  // caustics, and shadows should define the reef's form; a full-strength white
  // room reflection flattens the underwater grade.
  // Trimmed 0.08 → 0.05 with the Gate 2 key light: an omnidirectional specular
  // wash is exactly the thing that stops a keyed scene from having a dark side.
  const OCEAN_ENVIRONMENT_INTENSITY = 0.05;

  // Moody Twilight Reef depth grade. The seabed GLB is 70 m across while the
  // authored reef occupies a ~20 m radius, so at the old 0.012 the far edge of
  // the floor was only ~50% fogged and the bare sand beyond the reef stayed
  // fully legible — the "objects on a floor" read. At 0.026 the reef sits at
  // ~24% haze, the sand past it goes to ~80%, and the floor edge is gone.
  // Comparison: Winter 0.018, Autumn 0.022, Forest 0.034.
  const OCEAN_FOG_DENSITY = 0.026;

  interface Props {
    performerCount?: number;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
    /** Translation applied by the shared environment coordinate frame. */
    worldYOffset?: number;
    /** Retained film worlds load while hidden but only the active one owns globals. */
    active?: boolean;
  }

  let {
    performerCount = 1,
    stageWidth = 6,
    stageDepth = 6,
    stageZOffset = 0,
    worldYOffset = 0,
    active = true,
  }: Props = $props();

  const { scene, renderer } = useThrelte() as unknown as {
    scene: Scene;
    renderer: WebGLRenderer;
  };
  const adaptiveQuality = tryGetAdaptiveQualityContext();

  const qualityTier = $derived(
    oceanQualityOverride.tier !== "auto"
      ? oceanQualityOverride.tier
      : adaptiveQuality
        ? adaptiveQuality.contentTier === "high"
          ? "ultra"
          : adaptiveQuality.contentTier
        : detectOceanQuality(renderer)
  );
  const quality = $derived(getOceanQualityConfig(qualityTier));
  const floraRequired = $derived(quality.enableAuthoredFlora);

  const sceneFeatures = getSceneFeatureContext();

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
    if (!active) return;
    const seabed = $environmentGlb ? 1 : 0;
    const combined = seabed * SEABED_WEIGHT + floraFraction * FLORA_WEIGHT;
    sceneFeatures?.reportProgress("environment", combined);
    if ($environmentGlb && (!floraRequired || floraLoaded)) {
      sceneFeatures?.reportReady("environment");
    }
  });

  $effect(() => {
    if (!active) return;
    const s = scene;
    // Deep blue-teal so distance dissolves into water, not a dead-black void
    // (was #0d0d10). Pairs with the absorption depth-grade in ScenePostProcessing.
    const fogColor = new Color("#0a2438");
    // Keep the backdrop colour always; the dev `fog` toggle only removes the
    // distance haze veil so a reviewer can see how much of the washout it owns.
    const fog = oceanDebugToggles.fog
      ? new FogExp2(fogColor.getHex(), OCEAN_FOG_DENSITY)
      : null;
    s.background = fogColor;
    s.fog = fog;
    return () => {
      if (s) {
        if (s.fog === fog) s.fog = null;
        if (s.background === fogColor) s.background = null;
      }
    };
  });

  // Keep one scene-level intensity so the seabed and authored reef receive the
  // same low-energy wet/specular fill. Per-material values stay neutral (1.0).
  $effect(() => {
    if (!active) return;
    const r = renderer;
    const s = scene;
    const previousIntensity = s.environmentIntensity;
    // Dev `ibl` toggle — drop the env entirely to A/B how much the reflective
    // wash owns the washed-out read.
    if (!quality.enableImageBasedLighting || !oceanDebugToggles.ibl) {
      s.environment = null;
      s.environmentIntensity = previousIntensity;
      return () => {
        s.environmentIntensity = previousIntensity;
      };
    }
    const envTex = getRoomEnvironmentTexture(r);
    s.environment = envTex;
    s.environmentIntensity = OCEAN_ENVIRONMENT_INTENSITY;
    return () => {
      if (s.environment === envTex) s.environment = null;
      s.environmentIntensity = previousIntensity;
    };
  });

  // The floor receives the hero structures' shadows but does not spend a draw
  // casting underneath itself. Its neutral envMapIntensity lets the scene-level
  // underwater IBL control match the authored reef exactly.
  $effect(() => {
    const g = $environmentGlb;
    if (!g) return;
    g.scene.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.castShadow = false;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (mat instanceof MeshStandardMaterial) {
          mat.envMapIntensity = 1;
          if (quality.enableCaustics) patchCausticsMaterial(mat);
        }
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
    causticUniforms.uGroundY.value =
      userProportionsState.groundY + worldYOffset;
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
    if (!active || adaptiveQuality) return;
    const r = renderer;
    const prev = r.getPixelRatio();
    r.setPixelRatio(Math.min(window.devicePixelRatio, quality.maxPixelRatio));
    return () => {
      r.setPixelRatio(prev);
    };
  });
</script>

{#if $environmentGlb}
  <T is={$environmentGlb.scene} dispose={false} />
{/if}

{#if floraRequired}
  <FloraInstances
    {quality}
    {worldYOffset}
    onProgress={handleFloraProgress}
    onReady={handleFloraReady}
  />
{/if}

<!--
  Rendered first for reading order only. Draw order is owned by renderOrder=-1
  on the mesh itself, and depthTest:false means it always loses to real
  geometry — so it shows only through gaps, which is what silhouettes the
  shelf lip against the abyss.
-->
<OceanDepthGradient />

<OceanRuntimeSystems
  {quality}
  {performerCount}
  {stageWidth}
  {stageDepth}
  {stageZOffset}
  {worldYOffset}
/>
