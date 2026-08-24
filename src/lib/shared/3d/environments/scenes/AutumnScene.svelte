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
  import type {
    MoonConfig,
    StarfieldConfig,
  } from "../domain/models/scene-configs";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import { tryGetAdaptiveQualityContext } from "../../context/adaptive-quality-context";
  import type { Mesh } from "three";

  // ── Props (match what Environment3D passes) ───────────────────────────

  interface Props {
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
    /** Retained film worlds load while hidden but only the active one owns globals. */
    active?: boolean;
  }

  let {
    stageWidth = 6,
    stageDepth = 6,
    stageZOffset = 0,
    active = true,
  }: Props = $props();

  // ── Quality detection ─────────────────────────────────────────────────

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

  // ── Scene feature readiness ────────────────────────────────────────────

  const sceneFeatures = getSceneFeatureContext();

  const groundY = $derived(userProportionsState.groundY);

  // ── Blender-authored environment ──────────────────────────────────────

  const autumnEnvironmentGlb = useGltf(
    "/models/autumn/autumn-environment.glb",
    {
      meshoptDecoder: useMeshopt(),
      ktx2Loader: useKtx2("/basis/"),
    }
  );
  const environmentScene = $derived($autumnEnvironmentGlb?.scene ?? null);

  // asyncWritable exposes the rejection as its own store, so a 404 or a decode
  // failure is observable instead of silently leaving the world empty.
  const autumnEnvironmentError = autumnEnvironmentGlb.error;

  const pondCenter: [number, number, number] = $derived([
    AUTUMN_POND_LAYOUT.centerX,
    groundY,
    AUTUMN_POND_LAYOUT.centerZ,
  ]);

  // ── Shadow participation ───────────────────────────────────────────────
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

  // ── Readiness: gate on the complete authored environment ──────────────

  $effect(() => {
    if (!active) return;
    const loaded = Boolean($autumnEnvironmentGlb);
    const failed = Boolean($autumnEnvironmentError);
    sceneFeatures?.reportProgress("environment", loaded ? 1 : 0);
    if (loaded || failed) sceneFeatures?.reportReady("environment");
  });

  $effect(() => {
    const failure = $autumnEnvironmentError;
    if (!failure) return;
    // The curtain lifts immediately rather than after the 15s stall, and the
    // scene falls back to sky, stars, moon and stage so the performer is still
    // usable on a bare ground plane instead of floating in an empty void.
    console.error(
      "[AutumnScene] environment GLB failed to load; showing degraded scene",
      failure
    );
  });

  // Safety valve: if the GLB stalls without ever rejecting, lift the curtain
  // after 15s so the user is never stuck on a permanent loading screen.
  $effect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      if (sceneFeatures && !sceneFeatures.isReady("environment")) {
        console.warn("[AutumnScene] loading timed out - lifting curtain");
        sceneFeatures.reportReady("environment");
      }
    }, 15_000);
    return () => clearTimeout(timer);
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
    enabled: true,
    count: tier === "high" ? 720 : tier === "medium" ? 520 : 320,
    radius: 88,
    sizeRange: [1.0, 3.0],
    twinkleSpeed: 0.34,
    intensity: 2.0,
    magnitudeFalloff: 1.25,
    brightnessFloor: 0.6,
    horizonSpread: 0.52,
    elevationRangeDegrees: [-8, 12],
  });

  // ── Fog + background (dusk violet) ─────────────────────────────────────

  $effect(() => {
    if (!active) return;
    const s = scene.current;
    if (!s) return;
    // Fog and background are deliberately DIFFERENT colours now. The fog is a
    // lighter, warmer violet than the sky, so distant geometry fades toward a
    // haze that separates it from the near-black upper sky instead of
    // dissolving into it. That is what gives the belt atmospheric perspective.
    // A warm plum haze belongs to the leaf-and-bark palette while retaining
    // enough blue to read as moonlit air. The previous violet pushed pale bark
    // and distant crowns toward silver, making the imported depth belt look
    // like a separate winter biome.
    const fogColor = new Color("#2b172f");
    // The gradient dome owns the visible sky; this is its near-black fallback
    // while textures and shaders are still compiling.
    const backgroundColor = new Color("#120b2b");
    // The terrain now owns a stitched 165m fog apron, so haze no longer has to
    // conceal a finite edge. At 0.020 the 54m cabin lane lost so much contrast
    // that its authored surface vanished halfway to the shack. 0.016 keeps
    // atmospheric separation across the tree belts while preserving the full
    // lived-in sightline from the stage clearing to the cabin door.
    const fog = new FogExp2(fogColor.getHex(), 0.016);
    s.fog = fog;
    s.background = backgroundColor;
    return () => {
      if (s.fog === fog) s.fog = null;
      if (s.background === backgroundColor) s.background = null;
    };
  });
</script>

<SkyGradient
  topColor="#120b2b"
  midColor="#38265a"
  bottomColor="#7f5b9e"
  gradientStart={0.43}
  gradientEnd={0.53}
  moon={moonConfig}
/>
<Starfield config={starfieldConfig} />

{#if $autumnEnvironmentGlb}
  <T is={$autumnEnvironmentGlb.scene} position.y={groundY} dispose={false} />
{/if}

<!-- The same canonical stage used by the forest scene anchors the performer,
     covers the most repetitive central floor, and restores directional cues.
     It is mounted unconditionally so a failed environment load still leaves a
     usable surface under the performer rather than an empty world. -->
<Stage3D width={stageWidth} depth={stageDepth} overrideGroundY={groundY} />

{#key tier}
  <AutumnRuntimeSystems
    {quality}
    {tier}
    {environmentScene}
    {groundY}
    {pondCenter}
  />
{/key}
