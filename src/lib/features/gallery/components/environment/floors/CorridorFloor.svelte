<script lang="ts">
  /**
   * CorridorFloor
   *
   * Floor rendering for connection corridors that bridge gaps between rooms.
   * Features:
   * - Wood floor base (matching wing floors)
   * - Red velvet carpet runner down the center
   *
   * Positioned and rotated based on corridor start/end points.
   */

  import { T } from "@threlte/core";
  import { DoubleSide } from "three";
  import type { DoorwayCorridor } from "../../../domain/models/doorway";
  import { getCorridorLength, getCorridorCenter, getCorridorRotation } from "../../../domain/models/doorway";
  import { WOOD_FLOOR, CARPET_RED } from "../../../domain/constants/gallery-materials";

  interface Props {
    /** The corridor to render floor for */
    corridor: DoorwayCorridor;
  }

  let { corridor }: Props = $props();

  // Calculate corridor geometry
  const length = $derived(getCorridorLength(corridor));
  const center = $derived(getCorridorCenter(corridor));
  const rotation = $derived(getCorridorRotation(corridor));

  // Carpet is 40% of corridor width
  const carpetWidth = $derived(corridor.width * 0.4);

  // Slight y offsets to prevent z-fighting
  const Y_BASE = 0.1; // Slightly above room floors to ensure visibility
  const Y_CARPET = 0.6;
</script>

{#if length >= 10}
  <T.Group position={[center.x, 0, center.z]} rotation.y={rotation}>
    <!-- Wood floor base -->
    <T.Mesh position={[0, Y_BASE, 0]} rotation.x={-Math.PI / 2} receiveShadow>
      <T.PlaneGeometry args={[corridor.width, length]} />
      <T.MeshStandardMaterial
        color={WOOD_FLOOR.color}
        roughness={WOOD_FLOOR.roughness}
        metalness={WOOD_FLOOR.metalness}
        side={DoubleSide}
      />
    </T.Mesh>

    <!-- Carpet runner -->
    <T.Mesh position={[0, Y_CARPET, 0]} rotation.x={-Math.PI / 2} receiveShadow>
      <T.PlaneGeometry args={[carpetWidth, length]} />
      <T.MeshStandardMaterial
        color={CARPET_RED.color}
        roughness={CARPET_RED.roughness}
        metalness={CARPET_RED.metalness}
        side={DoubleSide}
      />
    </T.Mesh>
  </T.Group>
{/if}
