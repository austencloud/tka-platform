<script lang="ts">
  /** Live verification harness for the Moonlit Firefly Forest rebuild. */
  import { Canvas, T } from "@threlte/core";
  import { page } from "$app/state";
  import { WebGLRenderer } from "three";
  import { BackgroundType } from "@austencloud/backgrounds";
  import Environment3D from "$lib/shared/3d/environments/components/Environment3D.svelte";
  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
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
      position: [0, 8, 31],
      target: [0, 2, 0],
      fov: 48,
    },
    reverse: {
      position: [0, 9, -31],
      target: [0, 2, 0],
      fov: 48,
    },
    walk: {
      position: [0, 2.2, 9],
      target: [0, 1.35, 0],
      fov: 58,
    },
    world: {
      position: [0, 52, 40],
      target: [0, 1, 0],
      fov: 52,
    },
    trees: {
      position: [2, 6.5, 20],
      target: [16, 5.5, 3],
      fov: 44,
    },
    floor: {
      position: [1, 3.1, 12],
      target: [9, 0.15, 2],
      fov: 46,
    },
    camp: {
      position: [11, 4.8, 11],
      target: [5.5, 1.1, -3.5],
      fov: 45,
    },
    stage: {
      position: [-8, 4.5, 12],
      target: [0, 1.0, 0],
      fov: 46,
    },
  } as const;

  const PHONE_HERO_PRESET = {
    position: [0, 9, 31],
    target: [0, 2, 0],
    fov: 98,
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
  <title>Moonlit Firefly Forest verification</title>
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
      <T.PerspectiveCamera
        makeDefault
        position={[
          cameraPreset.position[0],
          cameraPreset.position[1],
          cameraPreset.position[2],
        ]}
        fov={cameraPreset.fov}
      >
        <OrbitControls
          enableDamping
          target={[
            cameraPreset.target[0],
            cameraPreset.target[1],
            cameraPreset.target[2],
          ]}
          minDistance={2}
          maxDistance={70}
          maxPolarAngle={Math.PI / 2 + 0.04}
        />
      </T.PerspectiveCamera>
    {/key}
    <Environment3D
      backgroundType={BackgroundType.FOREST}
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
    background: linear-gradient(#071020 0%, #102b32 58%, #172b1d 100%);
  }
</style>
