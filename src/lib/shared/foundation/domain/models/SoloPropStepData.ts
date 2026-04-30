import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type {
  MotionType,
  RotationDirection,
  Orientation,
  HandPath,
  SkewDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface SoloPropStepData {
  readonly startLocation: GridLocation;
  readonly endLocation: GridLocation;
  readonly startOrientation: Orientation;
  readonly endOrientation: Orientation;
  readonly motionType: MotionType;
  readonly rotationDirection: RotationDirection;
  readonly turns: number | "fl";
  readonly handPath?: HandPath | null;
  readonly skewSteps?: number | null;
  readonly skewDir?: SkewDirection | null;
  readonly duration: number;
  // When motionType === "float", this holds the original pro/anti type the
  // float collapsed from. Required for letter/turn-color resolution because
  // float motions have noRotation, which destroys the pro-vs-anti signal.
  // prefloatRotationDirection is NOT stored - it is derivable from
  // prefloatMotionType + start/end via HandpathDirectionCalculator.
  readonly prefloatMotionType?: MotionType;
}
