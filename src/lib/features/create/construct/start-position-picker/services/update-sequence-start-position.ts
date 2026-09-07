import { recalculateSequenceMotionFrom } from "$lib/features/create/shared/services/recalculate-sequence-motion";
import { withLoopCertificateCleared } from "$lib/shared/create/services/loop-certificate";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type {
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

export type StartPositionUpdateResult =
  | { ok: true; sequence: SequenceData }
  | { ok: false; reason: "grid-mismatch" | "broken-transition" };

function deriveBoundaryPosition(
  pictograph: PictographData,
  boundary: "start" | "end"
): GridPosition | null {
  const left = pictograph.motions.left;
  const right = pictograph.motions.right;
  if (!left || !right) return null;

  try {
    return getGridPositionFromLocations(
      boundary === "start" ? left.startLocation : left.endLocation,
      boundary === "start" ? right.startLocation : right.endLocation
    );
  } catch {
    return null;
  }
}

/**
 * Change a sequence start only when the existing first beat remains reachable.
 * Orientation changes are propagated through every downstream beat.
 */
export function updateSequenceStartPosition(
  sequence: SequenceData,
  startPosition: StartPositionData,
  gridMode: GridMode
): StartPositionUpdateResult {
  const firstStep = sequence.steps[0];
  const changesGrid =
    sequence.steps.length > 0 &&
    sequence.gridMode !== undefined &&
    sequence.gridMode !== gridMode;

  if (changesGrid) {
    return { ok: false, reason: "grid-mismatch" };
  }

  if (firstStep) {
    const poseEnd = deriveBoundaryPosition(startPosition, "end");
    const firstStart = deriveBoundaryPosition(firstStep, "start");
    if (!poseEnd || !firstStart || poseEnd !== firstStart) {
      return { ok: false, reason: "broken-transition" };
    }
  }

  const updated = withLoopCertificateCleared({
    ...sequence,
    startPosition,
    startingPosition: startPosition,
  });

  return {
    ok: true,
    sequence: recalculateSequenceMotionFrom(updated, 0),
  };
}
