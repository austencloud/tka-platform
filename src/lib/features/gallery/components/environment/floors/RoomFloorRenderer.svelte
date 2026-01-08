<script lang="ts">
  /**
   * RoomFloorRenderer
   *
   * Orchestrates floor rendering for all rooms and corridors in the gallery.
   * Selects appropriate floor component based on room type and shape.
   */

  import type { Room } from "../../../domain/models/Room";
  import type { DoorwayCorridor } from "../../../domain/models/doorway";
  import RotundaFloor from "./RotundaFloor.svelte";
  import WingFloor from "./WingFloor.svelte";
  import CorridorFloor from "./CorridorFloor.svelte";
  import { getShapeCenter } from "../../../domain/models/room-shapes";

  interface Props {
    /** All rooms to render floors for */
    rooms: readonly Room[];
    /** Corridors connecting rooms */
    corridors?: readonly DoorwayCorridor[];
  }

  let { rooms, corridors = [] }: Props = $props();
</script>

{#each rooms as room (room.id)}
  {@const center = getShapeCenter(room.shape)}

  {#if room.shape.type === "circular"}
    <!-- Circular rooms get rotunda floor -->
    <RotundaFloor
      position={{ x: center.x, z: center.z }}
      radius={room.shape.radius}
      segments={room.shape.segments}
    />
  {:else if room.shape.type === "rectangular"}
    <!-- Rectangular rooms get wing floor -->
    <WingFloor
      position={{ x: center.x, z: center.z }}
      width={room.shape.width}
      depth={room.shape.depth}
      rotation={room.shape.rotation}
      showCarpet={room.type === "wing" || room.type === "gallery"}
    />
  {/if}
{/each}

<!-- Corridor floors bridge the gaps between rooms -->
{#each corridors as corridor (corridor.id)}
  <CorridorFloor {corridor} />
{/each}
