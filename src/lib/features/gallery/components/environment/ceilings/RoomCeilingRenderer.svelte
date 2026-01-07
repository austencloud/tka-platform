<script lang="ts">
  /**
   * RoomCeilingRenderer
   *
   * Orchestrates ceiling rendering for all rooms in the gallery.
   * Selects appropriate ceiling component based on room type and shape.
   */

  import type { Room } from "../../../domain/models/Room";
  import DomeCeiling from "./DomeCeiling.svelte";
  import CofferedCeiling from "./CofferedCeiling.svelte";
  import { getShapeCenter } from "../../../domain/models/room-shapes";

  interface Props {
    /** All rooms to render ceilings for */
    rooms: readonly Room[];
  }

  let { rooms }: Props = $props();
</script>

{#each rooms as room (room.id)}
  {#if room.hasCeiling}
    {@const center = getShapeCenter(room.shape)}

    {#if room.theme.ceilingType === "dome" && room.shape.type === "circular"}
      <!-- Domed ceiling for rotunda -->
      <DomeCeiling
        position={{ x: center.x, z: center.z }}
        radius={room.shape.radius}
        baseHeight={room.wallHeight}
      />
    {:else if (room.theme.ceilingType === "coffered" || room.theme.ceilingType === "flat") && room.shape.type === "rectangular"}
      <!-- Coffered or flat ceiling for wings -->
      <CofferedCeiling
        position={{ x: center.x, z: center.z }}
        width={room.shape.width}
        depth={room.shape.depth}
        height={room.wallHeight}
        rotation={room.shape.rotation}
        beamSpacing={room.theme.ceilingType === "coffered" ? 400 : 800}
      />
    {/if}
  {/if}
{/each}
