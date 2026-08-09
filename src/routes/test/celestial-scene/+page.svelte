<script lang="ts">
  /** Live verification harness for the Seraphic Vault. */
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
  import HarnessToneMapping from "../winter-scene/HarnessToneMapping.svelte";

  const sceneFeatureState = createSceneFeatureState();
  setSceneFeatureContext(sceneFeatureState);
  const transitionVisual = createEnvironmentTransitionVisualState();
  transitionVisual.setRendererReady(true);
  setEnvironmentTransitionVisualContext(transitionVisual);

  const VIEW_PRESETS = {
    hero: {
      position: [0, 7.8, 34],
      target: [0, 3, -3.8],
      fov: 48,
    },
    aisle: {
      position: [0, 2.4, 12],
      target: [0, 2.8, -8],
      fov: 54,
    },
    stage: {
      position: [13, 4.5, 18],
      target: [0, 0.5, -0.5],
      fov: 46,
    },
    profile: {
      position: [25, 7, 4],
      target: [0, 3, -3],
      fov: 48,
    },
    reverse: {
      position: [0, 8, -30],
      target: [0, 3, 0],
      fov: 50,
    },
    world: {
      position: [0, 42, 38],
      target: [0, 1, -2],
      fov: 52,
    },
  } as const;
  const PORTRAIT_PHONE_PRESET = {
    position: [0, 8.2, 33],
    target: [0, 3.1, -3.8],
    fov: 68,
  } as const;
  const LANDSCAPE_PHONE_PRESET = {
    position: [0, 7.2, 32],
    target: [0, 2.9, -3.8],
    fov: 32,
  } as const;

  type ViewName = keyof typeof VIEW_PRESETS;
  let viewportWidth = $state(1920);
  let viewportHeight = $state(1080);
  const requestedView = $derived(page.url.searchParams.get("view"));
  const view = $derived(
    requestedView && requestedView in VIEW_PRESETS
      ? (requestedView as ViewName)
      : "hero"
  );
  const cameraPreset = $derived(
    view === "hero" && viewportHeight <= 500
      ? LANDSCAPE_PHONE_PRESET
      : view === "hero" && viewportWidth <= 500
        ? PORTRAIT_PHONE_PRESET
        : VIEW_PRESETS[view]
  );
</script>

<svelte:window
  bind:innerWidth={viewportWidth}
  bind:innerHeight={viewportHeight}
/>

<svelte:head>
  <title>Seraphic Vault verification</title>
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
        destinationId="celestial-scene-review"
        preset={cameraPreset}
      />
    {/key}
    <Environment3D
      backgroundType={BackgroundType.CELESTIAL}
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
    background: linear-gradient(#6f92c5 0%, #a7c6e8 58%, #f6d9b0 100%);
  }
</style>
