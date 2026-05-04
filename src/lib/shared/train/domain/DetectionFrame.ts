import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface DebugLandmarks {
  wrist: { x: number; y: number };
  middleFingerTip: { x: number; y: number };
  palmCenter: { x: number; y: number };
}

export type HandState = "open" | "closed" | "partial";

export interface DetectedPosition {
  quadrant: GridLocation;
  confidence: number;
  rawPosition: { x: number; y: number };
  timestamp: number;
  /** Debug landmarks for visualization */
  debug?: DebugLandmarks;
  /** Whether the hand is open, closed, or partially open */
  handState?: HandState;
}

export interface DetectionFrame {
  timestamp: number;
  blue: DetectedPosition | null;
  red: DetectedPosition | null;
  orientations?: {
    blue?: Orientation;
    red?: Orientation;
  };
  source: DetectionSource;
}

export type DetectionSource = "mediapipe" | "color_markers" | "hybrid";
