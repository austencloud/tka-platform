<script lang="ts">
  import { useTask, useThrelte } from "@threlte/core";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import {
    createDefaultRainbowConfig,
    type RainbowSceneConfig,
  } from "../domain/models/scene-configs";
  import {
    prefersReducedMotion,
    resolveMotionScale,
  } from "../primitives/motion-preference";
  import {
    createRainbowEnvironmentWorld,
    type RainbowEnvironmentWorld,
  } from "../worlds/rainbow/rainbow-environment-world";

  interface Props {
    config?: RainbowSceneConfig;
    stageRadius?: number;
    stageRadiusGrowth?: number;
  }

  let { config, stageRadius = 3, stageRadiusGrowth = 0 }: Props = $props();

  const { camera, scene } = useThrelte();
  const sceneFeatures = getSceneFeatureContext();
  let world: RainbowEnvironmentWorld | null = null;
  let elapsed = 0;

  $effect(() => {
    const next = createRainbowEnvironmentWorld({
      config: config ?? createDefaultRainbowConfig(),
      groundY: userProportionsState.groundY,
      stageRadius,
      stageRadiusGrowth,
      motionScale: resolveMotionScale(prefersReducedMotion()),
    });
    const previousFog = scene.fog;
    scene.add(next.root);
    scene.fog = next.fog;
    world = next;
    elapsed = 0;
    sceneFeatures?.reportReady("environment");

    return () => {
      if (world === next) world = null;
      scene.remove(next.root);
      if (scene.fog === next.fog) scene.fog = previousFog;
      next.dispose();
    };
  });

  useTask((delta) => {
    const activeWorld = world;
    const activeCamera = camera.current;
    if (!activeWorld || !activeCamera) return;
    elapsed += delta;
    activeWorld.update(delta, elapsed, activeCamera);
  });
</script>
