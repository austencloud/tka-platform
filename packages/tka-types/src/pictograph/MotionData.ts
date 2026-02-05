import type { ArrowPlacementData } from "./ArrowPlacementData";
import type { PropPlacementData } from "./PropPlacementData";
import type { PropType } from "./PropType";
import type { GridLocation, GridMode } from "./grid-enums";
import type {
  MotionColor,
  MotionType,
  RotationDirection,
  Orientation,
  HandPath,
  SkewDirection,
} from "./pictograph-enums";

export interface MotionData {
  readonly motionType: MotionType;
  readonly rotationDirection: RotationDirection;
  readonly startLocation: GridLocation;
  readonly endLocation: GridLocation;
  readonly turns: number | "fl";
  readonly startOrientation: Orientation;
  readonly endOrientation: Orientation;
  readonly isVisible: boolean;
  readonly propType: PropType;
  readonly arrowLocation: GridLocation;
  readonly color: MotionColor;
  readonly gridMode: GridMode;
  readonly arrowPlacementData: ArrowPlacementData;
  readonly propPlacementData: PropPlacementData;
  readonly prefloatMotionType?: MotionType | null;
  readonly prefloatRotationDirection?: RotationDirection | null;
  readonly handPath?: HandPath | null;
  readonly skewSteps?: number | null;
  readonly skewDir?: SkewDirection | null;
}
