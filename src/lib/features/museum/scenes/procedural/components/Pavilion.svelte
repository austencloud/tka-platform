<script lang="ts">
  import { T } from "@threlte/core";
  import { Color } from "three";
  import type { PavilionLayout } from "../domain/museum-types";

  interface Props {
    pavilion: PavilionLayout;
    groundY: number;
  }

  let { pavilion, groundY }: Props = $props();

  const wallColor = new Color(0xd4c5a9); // warm sandstone
  const floorColor = new Color(0x8b7d6b); // flagstone
</script>

<!-- Floor plane under the pavilion -->
<T.Mesh
  position.x={pavilion.position.x}
  position.y={groundY + 0.01}
  position.z={pavilion.position.z}
  rotation.x={-Math.PI / 2}
  receiveShadow
>
  <T.PlaneGeometry args={[20, 20]} />
  <T.MeshStandardMaterial color={floorColor} roughness={0.9} />
</T.Mesh>

<!-- Walls -->
{#each pavilion.walls as wall}
  {@const dx = wall.end.x - wall.start.x}
  {@const dz = wall.end.z - wall.start.z}
  {@const length = Math.sqrt(dx * dx + dz * dz)}
  {@const centerX = pavilion.position.x + (wall.start.x + wall.end.x) / 2}
  {@const centerZ = pavilion.position.z + (wall.start.z + wall.end.z) / 2}
  {@const angle = Math.atan2(dx, dz)}

  <T.Mesh
    position.x={centerX}
    position.y={groundY + wall.height / 2}
    position.z={centerZ}
    rotation.y={angle}
    castShadow
    receiveShadow
  >
    <T.BoxGeometry args={[wall.thickness, wall.height, length]} />
    <T.MeshStandardMaterial color={wallColor} roughness={0.8} />
  </T.Mesh>
{/each}
