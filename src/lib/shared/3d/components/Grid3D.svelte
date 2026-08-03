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

  import { T, useThrelte, useTask } from "@threlte/core";
  import { Vector3 } from "three";
  import GridPlane from "./GridPlane.svelte";
  import { Plane, PLANE_COLORS } from "@austencloud/scene-3d";
  import type { GridMode } from "@austencloud/scene-3d";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    /** Which planes to show */
    visiblePlanes?: Set<Plane>;
    /** Size of each plane (default: derived from user proportions) */
    size?: number;
    /** Distance from center to the performer's hand positions. */
    handPointRadius?: number;
    /** Furthest prop extent shown by the outer ring. */
    outerPointRadius?: number;
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
    handPointRadius,
    outerPointRadius,
    showLabels = true,
    planeOpacity = 0.15,
    gridMode = "diamond",
    label,
  }: Props = $props();

  const effectiveSize = $derived(size ?? userProportionsState.gridSize);

  const { camera } = useThrelte();

  const PLANE_NORMALS: Partial<Record<Plane, Vector3>> = {
    [Plane.WALL]: new Vector3(0, 0, 1),
    [Plane.WHEEL]: new Vector3(1, 0, 0),
    [Plane.FLOOR]: new Vector3(0, 1, 0),
  };

  const _viewDir = new Vector3();
  let labelPlane = $state<Plane | null>(null);

  useTask(() => {
    if (!showLabels) {
      labelPlane = null;
      return;
    }

    const cam = camera.current;
    cam.getWorldDirection(_viewDir);

    let bestPlane: Plane | null = null;
    let bestDot = -1;

    for (const p of [Plane.WALL, Plane.WHEEL, Plane.FLOOR]) {
      if (!visiblePlanes.has(p)) continue;
      const normal = PLANE_NORMALS[p];
      if (!normal) continue;
      const dot = Math.abs(_viewDir.dot(normal));
      if (dot > bestDot) {
        bestDot = dot;
        bestPlane = p;
      }
    }

    labelPlane = bestPlane;
  });
</script>

<!-- Wall plane (purple) -->
{#if visiblePlanes.has(Plane.WALL)}
  <GridPlane
    plane={Plane.WALL}
    color={PLANE_COLORS[Plane.WALL]}
    opacity={planeOpacity}
    showLabels={labelPlane === Plane.WALL}
    size={effectiveSize}
    handRadius={handPointRadius}
    outerRadius={outerPointRadius}
    {gridMode}
  />
{/if}

<!-- Wheel plane (blue) -->
{#if visiblePlanes.has(Plane.WHEEL)}
  <GridPlane
    plane={Plane.WHEEL}
    color={PLANE_COLORS[Plane.WHEEL]}
    opacity={planeOpacity}
    showLabels={labelPlane === Plane.WHEEL}
    size={effectiveSize}
    handRadius={handPointRadius}
    outerRadius={outerPointRadius}
    {gridMode}
  />
{/if}

<!-- Floor plane (green) -->
{#if visiblePlanes.has(Plane.FLOOR)}
  <GridPlane
    plane={Plane.FLOOR}
    color={PLANE_COLORS[Plane.FLOOR]}
    opacity={planeOpacity}
    showLabels={labelPlane === Plane.FLOOR}
    size={effectiveSize}
    handRadius={handPointRadius}
    outerRadius={outerPointRadius}
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
