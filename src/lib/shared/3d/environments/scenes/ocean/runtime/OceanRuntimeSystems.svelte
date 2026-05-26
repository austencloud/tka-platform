<script lang="ts">
  import { T } from "@threlte/core";
  import { Vector3 } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import type { OceanQualityConfig } from "../quality/ocean-quality";
  import WaterSurface from "./water/WaterSurface.svelte";
  import AtmosphereSystem from "./atmosphere/AtmosphereSystem.svelte";
  import FaunaSystem from "./fauna/FaunaSystem.svelte";
  import OceanInteraction from "./interaction/OceanInteraction.svelte";

  interface Props {
    quality: OceanQualityConfig;
    performerCount?: number;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
  }

  let {
    quality,
    performerCount = 1,
    stageWidth = 6,
    stageDepth = 6,
    stageZOffset = 0,
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);
  let rayPosition = $state(new Vector3(0, -999, 0));
</script>

<!-- Seabed ground plane -->
<T.Mesh position.y={groundY - 0.01} rotation.x={-Math.PI / 2} receiveShadow>
  <T.CircleGeometry args={[30, 64]} />
  <T.MeshStandardMaterial color="#0d1f2d" roughness={0.95} metalness={0} />
</T.Mesh>

<!-- Lighting -->
<T.HemisphereLight args={["#1a4060", "#0a1a2a", 0.6]} />
<T.DirectionalLight position={[10, 30, -20]} intensity={0.8} color="#6699cc" />

<!-- Water surface (above everything) -->
<WaterSurface />

<!-- Atmosphere: god rays, caustics, particles -->
<AtmosphereSystem {quality} />

<!-- Fauna: fish boids + jellyfish swarm -->
<FaunaSystem {quality} {rayPosition} />

<!-- Interaction: mouse raycast → fish scatter + audio -->
<OceanInteraction bind:rayPosition />
