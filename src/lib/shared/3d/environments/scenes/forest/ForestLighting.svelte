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
  import type { HemisphereLightConfig } from "../../domain/models/scene-configs/shared-scene-config";
  import {
    FOREST_NIGHT_LIGHTING,
    type ForestLightingConfig,
  } from "../../domain/models/scene-configs/forest-scene-config";

  interface Props {
    hemisphere: HemisphereLightConfig;
    profile?: ForestLightingConfig;
    groundY?: number;
  }

  let {
    hemisphere,
    profile,
    groundY = 0,
  }: Props = $props();

  const KEY_LIGHT_DISTANCE = 64;
  const activeProfile = $derived(profile ?? FOREST_NIGHT_LIGHTING);
  const keyPosition = $derived.by(() => {
    const direction = activeProfile.key.direction;
    const length = Math.hypot(...direction);
    if (length === 0) return [12, 22, -58] as const;

    return direction.map(
      (component) => (component / length) * KEY_LIGHT_DISTANCE
    ) as [number, number, number];
  });
</script>

<!-- The visible celestial body establishes one global light direction without
     paying for a full-canopy shadow pass. -->
<T.DirectionalLight
  color={activeProfile.key.color}
  intensity={activeProfile.key.intensity}
  position.x={keyPosition[0]}
  position.y={keyPosition[1] + groundY}
  position.z={keyPosition[2]}
  castShadow
  shadow.mapSize.width={2048}
  shadow.mapSize.height={2048}
  shadow.camera.near={1}
  shadow.camera.far={140}
  shadow.camera.left={-28}
  shadow.camera.right={48}
  shadow.camera.top={30}
  shadow.camera.bottom={-30}
  shadow.bias={-0.0006}
  shadow.normalBias={0.035}
  shadow.radius={3}
  shadow.intensity={activeProfile.key.shadowIntensity}
/>

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
