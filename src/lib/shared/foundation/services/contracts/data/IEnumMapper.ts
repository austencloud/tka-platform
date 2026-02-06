/**
 * Enum Mapping Service Interface
 *
 * Interface for centralized enum mapping utilities.
 * Handles conversion between string values and domain enums.
 */

import type {
  GridLocation,
  GridPosition,
} from "../../../../pictograph/grid/domain/enums/grid-enums";
import type {
  MotionType,
  Orientation,
  RotationDirection,
} from "../../../../pictograph/shared/domain/enums/pictograph-enums";

export interface IEnumMapper {
  mapMotionType(motionType: string): MotionType;
  mapLocation(location: string): GridLocation;
  mapOrientation(orientation: string): Orientation;
  mapRotationDirection(rotationDirection: string): RotationDirection;
  convertToGridPosition(
    positionString: string | null | undefined
  ): GridPosition | null;
  normalizeMotionType(motionType: string): string;
  normalizeLocation(location: string): string;
  normalizeTurns(turns: number | string): number;
}
