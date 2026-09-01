<script lang="ts">
  /**
   * AutumnScene — Enchanted Autumn Dusk
   *
   * Orchestrator for the Blender-authored autumn environment. It loads the
   * sculpted terrain, Meshy hero trees and set dressing as one optimized GLB,
   * mounts the runtime systems, and reports real asset readiness through the
   * loading curtain.
   */

  import { T, useThrelte } from "@threlte/core";
  import { useGltf, useKtx2, useMeshopt } from "@threlte/extras";
  import { FogExp2, Color } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { getAutumnQualityConfig } from "./autumn/quality/autumn-quality";
  import { autumnQualityOverride } from "./autumn/quality/autumn-quality-override.svelte";
  import AutumnRuntimeSystems from "./autumn/runtime/AutumnRuntimeSystems.svelte";
  import { AUTUMN_POND_LAYOUT } from "./autumn/runtime/water/autumn-pond-layout";
  import { AUTUMN_MOON_VISUAL_DIRECTION } from "./autumn/runtime/lighting/autumn-moon";
  import { configureAutumnShadowMesh } from "./autumn/runtime/lighting/autumn-shadow-roles";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import Starfield from "../primitives/Starfield.svelte";
  import Stage3D from "../../components/Stage3D.svelte";
  import {
    createDefaultAutumnConfig,
    type AutumnSceneConfig,
  } from "../domain/models/scene-configs/autumn-scene-config";
  import type {
    MoonConfig,
    StarfieldConfig,
  } from "../domain/models/scene-configs/cosmic-scene-config";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import { tryGetAdaptiveQualityContext } from "../../context/adaptive-quality-context";
  import {
    applyAutumnGeometryTier,
    restoreAutumnGeometryTier,
  } from "./autumn/quality/autumn-geometry-tier";
  import {
    createAutumnBootState,
    getAutumnBootProgress,
    isAutumnBootReady,
    setAutumnBootAsset,
    type AutumnBootAsset,
    type AutumnBootStatus,
  } from "./autumn/runtime/autumn-boot-state";
  import { startAutumnEnvironmentRequest } from "./autumn/runtime/autumn-environment-request";
  import type { Mesh } from "three";

  // ── Props (match what Environment3D passes) ───────────────────────────

  interface Props {
    config?: AutumnSceneConfig;
    performerPositions?: readonly { x: number; z: number }[];
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
    /** Forwarded to the deck: practice orientation markings on or off. */
    showDirectionCues?: boolean;
    /** Retained film worlds load while hidden but only the active one owns globals. */
    active?: boolean;
  }

  let {
    config,
    performerPositions = [],
    stageWidth = 6,
    stageDepth = 6,
    stageZOffset = 0,
    active = true,
    showDirectionCues = true,
  }: Props = $props();

  const defaultConfig = createDefaultAutumnConfig();
  const sceneConfig = $derived(config ?? defaultConfig);

  // The shared viewer owns capability detection and live frame-pressure
  // adaptation. A standalone preview without that context starts at medium,
  // which is the same safe server/test fallback the viewer uses.
  const { scene } = useThrelte();
  const adaptiveQuality = tryGetAdaptiveQualityContext();

  const tier = $derived(
    autumnQualityOverride.tier !== "auto"
      ? autumnQualityOverride.tier
      : (adaptiveQuality?.tier ?? "medium")
  );
  const quality = $derived(getAutumnQualityConfig(tier));

  const sceneFeatures = getSceneFeatureContext();

  const groundY = $derived(userProportionsState.groundY);

  const autumnEnvironmentLoader = useGltf({
    meshoptDecoder: useMeshopt(),
    ktx2Loader: useKtx2("/basis/"),
  });
  type AutumnEnvironmentGltf = Awaited<
    ReturnType<typeof autumnEnvironmentLoader.load>
  >;
  let autumnEnvironmentGlb = $state<AutumnEnvironmentGltf | null>(null);
  let bootState = $state(createAutumnBootState());
  let environmentFailure = $state<unknown>(null);
  let environmentFailureMessage = $state(
    "Autumn couldn't load. Retry the environment."
  );
  const retryRequest = $derived(
    sceneFeatures?.getRetryRequest("environment") ?? 0
  );
  const environmentScene = $derived(autumnEnvironmentGlb?.scene ?? null);

  // A retry gets a distinct loader-cache identity. The request owner ignores
  // every late completion after cancellation or the timeout boundary.
  $effect(() => {
    const retry = retryRequest;
    autumnEnvironmentGlb = null;
    environmentFailure = null;
    environmentFailureMessage = "Autumn couldn't load. Retry the environment.";
    bootState = createAutumnBootState();

    return startAutumnEnvironmentRequest({
      retryRequest: retry,
      load: (url) => autumnEnvironmentLoader.load(url),
      onReady: (loaded) => {
        autumnEnvironmentGlb = loaded;
        bootState = setAutumnBootAsset(bootState, "environment", "ready");
      },
      onFailure: (failure) => {
        environmentFailure = failure.error ?? new Error(failure.message);
        environmentFailureMessage = failure.message;
        bootState = setAutumnBootAsset(bootState, "environment", "failed");
      },
    });
  });

  function reportRuntimeAsset(
    asset: Exclude<AutumnBootAsset, "environment">,
    status: AutumnBootStatus
  ): void {
    bootState = setAutumnBootAsset(bootState, asset, status);
  }

  const pondCenter: [number, number, number] = $derived([
    AUTUMN_POND_LAYOUT.centerX,
    groundY,
    AUTUMN_POND_LAYOUT.centerZ,
  ]);

  //
  // Loaded GLB meshes default to neither casting nor receiving. Roles are
  // assigned by authored name so the depth pass stays bounded to geometry that
  // can actually darken a visible pixel.

  $effect(() => {
    const loaded = environmentScene;
    const shadowsOn = quality.shadows;
    if (!loaded) return;

    loaded.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      configureAutumnShadowMesh(mesh, shadowsOn);
    });
  });

  // Instance budgets alter only the submitted count of Blender-authored GPU
  // batches. Pond resources, material patches, and particle systems stay put
  // when adaptive quality moves between tiers.
  $effect(() => {
    const loaded = environmentScene;
    const activeTier = tier;
    if (!loaded) return;
    const report = applyAutumnGeometryTier(loaded, activeTier);
    loaded.userData.autumnGeometryTierReport = report;
    return () => {
      delete loaded.userData.autumnGeometryTierReport;
      restoreAutumnGeometryTier(loaded);
    };
  });

  // ── Readiness: gate on the complete authored environment ──────────────

  $effect(() => {
    if (!active) return;
    const state = bootState;
    sceneFeatures?.reportProgress("environment", getAutumnBootProgress(state));
    if (state.environment === "failed") {
      sceneFeatures?.reportFailed("environment", environmentFailureMessage);
      return;
    }
    if (isAutumnBootReady(state)) {
      sceneFeatures?.reportReady("environment");
    }
  });

  $effect(() => {
    const failure = environmentFailure;
    if (!failure) return;
    console.error("[AutumnScene] environment GLB failed to load", failure);
  });

  const moonConfig: MoonConfig = {
    enabled: true,
    texture: "/textures/moon.png",
    direction: AUTUMN_MOON_VISUAL_DIRECTION,
    angularDiameterDegrees: 2.8,
    opacity: 0.96,
    glowScale: 1.52,
    glowOpacity: 0.075,
    surfaceLift: 0.34,
    horizonWarmth: 0.25,
  };

  // Star legibility: the old field used the primitive's realistic cubic
  // magnitude falloff at 0.42-1.45 sizes, which against a near-black sky
  // produced under a dozen visible dots at any viewport. Flattening the falloff
  // and lifting the floor makes the sky read as a sky; the tighter horizon
  // spread keeps them above the tree line rather than buried in the canopy.
  const starfieldConfig: StarfieldConfig = $derived({
    enabled: sceneConfig.stars.enabled,
    count: Math.round(
      (tier === "high" ? 720 : tier === "medium" ? 520 : 320) *
        sceneConfig.stars.countScale
    ),
    radius: 88,
    sizeRange: [
      0.45 * sceneConfig.stars.sizeScale,
      1.35 * sceneConfig.stars.sizeScale,
    ],
    twinkleSpeed: 0.34,
    intensity: sceneConfig.stars.intensity,
    magnitudeFalloff: 1.8,
    brightnessFloor: 0.24,
    horizonSpread: 0.52,
    elevationRangeDegrees: [4, 24],
  });

  // ── Fog + background (dusk violet) ─────────────────────────────────────

  $effect(() => {
    if (!active) return;
    const s = scene;
    // Fog and background are deliberately DIFFERENT colours now. The fog is a
    // lighter, warmer violet than the sky, so distant geometry fades toward a
    // haze that separates it from the near-black upper sky instead of
    // dissolving into it. That is what gives the belt atmospheric perspective.
    // A warm plum haze belongs to the leaf-and-bark palette while retaining
    // enough blue to read as moonlit air. The previous violet pushed pale bark
    // and distant crowns toward silver, making the imported depth belt look
    // like a separate winter biome.
    const fogColor = new Color(sceneConfig.fog.color);
    // The gradient dome owns the visible sky; this is its near-black fallback
    // while textures and shaders are still compiling.
    const backgroundColor = new Color("#120b2b");
    // The terrain now owns a stitched 165m fog apron, so haze no longer has to
    // conceal a finite edge. At 0.020 the 54m cabin lane lost so much contrast
    // that its authored surface vanished halfway to the shack. 0.016 keeps
    // atmospheric separation across the tree belts while preserving the full
    // lived-in sightline from the stage clearing to the cabin door.
    const fog = new FogExp2(fogColor.getHex(), sceneConfig.fog.density);
    s.fog = fog;
    s.background = backgroundColor;
    return () => {
      if (s.fog === fog) s.fog = null;
      if (s.background === backgroundColor) s.background = null;
    };
  });
