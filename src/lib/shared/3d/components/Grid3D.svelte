<script lang="ts">
  /**
   * Grid3D Component
   *
   * Renders all three orthogonal grid planes (Wall, Wheel, Floor)
   * with visibility toggles for each.
   *
   * Grid size is derived from user proportions (height + staff length)
   * to ensure the grid matches the user's actual reach and staff size.
   *
   * Positioning is handled by the parent scene graph (PerformerRig wraps
   * Grid3D in positioned T.Groups). This component is pure content.
   */

  import { T } from "@threlte/core";
  import GridPlane from "./GridPlane.svelte";
  import { Plane, PLANE_COLORS } from "@austencloud/scene-3d";
  import type { GridMode } from "@austencloud/scene-3d";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    /** Which planes to show */
    visiblePlanes?: Set<Plane>;
    /** Size of each plane (default: derived from user proportions) */
    size?: number;
    /** Whether to show grid point labels */
    showLabels?: boolean;
    /** Opacity for plane surfaces */
    planeOpacity?: number;
    /** Grid mode: diamond or box */
    gridMode?: GridMode;
    /** Optional label for this grid (e.g., "Avatar 1") */
    label?: string;
  }

  let {
    visiblePlanes = new Set([Plane.WALL, Plane.WHEEL, Plane.FLOOR]),
    size,
    showLabels = true,
    planeOpacity = 0.15,
    gridMode = "diamond",
    label,
  }: Props = $props();

  // Use user proportions as default if size not explicitly provided
  const effectiveSize = $derived(size ?? userProportionsState.gridSize);
</script>

<!-- Wall plane (purple) -->
{#if visiblePlanes.has(Plane.WALL)}
  <GridPlane
    plane={Plane.WALL}
    color={PLANE_COLORS[Plane.WALL]}
    opacity={planeOpacity}
    {showLabels}
    size={effectiveSize}
    {gridMode}
  />
{/if}

<!-- Wheel plane (blue) -->
{#if visiblePlanes.has(Plane.WHEEL)}
  <GridPlane
    plane={Plane.WHEEL}
    color={PLANE_COLORS[Plane.WHEEL]}
    opacity={planeOpacity}
    {showLabels}
    size={effectiveSize}
    {gridMode}
  />
{/if}

<!-- Floor plane (green) -->
{#if visiblePlanes.has(Plane.FLOOR)}
  <GridPlane
    plane={Plane.FLOOR}
    color={PLANE_COLORS[Plane.FLOOR]}
    opacity={planeOpacity}
    {showLabels}
    size={effectiveSize}
    {gridMode}
  />
{/if}

<!-- Center point indicator (always visible) - 4cm sphere -->
<T.Mesh position={[0, 0, 0]}>
  <T.SphereGeometry args={[0.04, 32, 32]} />
  <T.MeshBasicMaterial color="#f59e0b" />
</T.Mesh>

<!-- Axis helpers for orientation reference -->
<T.Group>
  <!-- X axis (red) - performer's right -->
  <T.ArrowHelper
    args={[[1, 0, 0], [0, 0, 0], effectiveSize * 1.2, 0xff4444, 0.06, 0.03]}
  />
  <!-- Y axis (green) - up/sky -->
  <T.ArrowHelper
    args={[[0, 1, 0], [0, 0, 0], effectiveSize * 1.2, 0x44ff44, 0.06, 0.03]}
  />
  <!-- Z axis (blue) - toward audience -->
  <T.ArrowHelper
    args={[[0, 0, 1], [0, 0, 0], effectiveSize * 1.2, 0x4444ff, 0.06, 0.03]}
  />
</T.Group>
