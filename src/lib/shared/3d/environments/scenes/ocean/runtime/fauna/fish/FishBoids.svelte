<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { onDestroy, untrack } from "svelte";
  import type { Camera, WebGLRenderer } from "three";
  import {
    createOceanFishBoids,
    type OceanFishWorldOffset,
  } from "../../../../../worlds/ocean/ocean-fish-boids";
  import type { CursorRay } from "../../interaction/cursor-ray";

  interface Props {
    targetSize?: number;
    swimHeight?: [number, number];
    speed?: [number, number];
    stageRadius?: number;
    boundRadius?: number;
    currentStrength?: number;
    scatterRadius?: number;
    scatterForce?: number;
    scatterWaveSpeed?: number;
    perceptionAngle?: number;
    halfSpeedTime?: number;
    cursorRay?: CursorRay;
    modelBasePath?: string;
    worldYOffset?: number;
    worldOffset?: [number, number, number];
    fogColor?: string;
    fogNear?: number;
    fogFar?: number;
    ambient?: number;
  }

  let {
    targetSize = 1,
    swimHeight = [2, 7] as [number, number],
    speed = [0.5, 1.2] as [number, number],
    stageRadius = 5,
    boundRadius = 18,
    currentStrength = 0.3,
    scatterRadius = 8.5,
    scatterForce = 16,
    scatterWaveSpeed = 0.15,
    perceptionAngle = 135,
    halfSpeedTime = 0.5,
    cursorRay,
    modelBasePath = "/models/ocean/pack/",
    worldYOffset = 0,
    worldOffset,
    fogColor,
    fogNear,
    fogFar,
    ambient,
  }: Props = $props();

  const { renderer, camera } = useThrelte();
  const groundY = $derived(worldOffset ? 0 : userProportionsState.groundY);
  const resolvedWorldOffset = $derived<OceanFishWorldOffset>(
    worldOffset ?? [0, worldYOffset, 0]
  );

  const world = untrack(() =>
    createOceanFishBoids({
      renderer:
        (renderer as unknown as { current?: WebGLRenderer }).current ??
        (renderer as unknown as WebGLRenderer),
      targetSize,
      swimHeight,
      speed,
      stageRadius,
      boundRadius,
      currentStrength,
      scatterRadius,
      scatterForce,
      scatterWaveSpeed,
      perceptionAngle,
      halfSpeedTime,
      cursorRay,
      modelBasePath,
      groundY,
      worldOffset: resolvedWorldOffset,
      fogColor,
      fogNear,
      fogFar,
      ambient,
    })
  );

  void world.ready.catch((error: unknown) => {
    console.error("[FishBoids] Failed to initialize fish:", error);
  });

  $effect(() => world.setCursorRay(cursorRay));
  $effect(() => world.setGroundY(groundY));
  $effect(() => world.setWorldOffset(resolvedWorldOffset));

  useTask((delta) => {
    const activeCamera =
      (camera as unknown as { current?: Camera }).current ??
      (camera as unknown as Camera);
    if (activeCamera) world.update(delta, activeCamera);
  });

  onDestroy(world.dispose);
</script>

<T is={world.object} />
