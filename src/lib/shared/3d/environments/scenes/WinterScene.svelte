<script lang="ts">
  import { useTask, useThrelte } from "@threlte/core";
  import { useGltf, useKtx2, useMeshopt } from "@threlte/extras";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { onMount } from "svelte";
  import { tryGetAdaptiveQualityContext } from "../../context/adaptive-quality-context";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import type { WinterSceneConfig } from "../domain/models/scene-configs";
  import {
    prefersReducedMotion,
    resolveMotionScale,
  } from "../primitives/motion-preference";
  import {
    createWinterEnvironmentWorld,
    type WinterEnvironmentWorld,
  } from "../worlds/winter/winter-environment-world";
  import { detectWinterQuality } from "./winter/quality/winter-quality";

  interface Props {
    config?: WinterSceneConfig;
    stageRadius?: number;
    stageRadiusGrowth?: number;
    stageZOffset?: number;
    platformVisible?: boolean;
  }

  let {
    config,
    stageRadius = 3,
    stageRadiusGrowth = 0,
    stageZOffset = 0,
    platformVisible = true,
  }: Props = $props();

  const { camera, scene, renderer } = useThrelte();
  const adaptiveQuality = tryGetAdaptiveQualityContext();
  const sceneFeatures = getSceneFeatureContext();
  const winterEnvironment = useGltf("/models/winter/winter-environment.glb", {
    meshoptDecoder: useMeshopt(),
    ktx2Loader: useKtx2("/basis/"),
  });
  let world: WinterEnvironmentWorld | null = null;

  $effect(() => {
    const environmentRoot = $winterEnvironment?.scene;
    if (!environmentRoot) {
      sceneFeatures?.reportProgress("environment", 0);
      return;
    }
    const next = createWinterEnvironmentWorld({
      environmentRoot,
      config,
      groundY: userProportionsState.groundY,
      stageRadius,
      stageRadiusGrowth,
      stageZOffset,
      platformVisible,
      deviceTier: adaptiveQuality?.contentTier ?? detectWinterQuality(renderer),
      motionScale: resolveMotionScale(prefersReducedMotion()),
      outputColorSpace: renderer.outputColorSpace,
    });
    const previousFog = scene.fog;
    const previousBackground = scene.background;
    scene.add(next.root);
    scene.fog = next.fog;
    scene.background = next.background;
    world = next;
    sceneFeatures?.reportProgress("environment", 1);
    sceneFeatures?.reportReady("environment");

    return () => {
      if (world === next) world = null;
      scene.remove(next.root);
      if (scene.fog === next.fog) scene.fog = previousFog;
      if (scene.background === next.background) {
        scene.background = previousBackground;
      }
      next.dispose();
    };
  });

  useTask((delta) => {
    const activeCamera = camera.current;
    if (!world || !activeCamera) return;
    world.update(delta, activeCamera);
  });

  onMount(() => {
    const timer = setTimeout(() => {
      if (sceneFeatures && !sceneFeatures.isReady("environment")) {
        console.warn("[WinterScene] loading timed out - lifting curtain");
        sceneFeatures.reportReady("environment");
      }
    }, 15_000);
    return () => clearTimeout(timer);
  });
</script>
