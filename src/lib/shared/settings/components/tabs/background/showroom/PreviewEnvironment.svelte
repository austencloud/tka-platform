<script lang="ts">
  import { BackgroundType } from "@austencloud/backgrounds";
  import { useThrelte } from "@threlte/core";
  import { onDestroy } from "svelte";
  import type { Scene, WebGLRenderer } from "three";

  import {
    loadThemeScene,
    type PreviewSceneComponent,
    type PreviewSceneProps,
  } from "./theme-scene-loader";

  interface Props {
    backgroundType: BackgroundType;
    onLoadError?: (error: unknown) => void;
  }

  let { backgroundType, onLoadError = () => {} }: Props = $props();

  const { scene, renderer } = useThrelte();
  let SceneComponent = $state<PreviewSceneComponent | null>(null);
  let sceneProps = $state<PreviewSceneProps>({
    performerCount: 1,
    stageWidth: 6,
    stageDepth: 6,
    stageZOffset: 0,
  });
  let loadGeneration = 0;
  let revealFrame: number | null = null;

  function getScene(): Scene {
    return ((scene as unknown as { current?: Scene }).current ??
      scene) as Scene;
  }

  function getRenderer(): WebGLRenderer {
    return ((renderer as unknown as { current?: WebGLRenderer }).current ??
      renderer) as WebGLRenderer;
  }

  function clearThreeState(): void {
    const activeScene = getScene();
    const activeRenderer = getRenderer();

    if (activeScene.isScene) {
      activeScene.fog = null;
      activeScene.background = null;
      activeScene.environment = null;
    }
    activeRenderer.clear();
  }

  function getSceneProps(type: BackgroundType): PreviewSceneProps {
    const base: PreviewSceneProps = {
      performerCount: 1,
      stageWidth: 6,
      stageDepth: 6,
      stageZOffset: 0,
    };

    if (type === BackgroundType.FOREST) return { ...base, variant: "firefly" };
    if (type === BackgroundType.COSMIC) return { ...base, variant: "night" };
    return base;
  }

  $effect(() => {
    const nextType = backgroundType;
    const generation = ++loadGeneration;
    SceneComponent = null;
    sceneProps = getSceneProps(nextType);
    clearThreeState();

    if (revealFrame !== null) cancelAnimationFrame(revealFrame);
    revealFrame = requestAnimationFrame(() => {
      revealFrame = null;
      void loadThemeScene(nextType)
        .then((module) => {
          if (generation !== loadGeneration) return;
          SceneComponent = module.default;
        })
        .catch((error: unknown) => {
          if (generation !== loadGeneration) return;
          onLoadError(error);
        });
    });

    return () => {
      loadGeneration += 1;
      if (revealFrame !== null) {
        cancelAnimationFrame(revealFrame);
        revealFrame = null;
      }
    };
  });

  onDestroy(clearThreeState);
</script>

{#if SceneComponent}
  <SceneComponent {...sceneProps} />
{/if}
