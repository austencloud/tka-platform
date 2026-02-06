import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { DetectionFrame } from "../../domain/models/DetectionFrame";

export interface OrientationState {
  blueOrientation: Orientation | null;
  redOrientation: Orientation | null;
  isLocked: boolean;
  confidence: number;
}

export interface IOrientationTracker {
  lockStartingOrientation(
    expectedBlue: Orientation,
    expectedRed: Orientation,
    initialFrame: DetectionFrame
  ): void;
  updateWithFrame(frame: DetectionFrame): OrientationState;
  markOrientationLost(color: "blue" | "red"): void;
  reset(): void;
  readonly currentState: OrientationState;
}
