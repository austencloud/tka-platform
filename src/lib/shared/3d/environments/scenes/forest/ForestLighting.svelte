<script lang="ts">
  /**
   * ForestLighting
   *
   * The visible Sun or Moon owns the broad direction of the scene. A restrained
   * fill preserves bark and foliage on the camera side, while the Night Master
   * keeps one small pool on the performance clearing. Campsite lights remain in
   * ForestScene because they are local practicals tied to the fire.
   */

  import { T } from "@threlte/core";
  import { Object3D } from "three";
  import { tryGetAdaptiveQualityContext } from "../../../context/adaptive-quality-context";
  import type { HemisphereLightConfig } from "../../domain/models/scene-configs/shared-scene-config";
  import {
    FOREST_NIGHT_LIGHTING,
    type ForestLightingConfig,
  } from "../../domain/models/scene-configs/forest-scene-config";

  interface Props {
    hemisphere: HemisphereLightConfig;
    profile?: ForestLightingConfig;
    groundY?: number;
    /** World-space center of the active shadow pool. */
    anchor?: { x: number; y: number; z: number };
    /** Site-scale consumers can widen the original clearing shadow camera. */
    shadowExtentMeters?: number;
    keyLightDistanceMeters?: number;
  }

  let {
    hemisphere,
    profile,
    groundY = 0,
    anchor = { x: 0, y: groundY, z: 0 },
    shadowExtentMeters,
    keyLightDistanceMeters = 64,
  }: Props = $props();

  const adaptiveQuality = tryGetAdaptiveQualityContext();
  const shadowsEnabled = $derived(
    adaptiveQuality?.config.enableShadows ?? true
  );
  const activeProfile = $derived(profile ?? FOREST_NIGHT_LIGHTING);
  const keyTarget = new Object3D();
  const keyPosition = $derived.by(() => {
    const direction = activeProfile.key.direction;
    const length = Math.hypot(...direction);
    if (length === 0) {
      return [anchor.x + 12, anchor.y + 22, anchor.z - 58] as const;
    }

    return [
      anchor.x + (direction[0] / length) * keyLightDistanceMeters,
      anchor.y + (direction[1] / length) * keyLightDistanceMeters,
      anchor.z + (direction[2] / length) * keyLightDistanceMeters,
    ] as const;
  });

  $effect(() => {
    keyTarget.position.set(anchor.x, anchor.y, anchor.z);
    keyTarget.updateMatrixWorld();
  });
</script>

<!-- The visible celestial body establishes one global light direction without
     paying for a full-canopy shadow pass. -->
<T.DirectionalLight
  color={activeProfile.key.color}
  intensity={activeProfile.key.intensity}
  position.x={keyPosition[0]}
  position.y={keyPosition[1]}
  position.z={keyPosition[2]}
  target={keyTarget}
  castShadow={shadowsEnabled}
  shadow.mapSize.width={2048}
  shadow.mapSize.height={2048}
  shadow.camera.near={1}
  shadow.camera.far={140}
  shadow.camera.left={shadowExtentMeters ? -shadowExtentMeters : -28}
  shadow.camera.right={shadowExtentMeters ?? 48}
  shadow.camera.top={shadowExtentMeters ?? 30}
  shadow.camera.bottom={shadowExtentMeters ? -shadowExtentMeters : -30}
  shadow.bias={-0.0006}
  shadow.normalBias={0.035}
  shadow.radius={3}
  shadow.intensity={activeProfile.key.shadowIntensity}
/>
<T is={keyTarget} />

<!-- Camera-side canopy fill keeps bark and leaf color legible while the
     authored key still owns the shadows. -->
<T.DirectionalLight
  color={activeProfile.fill.color}
  intensity={activeProfile.fill.intensity}
  position.x={-18}
  position.y={7 + groundY}
  position.z={26}
/>

<T.HemisphereLight
  color={hemisphere.skyColor}
  groundColor={hemisphere.groundColor}
  intensity={hemisphere.intensity}
/>

<!-- A small ambient lift prevents dark materials from clipping after AgX. -->
<T.AmbientLight
  color={activeProfile.ambient.color}
  intensity={activeProfile.ambient.intensity}
/>

<!-- The Night Master gathers moonlight over the stage. Day turns this off. -->
{#if activeProfile.stage.intensity > 0}
  <T.PointLight
    color={activeProfile.stage.color}
    intensity={activeProfile.stage.intensity}
    distance={activeProfile.stage.distance}
    decay={2}
    position.x={-1.5}
    position.y={5.5 + groundY}
    position.z={2}
  />
{/if}
