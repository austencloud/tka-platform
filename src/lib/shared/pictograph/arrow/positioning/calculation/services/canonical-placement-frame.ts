import { rotateLocation } from "$lib/shared/create/services/rotation-helpers";
import {
  GridMode,
  type GridLocation,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { deriveGridMode } from "$lib/shared/pictograph/grid/services/grid-mode-deriver";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import { applyRotationMatrix } from "$lib/shared/pictograph/arrow/orchestration/services/arrow-coordinate-transformer";

const BOX_FRAME_ROTATION_DEGREES = 45;

export interface PlacementVector {
  x: number;
  y: number;
}

export interface CanonicalPlacementContext {
  pictographData: PictographData;
  motionData: MotionData;
  location?: GridLocation;
  displayedGridMode: GridMode;
  rotationDegrees: 0 | 45;
}

/**
 * Resolve the grid that owns the visible anchor. This mirrors the preparer's
 * precedence so an explicit pictograph or render override cannot disagree with
 * the placement frame.
 */
export function resolveDisplayedPlacementGridMode(
  pictographData: PictographData,
  motionData: MotionData,
  gridModeOverride?: GridMode
): GridMode {
  if (gridModeOverride) return gridModeOverride;
  if (pictographData.gridMode) return pictographData.gridMode;
  if (motionData.gridMode) return motionData.gridMode;

  const blue = pictographData.motions.blue;
  const red = pictographData.motions.red;
  return blue && red ? deriveGridMode(blue, red) : GridMode.DIAMOND;
}

/**
 * Box is a 45° presentation of the diamond coordinate frame. Normalize the
 * complete lookup context before any placement tier derives keys or values.
 */
export function createCanonicalPlacementContext(
  pictographData: PictographData,
  motionData: MotionData,
  location?: GridLocation,
  gridModeOverride?: GridMode
): CanonicalPlacementContext {
  const displayedGridMode = resolveDisplayedPlacementGridMode(
    pictographData,
    motionData,
    gridModeOverride
  );

  if (displayedGridMode !== GridMode.BOX) {
    return {
      pictographData,
      motionData,
      location,
      displayedGridMode,
      rotationDegrees: 0,
    };
  }

  const canonicalMotions = Object.fromEntries(
    Object.entries(pictographData.motions).map(([color, motion]) => [
      color,
      motion ? toDiamondMotion(motion) : undefined,
    ])
  ) as PictographData["motions"];
  const canonicalMotion = toDiamondMotion(motionData);
  canonicalMotions[motionData.color] = canonicalMotion;

  return {
    pictographData: {
      ...pictographData,
      gridMode: GridMode.DIAMOND,
      motions: canonicalMotions,
    },
    motionData: canonicalMotion,
    location: location
      ? (rotateLocation(location, -1) as GridLocation)
      : undefined,
    displayedGridMode,
    rotationDegrees: BOX_FRAME_ROTATION_DEGREES,
  };
}

/** Rotate a canonical diamond screen vector into the displayed grid. */
export function rotatePlacementVectorToDisplayed(
  vector: PlacementVector,
  rotationDegrees: 0 | 45
): PlacementVector {
  if (rotationDegrees === 0) return { x: vector.x, y: vector.y };
  const [x, y] = applyRotationMatrix(vector.x, vector.y, rotationDegrees);
  return { x, y };
}

/** Rotate a canonical arrow-glyph angle into the displayed grid. */
export function rotatePlacementAngleToDisplayed(
  angleDegrees: number,
  rotationDegrees: 0 | 45
): number {
  return (((angleDegrees + rotationDegrees) % 360) + 360) % 360;
}

/**
 * WASD deltas are requested in visible screen space. Undo the box presentation
 * rotation before the diamond directional-tuple inverse is applied.
 */
export function rotateScreenVectorToCanonical(
  vector: PlacementVector,
  rotationDegrees: 0 | 45
): PlacementVector {
  if (rotationDegrees === 0) return { x: vector.x, y: vector.y };
  const [x, y] = applyRotationMatrix(vector.x, vector.y, -rotationDegrees);
  return { x, y };
}

function toDiamondMotion(motion: MotionData): MotionData {
  return {
    ...motion,
    gridMode: GridMode.DIAMOND,
    startLocation: rotateLocation(motion.startLocation, -1) as GridLocation,
    endLocation: rotateLocation(motion.endLocation, -1) as GridLocation,
    arrowLocation: rotateLocation(motion.arrowLocation, -1) as GridLocation,
  };
}
