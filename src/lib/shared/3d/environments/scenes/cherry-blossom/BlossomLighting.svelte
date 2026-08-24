<script lang="ts">
  /** Moon, horizon, and lantern rig for the hanami garden. */
  import { T } from "@threlte/core";
  import type { HemisphereLightConfig } from "../../domain/models/scene-configs/shared-scene-config";
  import type { BlossomRuntimeConfig } from "./blossom-runtime";

  interface Props {
    groundY: number;
    stageZOffset: number;
    hemisphere: HemisphereLightConfig;
    moon: {
      color: string;
      intensity: number;
      position: [number, number, number];
    } | null;
    runtime: BlossomRuntimeConfig;
  }

  let { groundY, stageZOffset, hemisphere, moon, runtime }: Props = $props();

  const keyPosition = $derived(
    moon?.position ?? ([-22, 30, -34] as [number, number, number])
  );
</script>

<!-- The moon is the only shadow direction. The surrounding fills model the
     blossom volume without creating contradictory contact shadows. -->
<T.DirectionalLight
  color={moon?.color ?? "#d9ddff"}
  intensity={runtime.lights.key}
  position.x={keyPosition[0]}
  position.y={keyPosition[1] + groundY}
  position.z={keyPosition[2] + stageZOffset}
  castShadow={runtime.effects.shadows}
  shadow.mapSize.width={runtime.effects.shadowMapSize}
  shadow.mapSize.height={runtime.effects.shadowMapSize}
  shadow.camera.near={1}
  shadow.camera.far={110}
  shadow.camera.left={-22}
  shadow.camera.right={22}
  shadow.camera.top={22}
  shadow.camera.bottom={-22}
  shadow.bias={-0.00065}
  shadow.normalBias={0.04}
  shadow.radius={3}
  shadow.intensity={0.56}
/>

<T.DirectionalLight
  color="#ff7f91"
  intensity={0.88}
  position.x={18}
  position.y={8 + groundY}
  position.z={22 + stageZOffset}
/>

<T.DirectionalLight
  color="#7f73b7"
  intensity={0.36}
  position.x={-12}
  position.y={6 + groundY}
  position.z={18 + stageZOffset}
/>

<T.HemisphereLight
  color={hemisphere.skyColor}
  groundColor={hemisphere.groundColor}
  intensity={runtime.lights.hemisphere}
/>
<T.AmbientLight color="#c89ab9" intensity={0.18} />

<!-- Only the closest practicals get real lights. Their emissive meshes remain
     visible on every tier, so low quality keeps the lantern-path composition. -->
{#if runtime.effects.lanternLights >= 1}
  <T.PointLight
    color="#ff9b52"
    intensity={6.5}
    distance={10}
    decay={2}
    position={[7, groundY + 2.15, 4.6 + stageZOffset]}
  />
{/if}

{#if runtime.effects.lanternLights >= 2}
  <T.PointLight
    color="#ff9b52"
    intensity={6.5}
    distance={10}
    decay={2}
    position={[-7, groundY + 2.15, 4.6 + stageZOffset]}
  />
{/if}

{#if runtime.effects.lanternLights >= 3}
  <T.PointLight
    color="#ff7565"
    intensity={4.6}
    distance={9}
    decay={2}
    position={[0, groundY + 2.6, 14.2 + stageZOffset]}
  />
{/if}
