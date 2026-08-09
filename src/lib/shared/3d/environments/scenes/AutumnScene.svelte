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
  import { onMount } from "svelte";
  import { userProportionsState } from "@austencloud/scene-3d";
  import {
    detectAutumnQuality,
    getAutumnQualityConfig,
  } from "./autumn/quality/autumn-quality";
  import { autumnQualityOverride } from "./autumn/quality/autumn-quality-override.svelte";
  import AutumnRuntimeSystems from "./autumn/runtime/AutumnRuntimeSystems.svelte";
  import { AUTUMN_POND_LAYOUT } from "./autumn/runtime/water/autumn-pond-layout";
  import { AUTUMN_MOON_DIRECTION } from "./autumn/runtime/lighting/autumn-moon";
  import { resolveAutumnShadowRole } from "./autumn/runtime/lighting/autumn-shadow-roles";
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
  }

  let { stageWidth = 6, stageDepth = 6, stageZOffset = 0 }: Props = $props();

  // ── Quality detection ─────────────────────────────────────────────────

  // `scene` and `renderer` are plain objects on the Threlte context; only
  // `camera` is a CurrentWritable. Every other scene destructures this without
  // a cast, so this one does too.
  const { scene, renderer } = useThrelte();
  const adaptiveQuality = tryGetAdaptiveQualityContext();

  const tier = $derived(
    autumnQualityOverride.tier !== "auto"
      ? autumnQualityOverride.tier
      : (adaptiveQuality?.contentTier ?? detectAutumnQuality(renderer))
  );
  const quality = $derived(getAutumnQualityConfig(tier));

  // ── Scene feature readiness ────────────────────────────────────────────

  const sceneFeatures = getSceneFeatureContext();

  const groundY = $derived(userProportionsState.groundY);

  // ── Blender-authored environment ──────────────────────────────────────

  const autumnEnvironmentGlb = useGltf("/models/autumn/autumn-environment.glb", {
    meshoptDecoder: useMeshopt(),
    ktx2Loader: useKtx2("/basis/"),
  });
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
      const role = resolveAutumnShadowRole(child.name);
      mesh.castShadow = shadowsOn && role.cast;
      mesh.receiveShadow = shadowsOn && role.receive;
    });
  });

  // ── Readiness: gate on the complete authored environment ──────────────

  let readyReported = false;

  $effect(() => {
    const loaded = Boolean($autumnEnvironmentGlb);
    const failed = Boolean($autumnEnvironmentError);
    sceneFeatures?.reportProgress("environment", loaded ? 1 : 0);
    if ((loaded || failed) && !readyReported) {
      readyReported = true;
      sceneFeatures?.reportReady("environment");
    }
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
  onMount(() => {
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
    // Shared with the key light so the brightest thing in the sky is also what
    // lights the forest. See autumn-moon.ts.
    direction: AUTUMN_MOON_DIRECTION,
    angularDiameterDegrees: 0.62,
    opacity: 0.94,
    glowScale: 1.35,
    glowOpacity: 0.055,
  };

  // Star legibility: the old field used the primitive's realistic cubic
  // magnitude falloff at 0.42-1.45 sizes, which against a near-black sky
  // produced under a dozen visible dots at any viewport. Flattening the falloff
  // and lifting the floor makes the sky read as a sky; the tighter horizon
  // spread keeps them above the tree line rather than buried in the canopy.
  const starfieldConfig: StarfieldConfig = $derived({
    enabled: true,
    count: tier === "high" ? 1600 : tier === "medium" ? 1100 : 620,
    radius: 88,
    sizeRange: [0.85, 2.6],
    twinkleSpeed: 0.34,
    intensity: 1.5,
    magnitudeFalloff: 1.5,
    brightnessFloor: 0.42,
    horizonSpread: 0.52,
  });

  // ── Fog + background (dusk violet) ─────────────────────────────────────

  $effect(() => {
    const s = scene;
    // Fog and background are deliberately DIFFERENT colours now. The fog is a
    // lighter, warmer violet than the sky, so distant geometry fades toward a
    // haze that separates it from the near-black upper sky instead of
    // dissolving into it. That is what gives the belt atmospheric perspective.
    const fogColor = new Color("#20153a");
    // The gradient dome owns the visible sky; this is its near-black fallback
    // while textures and shaders are still compiling.
    const backgroundColor = new Color("#09081d");
    // Tuned against real frames, not arithmetic. 0.016 hid nothing - the finite
    // terrain edge stayed a hard sawtooth against black. 0.034 overshot badly:
    // the review harness parks its camera ~34m out, so at that density the
    // ENTIRE scene sat under 40%+ extinction and collapsed into one milky
    // value. 0.020 puts the 31m terrain rim under ~50% while the hero trees
    // still hold their own colour.
    s.fog = new FogExp2(fogColor.getHex(), 0.02);
    s.background = backgroundColor;
    return () => {
      if (s) {
        s.fog = null;
        s.background = null;
      }
    };
  });
</script>

<SkyGradient
  topColor="#09081d"
  midColor="#38265a"
  bottomColor="#7f5b9e"
  gradientStart={0.43}
  gradientEnd={0.53}
  moon={moonConfig}
/>
<Starfield config={starfieldConfig} />

{#if $autumnEnvironmentGlb}
  <T is={$autumnEnvironmentGlb.scene} position.y={groundY} />
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
