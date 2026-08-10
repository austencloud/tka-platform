<script lang="ts">
  /**
   * /test/autumn-scene
   *
   * Live verification harness for the Enchanted Autumn Dusk scene rebuild
   * (the "Ocean way"). Mounts the real 3D environment switcher
   * (Environment3D → AutumnScene) inside a Threlte <Canvas> with the same
   * renderer config + scene-feature context the real viewer uses, plus the
   * shared fixed-shot and first-person review camera.
   *
   * This keeps working as AutumnScene evolves in later tasks: it routes through
   * Environment3D rather than importing AutumnScene directly, and tolerates the
   * scene still carrying legacy content. Disposable dev-only route.
   */
  import { Canvas } from "@threlte/core";
  import { page } from "$app/state";
  import { WebGLRenderer } from "three";
  import { BackgroundType } from "@austencloud/backgrounds";

  import Environment3D from "$lib/shared/3d/environments/components/Environment3D.svelte";
  import EnvironmentReviewCamera from "$lib/shared/3d/environments/review/EnvironmentReviewCamera.svelte";
  import { createSceneFeatureState } from "$lib/shared/3d/scene-features/state/scene-feature-state.svelte";
  import { setSceneFeatureContext } from "$lib/shared/3d/scene-features/context/scene-feature-context";
  import { createEnvironmentTransitionVisualState } from "$lib/shared/3d/environments/state/environment-transition-visual-state.svelte";
  import { setEnvironmentTransitionVisualContext } from "$lib/shared/3d/environments/context/environment-transition-visual-context";
  import HarnessToneMapping from "./HarnessToneMapping.svelte";
  import PerfMonitor from "$lib/shared/3d/components/PerfMonitor.svelte";
  import { autumnQualityOverride } from "$lib/shared/3d/environments/scenes/autumn/quality/autumn-quality-override.svelte";
  import type { AutumnQualityTier } from "$lib/shared/3d/environments/scenes/autumn/quality/autumn-quality";

  // The Autumn scene calls getSceneFeatureContext() (for reportReady +
  // stage gating). Provide the same state factory the real Viewer3DCanvas
  // uses so the context resolves and the scene doesn't throw.
  const sceneFeatureState = createSceneFeatureState();
  setSceneFeatureContext(sceneFeatureState);

  // Environment3D now coordinates readiness with the full viewer's transition
  // veil. The harness has no veil, so provide an always-ready visual host.
  const transitionVisual = createEnvironmentTransitionVisualState();
  transitionVisual.setRendererReady(true);
  setEnvironmentTransitionVisualContext(transitionVisual);

  const VIEW_PRESETS = {
    hero: {
      position: [0, 14, 32],
      target: [0, 1, 3],
      fov: 48,
    },
    walk: {
      position: [0, 2.1, 9],
      target: [0, 1.3, 0],
      fov: 58,
    },
    world: {
      position: [0, 48, 36],
      target: [0, 2, 0],
      fov: 52,
    },
    depth: {
      position: [0, 9, 29],
      target: [0, 2, -42],
      fov: 46,
    },
    settlement: {
      position: [1, 7, 16],
      target: [-5, 1, -32],
      fov: 48,
    },
    shack: {
      position: [-10, 4, -40],
      target: [-10, 1.5, -56],
      fov: 50,
    },
    fungi: {
      position: [4, 2.1, -7.2],
      target: [4, 0.08, -12],
      fov: 46,
    },
    ferns: {
      position: [-15.6, 1.65, 1.2],
      target: [-15.6, 0.35, -3.5],
      fov: 46,
    },
    rootContact: {
      position: [-3, 2.4, 7.5],
      target: [-12.8, 0.7, -6.5],
      fov: 52,
    },
    owlRootContact: {
      position: [0, 2.4, -2],
      target: [6.2, 0.7, -18.3],
      fov: 52,
    },
  } as const;

  type ViewName = keyof typeof VIEW_PRESETS;
  const requestedView = $derived(page.url.searchParams.get("view"));
  const view = $derived(
    requestedView && requestedView in VIEW_PRESETS
      ? (requestedView as ViewName)
      : "hero"
  );
  const cameraPreset = $derived(VIEW_PRESETS[view]);
  const showPerf = $derived(page.url.searchParams.get("perf") === "1");
  const renderDpr = $derived.by(() => {
    const requested = Number(page.url.searchParams.get("dpr") ?? "1");
    return Number.isFinite(requested)
      ? Math.min(3, Math.max(0.5, requested))
      : 1;
  });
  const requestedQuality = $derived.by<AutumnQualityTier | "auto">(() => {
    const requested = page.url.searchParams.get("quality");
    return requested === "low" || requested === "medium" || requested === "high"
      ? requested
      : "auto";
  });

  $effect(() => {
    autumnQualityOverride.tier = requestedQuality;
    return () => {
      autumnQualityOverride.tier = "auto";
    };
  });
</script>

<svelte:head>
  <title>Autumn Scene — verification harness</title>
</svelte:head>

<div class="page">
  <Canvas
    dpr={renderDpr}
    createRenderer={(canvas) =>
      new WebGLRenderer({ canvas, preserveDrawingBuffer: true })}
  >
    <!-- Match the real viewer's ScenePostProcessing tone mapping (AgX, 1.0)
         so colors read the same here as in the sequence viewer. -->
    <HarnessToneMapping />
    <PerfMonitor visible={showPerf} active={showPerf} />

    {#key view}
      <EnvironmentReviewCamera
        destinationId="autumn-scene-review"
        preset={cameraPreset}
        walk={view === "walk"}
      />
    {/key}

    <!-- Real environment switcher. AUTUMN routes to AutumnScene, which
         supplies its own sky, ground, fog, trees, leaves and lighting. -->
    <Environment3D
      backgroundType={BackgroundType.AUTUMN}
      performerCount={1}
      stageWidth={6}
      stageDepth={6}
      stageZOffset={0}
    />
  </Canvas>
</div>

<style>
  .page {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    /* Warm dusk gradient backs the transparent canvas while the scene's
       own sky dome paints in. */
    background: linear-gradient(#1a1206 0%, #3a2410 60%, #5a3a1c 100%);
  }
</style>
