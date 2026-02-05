import type {
  PictographData,
  MotionData,
  ArrowPlacementData,
} from "@tka/types";
import type { Point } from "../../../../domain/Point";

export interface IArrowDataProcessor {
  getMotionFromPictograph(
    arrowColor: string,
    pictographData: PictographData
  ): MotionData | undefined;

  ensureValidPosition(initialPosition: Point): Point;

  extractAdjustmentValues(adjustment: Point | number): [number, number];

  updateArrowInPictograph(
    pictographData: PictographData,
    color: string,
    updates: Partial<ArrowPlacementData>,
    motionUpdates?: Partial<MotionData>
  ): PictographData;

  validateArrowData(arrowData: ArrowPlacementData): boolean;

  validateMotionData(motion: MotionData): boolean;

  validatePictographData(pictographData: PictographData): boolean;

  extractArrowColors(pictographData: PictographData): string[];

  getArrowByColor(
    pictographData: PictographData,
    color: string
  ): ArrowPlacementData | undefined;

  hasMotionData(pictographData: PictographData, color: string): boolean;

  clonePictographData(pictographData: PictographData): PictographData;
}
