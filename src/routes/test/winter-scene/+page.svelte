<script lang="ts">
  /** Live verification harness for Moonlit Winter Hollow. */
  import { Canvas } from "@threlte/core";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { WebGLRenderer } from "three";
  import { BackgroundType } from "@austencloud/backgrounds";
  import Environment3D from "$lib/shared/3d/environments/components/Environment3D.svelte";
  import EnvironmentReviewCamera from "$lib/shared/3d/environments/review/EnvironmentReviewCamera.svelte";
  import { createSceneFeatureState } from "$lib/shared/3d/scene-features/state/scene-feature-state.svelte";
  import { setSceneFeatureContext } from "$lib/shared/3d/scene-features/context/scene-feature-context";
  import { createEnvironmentTransitionVisualState } from "$lib/shared/3d/environments/state/environment-transition-visual-state.svelte";
  import { setEnvironmentTransitionVisualContext } from "$lib/shared/3d/environments/context/environment-transition-visual-context";
  import HarnessToneMapping from "./HarnessToneMapping.svelte";
  import WinterCompositionPlan from "./WinterCompositionPlan.svelte";

  const sceneFeatureState = createSceneFeatureState();
  setSceneFeatureContext(sceneFeatureState);
  const transitionVisual = createEnvironmentTransitionVisualState();
  transitionVisual.setRendererReady(true);
  setEnvironmentTransitionVisualContext(transitionVisual);

  const VIEW_PRESETS = {
    hero: {
      position: [10, 5.2, 30],
      target: [-6, 1.8, -9],
      fov: 44,
    },
    pond: {
      position: [6, 5.5, 18],
      target: [16, 0.15, -10],
      fov: 42,
    },
    trees: {
      position: [8, 6, 24],
      target: [18, 6, -10],
      fov: 44,
    },
    props: {
      position: [2, 3.6, 4],
      target: [18, 0.3, -10],
      fov: 45,
    },
    reverse: {
      position: [-12, 10, -28],
      target: [0, 2, 0],
      fov: 48,
    },
    walk: {
      position: [8, 1.65, 38],
      target: [0, 1.2, 9],
      fov: 58,
    },
    stage: {
      position: [10.5, 2.6, 9.5],
      target: [0, 0.12, 0],
      fov: 43,
    },
    settlement: {
      position: [10, 18, 30],
      target: [-8, 2.6, -15],
      fov: 42,
    },
    lodge: {
      position: [-4, 6, 2],
      target: [-24, 2.6, -38],
      fov: 46,
    },
    hearth: {
      position: [-16, 5.5, -9],
      target: [-34, 3.35, -30],
      fov: 42,
    },
    world: {
      position: [10, 52, 30],
      target: [-6, 2, -9],
      fov: 52,
    },
  } as const;
  const PHONE_HERO_PRESET = {
    position: [10, 7, 28],
    target: [-7, 2, -7],
    fov: 70,
  } as const;

  onMount(() => {
    delete document.documentElement.dataset.winterFrameSample;
    let frameId = 0;
    const timer = window.setTimeout(() => {
      const intervals: number[] = [];
      let previous = performance.now();
      const started = previous;
      const sample = (now: number) => {
        intervals.push(now - previous);
        previous = now;
        if (now - started < 5_000) {
          frameId = requestAnimationFrame(sample);
          return;
        }
        const sorted = intervals.slice(1).sort((left, right) => left - right);
        const averageFrameMs =
          sorted.reduce((total, interval) => total + interval, 0) /
          sorted.length;
        const percentile = (amount: number) =>
          sorted[
            Math.min(sorted.length - 1, Math.floor(sorted.length * amount))
          ];
        document.documentElement.dataset.winterFrameSample = JSON.stringify({
          averageFps: 1_000 / averageFrameMs,
          averageFrameMs,
          p50FrameMs: percentile(0.5),
          p95FrameMs: percentile(0.95),
          sampledFrames: sorted.length,
        });
      };
      frameId = requestAnimationFrame(sample);
    }, 2_000);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frameId);
      delete document.documentElement.dataset.winterFrameSample;
    };
  });

  type ViewName = keyof typeof VIEW_PRESETS;
  let viewportWidth = $state(1920);
  const requestedView = $derived(page.url.searchParams.get("view"));
  const showCompositionPlan = $derived(requestedView === "composition");
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

{#if showCompositionPlan}
  <WinterCompositionPlan />
{:else}
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
{/if}

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
