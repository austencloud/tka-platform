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
  } as const;

  type ViewName = keyof typeof VIEW_PRESETS;
  const requestedView = $derived(page.url.searchParams.get("view"));
  const view = $derived(
    requestedView && requestedView in VIEW_PRESETS
      ? (requestedView as ViewName)
      : "hero"
  );
  const cameraPreset = $derived(VIEW_PRESETS[view]);
</script>

<svelte:head>
  <title>Autumn Scene — verification harness</title>
</svelte:head>

<div class="page">
  <Canvas
    createRenderer={(canvas) =>
      new WebGLRenderer({ canvas, preserveDrawingBuffer: true })}
  >
    <!-- Match the real viewer's ScenePostProcessing tone mapping (AgX, 1.0)
         so colors read the same here as in the sequence viewer. -->
    <HarnessToneMapping />

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
