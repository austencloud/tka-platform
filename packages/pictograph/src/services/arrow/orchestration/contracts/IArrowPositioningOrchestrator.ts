import type {
  PictographData,
  MotionData,
  ArrowPlacementData,
  GridMode,
} from "@tka/types";

export interface IArrowPositioningOrchestrator {
  calculateArrowPoint(
    pictographData: PictographData,
    motionData?: MotionData,
    gridMode?: GridMode
  ): Promise<[number, number, number]>;

  calculateAllArrowPoints(
    pictographData: PictographData
  ): Promise<PictographData>;

  shouldMirrorArrow(
    arrowData: ArrowPlacementData,
    pictographData?: PictographData,
    motionData?: MotionData
  ): boolean;

  applyMirrorTransform(
    arrowItem: HTMLElement | SVGElement,
    shouldMirror: boolean
  ): void;
}
