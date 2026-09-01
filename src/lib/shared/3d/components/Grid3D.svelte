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
  import {
    Plane,
    PlaneMode,
    PLANE_COLORS,
    PLANE_MODE_CONFIGS,
  } from "@austencloud/scene-3d";
  import type { GridMode } from "@austencloud/scene-3d";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { PLANE_NORMALS } from "../domain/constants/plane-transforms";
  import {
    getGridMarkerGeometry,
    getGridMaterial,
    getGridOrientationHelperArgs,
  } from "./grid-render-resources";

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
    /** Performer layout used to place plane geometry */
    planeMode?: PlaneMode;
    /** Optional label for this grid (e.g., "Performer 1") */
    label?: string;
    /**
     * Center sphere + axis arrows. Film-style surfaces show dictated plane
     * grids as scenery and want these editor helpers off.
     */
    showOrientationHelpers?: boolean;
  }

  let {
    visiblePlanes = new Set([Plane.WALL, Plane.WHEEL, Plane.FLOOR]),
    size,
    handPointRadius,
    outerPointRadius,
    showLabels = true,
    planeOpacity = 0.15,
    gridMode = "diamond",
    planeMode = PlaneMode.WALL,
    label,
    showOrientationHelpers = true,
  }: Props = $props();

  const effectiveSize = $derived(size ?? userProportionsState.gridSize);
  const wheelPlaneOffsets = $derived.by(() => {
    if (planeMode !== PlaneMode.DUAL_WHEEL) return [0];
    const config = PLANE_MODE_CONFIGS[PlaneMode.DUAL_WHEEL];
    return [config.blueLateralOffset, config.redLateralOffset];
  });

  const { camera } = useThrelte();
  const centerPointGeometry = getGridMarkerGeometry(0.04, 32);
  const centerPointMaterial = getGridMaterial(0xf59e0b);
  const orientationHelpers = $derived(
    getGridOrientationHelperArgs(effectiveSize)
  );

  // Stable render order so the {#each} keys don't churn as planes toggle.
  const visiblePlaneList = $derived(
    (Object.values(Plane) as Plane[]).filter((p) => visiblePlanes.has(p))
  );

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

    for (const p of visiblePlaneList) {
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

<!-- All nine planes render through the same generic path; the wheel plane
   additionally splits into two laterally offset copies in DUAL_WHEEL mode. -->
{#each visiblePlaneList as plane (plane)}
  {#if plane === Plane.WHEEL}
    {#each wheelPlaneOffsets as lateralOffset, index (index)}
      <T.Group position.x={lateralOffset}>
        <GridPlane
          {plane}
          color={PLANE_COLORS[plane]}
          opacity={planeOpacity}
          showLabels={labelPlane === plane && index === 0}
          size={effectiveSize}
          handRadius={handPointRadius}
          outerRadius={outerPointRadius}
          {gridMode}
        />
      </T.Group>
    {/each}
  {:else}
    <GridPlane
      {plane}
      color={PLANE_COLORS[plane]}
      opacity={planeOpacity}
      showLabels={labelPlane === plane}
      size={effectiveSize}
      handRadius={handPointRadius}
      outerRadius={outerPointRadius}
      {gridMode}
    />
  {/if}
{/each}

{#if showOrientationHelpers}
  <!-- Center point indicator - 4cm sphere -->
  <T.Mesh
    geometry={centerPointGeometry}
    material={centerPointMaterial}
    position={[0, 0, 0]}
    dispose={false}
  />

  <!-- Axis helpers for orientation reference -->
  <T.Group>
    {#each orientationHelpers as args, index (index)}
      <T.ArrowHelper {args} />
    {/each}
  </T.Group>
{/if}
