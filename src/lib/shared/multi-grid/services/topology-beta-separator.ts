/**
 * Topology Beta Separator - Detects and resolves prop overlap in topologies
 */

import type { GridTopology, PointRef, Vec2 } from "../domain/models/GridTopology";
import type { BetaOffset } from "./contracts/types";
import { getBetaOffsetSize } from "$lib/shared/pictograph/prop/domain/enums/PropClassification";
import { LOCATION_OFFSETS, PIXELS_PER_UNIT } from "../domain/constants/GridModeOffsets";

const NO_OFFSET: BetaOffset = {
  blue: { x: 0, y: 0 },
  red: { x: 0, y: 0 },
};

const OVERLAP_THRESHOLD_PX = 5;

function findWorldPosition(topology: GridTopology, ref: PointRef): Vec2 | null {
  for (const wp of topology.worldPoints) {
    for (const wpRef of wp.refs) {
      if (wpRef.gridId === ref.gridId && wpRef.location === ref.location) {
        return wp.position;
      }
    }
  }

  const grid = topology.grids.find((g) => g.id === ref.gridId);
  if (!grid) return null;

  const locOffset = LOCATION_OFFSETS[ref.location];
  if (!locOffset) return null;

  return {
    x: grid.center.x + locOffset.x * grid.radius,
    y: grid.center.y + locOffset.y * grid.radius,
  };
}

function computeSeparationAxis(
  topology: GridTopology,
  blueRef: PointRef,
  redRef: PointRef,
): Vec2 {
  if (blueRef.gridId === redRef.gridId) {
    return { x: 0, y: 1 };
  }

  const gridA = topology.grids.find((g) => g.id === blueRef.gridId);
  const gridB = topology.grids.find((g) => g.id === redRef.gridId);
  if (!gridA || !gridB) return { x: 0, y: 1 };

  const dx = gridB.center.x - gridA.center.x;
  const dy = gridB.center.y - gridA.center.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return { x: 0, y: 1 };

  return { x: -dy / len, y: dx / len };
}

export function calculateTopologyBetaOffset(
  topology: GridTopology,
  blueRef: PointRef,
  redRef: PointRef,
  propType: string,
  gridMode: string,
): BetaOffset {
  const blueWorld = findWorldPosition(topology, blueRef);
  const redWorld = findWorldPosition(topology, redRef);
  if (!blueWorld || !redWorld) return NO_OFFSET;

  const bluePx = { x: blueWorld.x * PIXELS_PER_UNIT, y: blueWorld.y * PIXELS_PER_UNIT };
  const redPx = { x: redWorld.x * PIXELS_PER_UNIT, y: redWorld.y * PIXELS_PER_UNIT };

  const dist = Math.hypot(bluePx.x - redPx.x, bluePx.y - redPx.y);
  if (dist >= OVERLAP_THRESHOLD_PX) return NO_OFFSET;

  const axis = computeSeparationAxis(topology, blueRef, redRef);
  const betaGridMode = gridMode === "box" ? "box" : "diamond";
  const offset = getBetaOffsetSize(propType, betaGridMode as "diamond" | "box");

  return {
    blue: { x: axis.x * offset, y: axis.y * offset },
    red: { x: -axis.x * offset, y: -axis.y * offset },
  };
}
