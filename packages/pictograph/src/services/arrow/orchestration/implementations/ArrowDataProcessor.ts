/**
 * Arrow Data Processor
 *
 * Handles data extraction, validation, and manipulation for arrow positioning.
 */

import type {
  ArrowPlacementData,
  MotionData,
  PictographData,
} from "@tka/types";
import { Point } from "../../../../domain/Point";
import type { IArrowGridCoordinator } from "../contracts/IArrowGridCoordinator";
import type { IArrowDataProcessor } from "../contracts/IArrowDataProcessor";

export class ArrowDataProcessor implements IArrowDataProcessor {
  constructor(private coordinateSystem: IArrowGridCoordinator) {}

  getMotionFromPictograph(
    arrowColor: string,
    pictographData: PictographData
  ): MotionData | undefined {
    if (!pictographData.motions) {
      return undefined;
    }
    return pictographData.motions[
      arrowColor as keyof typeof pictographData.motions
    ];
  }

  ensureValidPosition(initialPosition: Point): Point {
    if (
      initialPosition &&
      typeof initialPosition.x === "number" &&
      typeof initialPosition.y === "number"
    ) {
      return initialPosition;
    }
    return this.coordinateSystem.getSceneCenter();
  }

  extractAdjustmentValues(adjustment: Point | number): [number, number] {
    if (typeof adjustment === "number") {
      return [adjustment, adjustment];
    }

    if (adjustment && typeof adjustment === "object") {
      const x = typeof adjustment.x === "number" ? adjustment.x : 0;
      const y = typeof adjustment.y === "number" ? adjustment.y : 0;
      return [x, y];
    }

    return [0.0, 0.0];
  }

  updateArrowInPictograph(
    pictographData: PictographData,
    color: string,
    updates: Partial<ArrowPlacementData>,
    motionUpdates?: Partial<MotionData>
  ): PictographData {
    const updatedPictograph = { ...pictographData };
    const motionKey = color as keyof typeof updatedPictograph.motions;
    const motion = updatedPictograph.motions[motionKey];

    if (motion) {
      updatedPictograph.motions = {
        ...updatedPictograph.motions,
        [motionKey]: {
          ...motion,
          ...motionUpdates,
          arrowPlacementData: {
            ...motion.arrowPlacementData,
            ...updates,
          },
        },
      };
    }

    return updatedPictograph;
  }

  validateArrowData(arrowData: ArrowPlacementData): boolean {
    if (!arrowData) {
      return false;
    }
    return (
      typeof arrowData.positionX === "number" &&
      typeof arrowData.positionY === "number"
    );
  }

  validateMotionData(motionData: MotionData): boolean {
    if (!motionData) {
      return false;
    }
    return (
      typeof motionData.motionType === "string" &&
      motionData.startLocation !== undefined &&
      motionData.endLocation !== undefined
    );
  }

  validatePictographData(pictographData: PictographData): boolean {
    if (!pictographData) {
      return false;
    }
    if (!pictographData.motions || typeof pictographData.motions !== "object") {
      return false;
    }
    const motionColors = Object.keys(pictographData.motions);
    if (motionColors.length === 0) {
      return false;
    }
    for (const color of motionColors) {
      const motion =
        pictographData.motions[color as keyof typeof pictographData.motions];
      if (!motion || typeof motion !== "object" || !motion.arrowPlacementData) {
        return false;
      }
    }
    return true;
  }

  extractArrowColors(pictographData: PictographData): string[] {
    if (!pictographData.motions) {
      return [];
    }
    return Object.keys(pictographData.motions);
  }

  getArrowByColor(
    pictographData: PictographData,
    color: string
  ): ArrowPlacementData | undefined {
    if (!pictographData.motions) {
      return undefined;
    }
    const motion =
      pictographData.motions[color as keyof typeof pictographData.motions];
    return motion?.arrowPlacementData;
  }

  hasMotionData(pictographData: PictographData, color: string): boolean {
    if (!pictographData.motions) {
      return false;
    }
    return color in pictographData.motions;
  }

  clonePictographData(pictographData: PictographData): PictographData {
    return JSON.parse(JSON.stringify(pictographData));
  }
}
