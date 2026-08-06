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
  import { FogExp2, Color, type Scene, type WebGLRenderer } from "three";
  import { onMount } from "svelte";
  import { userProportionsState } from "@austencloud/scene-3d";
  import {
    detectAutumnQuality,
    getAutumnQualityConfig,
  } from "./autumn/quality/autumn-quality";
  import { autumnQualityOverride } from "./autumn/quality/autumn-quality-override.svelte";
  import AutumnRuntimeSystems from "./autumn/runtime/AutumnRuntimeSystems.svelte";
  import { AUTUMN_POND_LAYOUT } from "./autumn/runtime/water/autumn-pond-layout";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import MoonBillboard from "../primitives/MoonBillboard.svelte";
  import Starfield from "../primitives/Starfield.svelte";
  import Stage3D from "../../components/Stage3D.svelte";
  import type {
    MoonConfig,
    StarfieldConfig,
  } from "../domain/models/scene-configs";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import { tryGetAdaptiveQualityContext } from "../../context/adaptive-quality-context";

  // ── Props (match what Environment3D passes) ───────────────────────────

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

  const autumnEnvironmentGlb = useGltf(
    "/models/autumn/autumn-environment.glb",
    {
      meshoptDecoder: useMeshopt(),
      ktx2Loader: useKtx2("/basis/"),
    }
  );
  const environmentScene = $derived($autumnEnvironmentGlb?.scene ?? null);

  const pondCenter: [number, number, number] = $derived([
    AUTUMN_POND_LAYOUT.centerX,
    groundY,
    AUTUMN_POND_LAYOUT.centerZ,
  ]);

  // ── Readiness: gate on the complete authored environment ──────────────

  let readyReported = false;

  $effect(() => {
    const loaded = Boolean($autumnEnvironmentGlb);
    sceneFeatures?.reportProgress("environment", loaded ? 1 : 0);
    if (loaded && !readyReported) {
      readyReported = true;
      sceneFeatures?.reportReady("environment");
    }
  });

  // Safety valve: if the GLB stalls, lift the curtain after 15s so the user is
  // never stuck on a permanent loading screen. Copied from ForestScene.
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
    position: [-5, 19, -56],
    diameter: 6.2,
    opacity: 0.88,
    glowScale: 1.18,
    glowOpacity: 0.032,
  };

  const starfieldConfig: StarfieldConfig = $derived({
    enabled: true,
    count: tier === "high" ? 1200 : tier === "medium" ? 820 : 480,
    radius: 88,
    sizeRange: [0.42, 1.45],
    twinkleSpeed: 0.34,
  });

  // ── Fog + background (dusk violet) ─────────────────────────────────────

  $effect(() => {
    const s = scene;
    const fogColor = new Color("#1a1028");
    // The varied rear belt now sits close enough to read as individual trees.
    // This veil still hides the finite terrain edge without flattening those
    // silhouettes into the night background.
    s.fog = new FogExp2(fogColor.getHex(), 0.016);
    s.background = fogColor;
    return () => {
      if (s) {
        s.fog = null;
        s.background = null;
      }
    };
  });
</script>

<SkyGradient topColor="#09081d" midColor="#321b3f" bottomColor="#9a4931" />
<Starfield config={starfieldConfig} />
<MoonBillboard config={moonConfig} />

{#if $autumnEnvironmentGlb}
  <T is={$autumnEnvironmentGlb.scene} position.y={groundY} />
{/if}

<!-- The same canonical stage used by the forest scene anchors the performer,
     covers the most repetitive central floor, and restores directional cues. -->
<Stage3D width={stageWidth} depth={stageDepth} overrideGroundY={groundY} />

{#key tier}
  <AutumnRuntimeSystems
    {quality}
    {tier}
    {environmentScene}
    {groundY}
    {performerCount}
    {stageWidth}
    {stageDepth}
    {stageZOffset}
    {pondCenter}
  />
{/key}
