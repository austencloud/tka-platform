<script lang="ts">
  /**
   * GridPlane Component
   *
   * Renders a single grid plane with:
   * - Semi-transparent plane surface
   * - Center point (largest, white)
   * - Hand points (medium, plane color)
   * - Outer points (smallest, dimmer)
   */

  import { T } from "@threlte/core";
  import { Text } from "@threlte/extras";
  import { DoubleSide } from "three";
  import { Plane, PLANE_LABELS } from "@austencloud/scene-3d";
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
    /** Grid mode: diamond (N/E/S/W as hands) or box (NE/SE/SW/NW as hands) */
    gridMode?: GridMode;
  }

  let {
    plane,
    color = "var(--theme-accent-strong)",
    opacity = 0.15,
    showLabels = true,
    size, // Will use user proportions if not provided
    gridMode = "diamond",
  }: Props = $props();

  // Use user proportions for radii (reactive to user changes)
  const handPointRadius = $derived(userProportionsState.handPointRadius);
  const outerPointRadius = $derived(userProportionsState.outerPointRadius);
  const effectiveSize = $derived(size ?? userProportionsState.gridSize);

  // Get points based on current mode
  const handPoints = $derived(getHandPoints(gridMode));
  const outerPoints = $derived(getOuterPoints(gridMode));

  // Get position for a grid location on this plane at a given radius
  function getGridPointPosition(
    location: GridLocation,
    radius: number
  ): [number, number, number] {
    const angle = LOCATION_ANGLES[location];
    const pos = planeAngleToWorldPosition(plane, angle, radius);
    return [pos.x, pos.y, pos.z];
  }

  // Get rotation based on plane
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

  // Short labels for grid locations
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

  // Get label position for the plane title (uses effectiveSize for consistency)
  const planeLabelPosition = $derived.by((): [number, number, number] => {
    switch (plane) {
      case Plane.WALL:
        return [0, effectiveSize * 0.9, 0];
      case Plane.WHEEL:
        return [0, effectiveSize * 0.9, 0];
      case Plane.FLOOR:
        return [0, 0, -effectiveSize * 0.9];
      default:
        return [0, effectiveSize * 0.9, 0];
    }
  });
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

  {#if showLabels}
    <Text
      text={locationLabels[location]}
      position={[pos[0] * 1.12, pos[1] * 1.12, pos[2] * 1.12]}
      fontSize={0.05}
      color="white"
      anchorX="center"
      anchorY="middle"
    />
  {/if}
{/each}

<!-- Outer point markers (smaller, at outer radius) -->
{#each outerPoints as location}
  {@const pos = getGridPointPosition(location, outerPointRadius)}
  <T.Mesh position={pos}>
    <T.SphereGeometry args={[OUTER_POINT_SIZE, 12, 12]} />
    <T.MeshBasicMaterial {color} opacity={0.6} transparent />
  </T.Mesh>

  {#if showLabels}
    <Text
      text={locationLabels[location]}
      position={[pos[0] * 1.08, pos[1] * 1.08, pos[2] * 1.08]}
      fontSize={0.04}
      color="#9ca3af"
      anchorX="center"
      anchorY="middle"
    />
  {/if}
{/each}

<!-- Plane label -->
{#if showLabels}
  <Text
    text={PLANE_LABELS[plane]}
    position={planeLabelPosition}
    fontSize={0.06}
    {color}
    anchorX="center"
    anchorY="middle"
  />
{/if}
