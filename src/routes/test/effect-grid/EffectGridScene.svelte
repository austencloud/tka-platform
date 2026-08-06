<script lang="ts">
  /**
   * Scene contents for the effect grid: every registry effect as one station in
   * a 4x4 arrangement, each running the same sequence with the same overlaid
   * rigs, so the effect is the only variable.
   */
  import { T } from "@threlte/core";
  import CellLabel3D from "./CellLabel3D.svelte";
  import TelekineticFormation3D from "$lib/features/museum/components/game/TelekineticFormation3D.svelte";
  import { EFFECT_CELLS, GRID_SEQUENCE_ID } from "./effect-grid";

  interface Props {
    showProps: boolean;
    playing: boolean;
    showLabels: boolean;
    /** Overlaid centre rigs per station. The cost dial for this page. */
    centerPlanes: number;
  }
  const props: Props = $props();
</script>

<!-- Dim key: the effects carry the frame, lighting stays out of their way. -->
<T.AmbientLight intensity={0.18} color="#0e1420" />
<T.DirectionalLight position={[8, 16, 10]} intensity={0.32} color="#c8d4ff" />

{#each EFFECT_CELLS as cell (cell.id)}
  <T.Mesh
    position.x={cell.x}
    position.y={0.01}
    position.z={cell.z}
    rotation.x={-Math.PI / 2}
  >
    <T.RingGeometry args={[2.0, 2.15, 48]} />
    <T.MeshBasicMaterial color={cell.color} transparent opacity={0.3} />
  </T.Mesh>

  {#if props.showLabels}
    <CellLabel3D
      text={cell.label}
      color={cell.color}
      position={[cell.x, 0.35, cell.z + 2.5]}
    />
  {/if}

  <TelekineticFormation3D
    stationId={`grid-${cell.id}`}
    worldX={cell.x}
    worldZ={cell.z}
    sequenceId={GRID_SEQUENCE_ID}
    presentation="sculpture"
    effectId={cell.id}
    showProps={props.showProps}
    autoPlay={props.playing}
    centerPlanes={props.centerPlanes}
  />
{/each}
