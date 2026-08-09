<script lang="ts">
  /**
   * Live verification harness for the Moody Twilight Reef ocean.
   *
   * Sibling of the winter-scene / forest-scene / autumn-scene harnesses. Exists
   * because Scene Lab (`/lab/themes`) is `adminOnly`, so it bounces to the
   * default module for any session without an admin account — including every
   * agent browser. The `ocean-probe` and `ocean-visual-ab` routes are the 2D
   * canvas background and share nothing with this scene.
   *
   * Presets are chosen to answer the Gate 2 lighting questions specifically:
   * `stage` frames the dais tightly enough to judge the key light's pool
   * against its falloff, and `shaft` looks up the hero god-ray column toward
   * the water plane.
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
  import { clampPresetBelowWater } from "$lib/shared/3d/environments/scenes/ocean/ocean-camera-bounds";

  const sceneFeatureState = createSceneFeatureState();
  setSceneFeatureContext(sceneFeatureState);
  const transitionVisual = createEnvironmentTransitionVisualState();
  transitionVisual.setRendererReady(true);
  setEnvironmentTransitionVisualContext(transitionVisual);

  // The performer's shoulder is world y=0 and the seabed is groundY = -1.5, so
  // the stage deck top sits at y = +1.0 and the water plane at y = +10.5.
  const VIEW_PRESETS = {
    hero: {
      position: [0, 4.5, 19],
      target: [0, 1.6, -2],
      fov: 46,
    },
    stage: {
      position: [0, 4.2, 9],
      target: [0, 1, 0],
      fov: 44,
    },
    shaft: {
      position: [0, 1.8, 13],
      target: [0, 8.5, -1],
      fov: 62,
    },
    reef: {
      position: [-11, 3.6, 12],
      target: [4, 1.8, -6],
      fov: 48,
    },
    reverse: {
      position: [0, 5.5, -21],
      target: [0, 1.6, 0],
      fov: 48,
    },
    walk: {
      position: [0, 0.3, 8],
      target: [0, 0.4, 0],
      fov: 58,
    },
    world: {
      position: [0, 26, 30],
      target: [0, 0, 0],
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
  // The ocean has no sky and no surface break, so a camera above the water
  // plane looks up into space that was never authored. `?clamp=0` is the escape
  // hatch: the `world` preset sits at y=26 specifically to photograph the world
  // boundary from outside it, which the clamp would otherwise make impossible.
  const clampEnabled = $derived(page.url.searchParams.get("clamp") !== "0");
  const cameraPreset = $derived(
    clampEnabled ? clampPresetBelowWater(VIEW_PRESETS[view]) : VIEW_PRESETS[view]
  );
</script>

<svelte:head>
  <title>Moody Twilight Reef verification</title>
</svelte:head>

<div class="page">
  <Canvas
    createRenderer={(canvas) =>
      new WebGLRenderer({
        canvas,
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      })}
  >
    <HarnessToneMapping />
    {#key view}
      <EnvironmentReviewCamera
        destinationId="ocean-scene-review"
        preset={cameraPreset}
        walk={view === "walk"}
      />
    {/key}
    <Environment3D
      backgroundType={BackgroundType.OCEAN}
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
    background: #0a2438;
  }
</style>
