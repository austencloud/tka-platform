<script lang="ts">
  import { T } from "@threlte/core";
  import { HTML } from "@threlte/extras";
  import { DoubleSide } from "three";
  import { Plane } from "@austencloud/scene-3d";
  import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { LOCATION_ANGLES } from "$lib/shared/foundation/domain/math-constants";
  import { planeAngleToWorldPosition } from "../domain/constants/plane-transforms";
  import {
    CENTER_POINT_SIZE,
    HAND_POINT_SIZE,
    OUTER_POINT_SIZE,
    type GridMode,
    getHandPoints,
    getOuterPoints,
  } from "../domain/constants/grid-layout";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    plane: Plane;
    color?: string;
    opacity?: number;
    showLabels?: boolean;
    size?: number;
    gridMode?: GridMode;
  }

  let {
    plane,
    color = "var(--theme-accent-strong)",
    opacity = 0.15,
    showLabels = true,
    size,
    gridMode = "diamond",
  }: Props = $props();

  const handPointRadius = $derived(userProportionsState.handPointRadius);
  const outerPointRadius = $derived(userProportionsState.outerPointRadius);
  const effectiveSize = $derived(size ?? userProportionsState.gridSize);

  const handPoints = $derived(getHandPoints(gridMode));
  const outerPoints = $derived(getOuterPoints(gridMode));

  function getGridPointPosition(
    location: GridLocation,
    radius: number
  ): [number, number, number] {
    const angle = LOCATION_ANGLES[location];
    const pos = planeAngleToWorldPosition(plane, angle, radius);
    return [pos.x, pos.y, pos.z];
  }

  function getPlaneRotation(): [number, number, number] {
    switch (plane) {
      case Plane.WALL:
        return [0, 0, 0];
      case Plane.WHEEL:
        return [0, Math.PI / 2, 0];
      case Plane.FLOOR:
        return [-Math.PI / 2, 0, 0];
      default:
        return [0, 0, 0];
    }
  }

  const locationLabels: Record<GridLocation, string> = {
    [GridLocation.NORTH]: "N",
    [GridLocation.NORTHEAST]: "NE",
    [GridLocation.EAST]: "E",
    [GridLocation.SOUTHEAST]: "SE",
    [GridLocation.SOUTH]: "S",
    [GridLocation.SOUTHWEST]: "SW",
    [GridLocation.WEST]: "W",
    [GridLocation.NORTHWEST]: "NW",
    [GridLocation.CENTER]: "C",
  };


</script>

<!-- Plane group with rotation -->
<T.Group rotation={getPlaneRotation()}>
  <!-- Semi-transparent plane surface -->
  <T.Mesh>
    <T.PlaneGeometry args={[effectiveSize * 2, effectiveSize * 2]} />
    <T.MeshBasicMaterial
      {color}
      {opacity}
      transparent={true}
      side={DoubleSide}
      depthWrite={false}
    />
  </T.Mesh>

  <!-- Hand point circle (inner ring) - 1.5cm thickness -->
  <T.Mesh position={[0, 0, 0.005]}>
    <T.RingGeometry args={[handPointRadius - 0.015, handPointRadius + 0.015, 64]} />
    <T.MeshBasicMaterial
      {color}
      opacity={0.5}
      transparent={true}
      side={DoubleSide}
    />
  </T.Mesh>

  <!-- Outer point circle - 1cm thickness -->
  <T.Mesh position={[0, 0, 0.003]}>
    <T.RingGeometry args={[outerPointRadius - 0.01, outerPointRadius + 0.01, 64]} />
    <T.MeshBasicMaterial
      {color}
      opacity={0.25}
      transparent={true}
      side={DoubleSide}
    />
  </T.Mesh>

  <!-- Center point (largest, white/gold) -->
  <T.Mesh position={[0, 0, 0.01]}>
    <T.SphereGeometry args={[CENTER_POINT_SIZE, 16, 16]} />
    <T.MeshBasicMaterial color="#f59e0b" />
  </T.Mesh>
</T.Group>

<!-- Hand point markers (medium size, at hand radius) -->
{#each handPoints as location}
  {@const pos = getGridPointPosition(location, handPointRadius)}
  <T.Mesh position={pos}>
    <T.SphereGeometry args={[HAND_POINT_SIZE, 16, 16]} />
    <T.MeshBasicMaterial {color} />
  </T.Mesh>

{/each}

<!-- Outer point markers (smaller, at outer radius) -->
{#each outerPoints as location}
  {@const pos = getGridPointPosition(location, outerPointRadius)}
  <T.Mesh position={pos}>
    <T.SphereGeometry args={[OUTER_POINT_SIZE, 12, 12]} />
    <T.MeshBasicMaterial {color} opacity={0.6} transparent />
  </T.Mesh>

  {#if showLabels}
    <T.Group position={[pos[0] * 1.08, pos[1] * 1.08, pos[2] * 1.08]}>
      <HTML center sprite>
        <span class="grid-label" style="color: {color};">{locationLabels[location]}</span>
      </HTML>
    </T.Group>
  {/if}
{/each}


<style>
  .grid-label {
    font-size: 9px;
    font-weight: 700;
    white-space: nowrap;
    pointer-events: none;
    user-select: none;
    text-shadow:
      -1px -1px 0 rgba(0, 0, 0, 0.6),
      1px -1px 0 rgba(0, 0, 0, 0.6),
      -1px 1px 0 rgba(0, 0, 0, 0.6),
      1px 1px 0 rgba(0, 0, 0, 0.6);
  }
</style>
