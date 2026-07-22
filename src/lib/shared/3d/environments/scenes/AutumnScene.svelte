<script lang="ts">
  /**
   * AutumnScene — Enchanted Autumn Dusk
   *
   * Orchestrator for the rebuilt autumn environment, mirroring
   * ocean/OceanScene.svelte. It loads the Meshy hero GLBs (terrain shell, two
   * hero trees, a mushroom grove), sets the dusk fog + background, detects
   * device quality, mounts the authored flora and the runtime composer, and
   * reports scene-feature readiness through the loading curtain.
   *
   * The Meshy hero GLBs may not exist yet (their generation is gated on the
   * user). The scene MUST render flora + runtime without them, so every hero is
   * mounted behind an `{#if $glb}` guard and readiness is based on FLORA, not
   * the heroes. A 15s safety valve (copied from ForestScene) lifts the curtain
   * even if everything stalls — the curtain can never hang.
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
  import AutumnFlora from "./autumn/authored/AutumnFlora.svelte";
  import AutumnRuntimeSystems from "./autumn/runtime/AutumnRuntimeSystems.svelte";
  import type { PulseTarget } from "./autumn/runtime/interaction/AutumnInteraction.svelte";
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
      : (adaptiveQuality?.tier ?? detectAutumnQuality(renderer))
  );
  const quality = $derived(getAutumnQualityConfig(tier));

  // ── Scene feature readiness ────────────────────────────────────────────

  const sceneFeatures = getSceneFeatureContext();

  const groundY = $derived(userProportionsState.groundY);

  // ── Hero GLBs (Meshy — best-effort; may 404 until generation runs) ─────

  const terrainGlb = useGltf("/models/autumn/terrain-shell.glb", {
    meshoptDecoder: useMeshopt(),
    ktx2Loader: useKtx2("/basis/"),
  });
  const heroTreeA = useGltf("/models/autumn/hero-tree-a.glb", {
    meshoptDecoder: useMeshopt(),
    ktx2Loader: useKtx2("/basis/"),
  });
  const heroTreeB = useGltf("/models/autumn/hero-tree-b.glb", {
    meshoptDecoder: useMeshopt(),
    ktx2Loader: useKtx2("/basis/"),
  });
  const mushroomGroveGlb = useGltf("/models/autumn/mushroom-grove.glb", {
    meshoptDecoder: useMeshopt(),
    ktx2Loader: useKtx2("/basis/"),
  });

  // Hand-picked hero spots: terrain + grove at the clearing origin, the two
  // hero trees flanking it.
  const pondCenter: [number, number, number] = $derived([-6, groundY, 5]);

  // ── Readiness: gate on FLORA, not the optional heroes ──────────────────
  // Hero GLBs are best-effort (may be absent), so they cannot gate the curtain.
  // Flora reports real loaded/total progress and fires ready when complete;
  // we fold flora's fraction straight into the environment progress bar.

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
    sceneFeatures?.reportProgress("environment", floraFraction);
    if (floraLoaded) {
      sceneFeatures?.reportReady("environment");
    }
  });

  // Safety valve: if flora (or anything) stalls, lift the curtain after 15s so
  // the user is never stuck on a permanent loading screen — even with the hero
  // GLBs absent. Copied from ForestScene.
  onMount(() => {
    const timer = setTimeout(() => {
      if (sceneFeatures && !sceneFeatures.isReady("environment")) {
        console.warn("[AutumnScene] loading timed out - lifting curtain");
        sceneFeatures.reportReady("environment");
      }
    }, 15_000);
    return () => clearTimeout(timer);
  });

  // ── Mushroom pulse targets (assembled from AutumnFlora) ────────────────

  let mushroomTargets = $state<PulseTarget[]>([]);

  // ── Grove glow: teal emissive override on the Meshy grove caps ─────────
  // The Meshy texture is realistic, not self-lit; the scene's bioluminescent
  // look comes from a runtime emissive override (same idea AutumnFlora uses on
  // the kit mushrooms). Applied once when the grove GLB lands. Mutates in place
  // — the grove GLB has a single consumer (this orchestrator), so no leak risk.
  let groveGlowApplied = false;
  $effect(() => {
    const glb = $mushroomGroveGlb;
    if (!glb || groveGlowApplied) return;
    groveGlowApplied = true;
    glb.scene.traverse((o) => {
      const m = o as unknown as { isMesh?: boolean; material?: unknown };
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const sm = mat as {
          emissive?: Color;
          emissiveIntensity?: number;
          needsUpdate?: boolean;
        };
        if (sm.emissive) {
          sm.emissive.set("#00c8b4");
          sm.emissiveIntensity = 0.45;
          sm.needsUpdate = true;
        }
      }
    });
  });

  // ── Fog + background (dusk violet) ─────────────────────────────────────

  $effect(() => {
    const s = scene;
    const fogColor = new Color("#2a1838");
    s.fog = new FogExp2(fogColor.getHex(), 0.02);
    s.background = fogColor;
    return () => {
      if (s) {
        s.fog = null;
        s.background = null;
      }
    };
  });
</script>

{#if $terrainGlb}
  <T is={$terrainGlb.scene} position.y={groundY} />
{/if}

{#if $mushroomGroveGlb}
  <T is={$mushroomGroveGlb.scene} position.y={groundY} scale={3} />
{/if}

{#if $heroTreeA}
  <T
    is={$heroTreeA.scene}
    position.x={-9}
    position.y={groundY}
    position.z={-4}
  />
{/if}

{#if $heroTreeB}
  <T
    is={$heroTreeB.scene}
    position.x={10}
    position.y={groundY}
    position.z={-6}
  />
{/if}

{#key tier}
  <AutumnFlora
    {quality}
    {groundY}
    onProgress={handleFloraProgress}
    onReady={handleFloraReady}
    onMushroomTargets={(t) =>
      (mushroomTargets = t.map((x) => ({
        material: x.material,
        position: x.position,
        baseIntensity: x.material.emissiveIntensity,
      })))}
  />

  <AutumnRuntimeSystems
    {quality}
    {groundY}
    {performerCount}
    {stageWidth}
    {stageDepth}
    {stageZOffset}
    {pondCenter}
    {mushroomTargets}
  />
{/key}
