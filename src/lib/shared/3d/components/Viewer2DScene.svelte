<script lang="ts">
  /**
   * Viewer2DScene
   *
   * Orthographic 2D scene content: grid + props rendered as flat geometry.
   * Coordinate system: unit circle = grid hand point radius.
   * Origin = grid center. X-right, Y-up (Three.js default).
   *
   * Conversion from Canvas2D (Y-down) PropState angles:
   *   threeX = cos(centerPathAngle)
   *   threeY = -sin(centerPathAngle)
   */

  import { T } from "@threlte/core";
  import Grid2DOverlay from "./Grid2DOverlay.svelte";
  import PropPlane2D from "./PropPlane2D.svelte";
  import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
  import { getPropDimensions } from "$lib/shared/animation-engine/services/contracts/IPropTextureLoader";

  interface Props {
    bluePropState: PropState | null;
    redPropState: PropState | null;
    bluePropType?: string | null;
    redPropType?: string | null;
    gridMode?: string | null;
    currentStep?: number;
  }

  let {
    bluePropState,
    redPropState,
    bluePropType = "staff",
    redPropType = "staff",
    gridMode = "diamond",
    currentStep = 0,
  }: Props = $props();

  const GRID_RADIUS_VB = 150;

  function propStateToPosition(state: PropState): [number, number, number] {
    if (state.x !== undefined && state.y !== undefined) {
      return [state.x, -state.y, 0];
    }
    return [
      Math.cos(state.centerPathAngle),
      -Math.sin(state.centerPathAngle),
      0,
    ];
  }

  function propDimsToWorld(propType: string): { width: number; height: number } {
    const dims = getPropDimensions(propType || "staff");
    return {
      width: dims.width / GRID_RADIUS_VB,
      height: dims.height / GRID_RADIUS_VB,
    };
  }

  const blueDims = $derived(propDimsToWorld(bluePropType ?? "staff"));
  const redDims = $derived(propDimsToWorld(redPropType ?? "staff"));

  const bluePos = $derived(bluePropState ? propStateToPosition(bluePropState) : null);
  const redPos = $derived(redPropState ? propStateToPosition(redPropState) : null);
  const blueRot = $derived(bluePropState?.staffRotationAngle ?? 0);
  const redRot = $derived(redPropState?.staffRotationAngle ?? 0);
</script>

<T.AmbientLight intensity={1} />

<Grid2DOverlay
  gridMode={gridMode === "box" ? "box" : "diamond"}
/>

{#if bluePos}
  <PropPlane2D
    position={bluePos}
    rotation={blueRot}
    width={blueDims.width}
    height={blueDims.height}
    color="#2196f3"
    zIndex={0.01}
  />
{/if}

{#if redPos}
  <PropPlane2D
    position={redPos}
    rotation={redRot}
    width={redDims.width}
    height={redDims.height}
    color="#f44336"
    zIndex={0.02}
  />
{/if}
