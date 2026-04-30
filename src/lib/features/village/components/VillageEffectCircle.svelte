<!--
  VillageEffectCircle - Ground ring colored by effect affinity with point light.
  Steady opacity (no pulse), distinguishing from jam circles which pulse.
-->
<script lang="ts">
  import { T } from "@threlte/core";
  import type { EffectCircle } from "../domain/village-types";
  import { CIRCLE_COLORS } from "../domain/village-constants";

  interface Props {
    circle: EffectCircle;
  }

  const { circle }: Props = $props();
  const color = $derived(CIRCLE_COLORS[circle.affinity] ?? "#ffffff");
</script>

<T.Mesh
  rotation.x={-Math.PI / 2}
  position.x={circle.centerX}
  position.y={0.004}
  position.z={circle.centerZ}
>
  <T.RingGeometry args={[circle.radius - 0.15, circle.radius, 64]} />
  <T.MeshBasicMaterial
    {color}
    transparent
    opacity={0.25}
    depthWrite={false}
  />
</T.Mesh>

<T.PointLight
  position.x={circle.centerX}
  position.y={0.5}
  position.z={circle.centerZ}
  {color}
  intensity={0.3}
  distance={circle.radius + 1}
/>
