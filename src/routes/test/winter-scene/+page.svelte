<script lang="ts">
  /** Live verification harness for Moonlit Winter Hollow. */
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

  const sceneFeatureState = createSceneFeatureState();
  setSceneFeatureContext(sceneFeatureState);
  const transitionVisual = createEnvironmentTransitionVisualState();
  transitionVisual.setRendererReady(true);
  setEnvironmentTransitionVisualContext(transitionVisual);

  const VIEW_PRESETS = {
    hero: {
      position: [0, 8, 31],
      target: [-3, 2, 2],
      fov: 48,
    },
    pond: {
      position: [-2, 5.5, 18],
      target: [-14, 0.2, 8],
      fov: 42,
    },
    trees: {
      position: [2, 6, 20],
      target: [16, 6, 4],
      fov: 44,
    },
    props: {
      position: [1, 3.6, 2],
      target: [11, 0.3, -11],
      fov: 45,
    },
    reverse: {
      position: [0, 10, -30],
      target: [0, 2, 0],
      fov: 48,
    },
    walk: {
      position: [0, 2.1, 7],
      target: [0, 1.3, 0],
      fov: 58,
    },
    world: {
      position: [0, 48, 36],
      target: [0, 2, 0],
      fov: 52,
    },
  } as const;
  const PHONE_HERO_PRESET = {
    position: [0, 9, 31],
    target: [-3, 2, 2],
    fov: 100,
  } as const;

  type ViewName = keyof typeof VIEW_PRESETS;
  let viewportWidth = $state(1920);
  const requestedView = $derived(page.url.searchParams.get("view"));
  const view = $derived(
    requestedView && requestedView in VIEW_PRESETS
      ? (requestedView as ViewName)
      : "hero"
  );
  const cameraPreset = $derived(
    view === "hero" && viewportWidth <= 500
      ? PHONE_HERO_PRESET
      : VIEW_PRESETS[view]
  );
</script>

<svelte:window bind:innerWidth={viewportWidth} />

<svelte:head>
  <title>Moonlit Winter Hollow verification</title>
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
        destinationId="winter-scene-review"
        preset={cameraPreset}
        walk={view === "walk"}
      />
    {/key}
    <Environment3D
      backgroundType={BackgroundType.WINTER}
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
    background: linear-gradient(#050b1b 0%, #102a48 58%, #294964 100%);
  }
</style>