</script>

<SkyGradient
  topColor={sceneConfig.sky.topColor}
  midColor={sceneConfig.sky.midColor}
  bottomColor={sceneConfig.sky.bottomColor}
  gradientStart={0.43}
  gradientEnd={0.53}
  moon={moonConfig}
/>
<Starfield config={starfieldConfig} />

{#if autumnEnvironmentGlb}
  <T is={autumnEnvironmentGlb.scene} position.y={groundY} dispose={false} />
{/if}

<!-- The same canonical stage used by the forest scene anchors the performer,
     covers the most repetitive central floor, and restores directional cues.
     It is mounted unconditionally so a failed environment load still leaves a
     usable surface under the performer rather than an empty world. -->
<T.Group position.z={stageZOffset}>
  <Stage3D
    width={stageWidth}
    depth={stageDepth}
    overrideGroundY={groundY}
    {showDirectionCues}
    appearance="autumn"
  />
</T.Group>

<AutumnRuntimeSystems
  {quality}
  {tier}
  {active}
  {performerPositions}
  {retryRequest}
  {environmentScene}
  {groundY}
  {pondCenter}
  groundDetailStrength={sceneConfig.groundDetailStrength}
  magicIntensity={sceneConfig.magicIntensity}
  onAssetStatus={reportRuntimeAsset}
/>
