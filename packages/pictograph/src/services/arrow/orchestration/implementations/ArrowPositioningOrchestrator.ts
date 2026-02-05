/**
 * Arrow Positioning Orchestrator
 *
 * Main implementation of the arrow positioning pipeline.
 * Coordinates with other services to compute final arrow positions.
 */

import type {
  ArrowPlacementData,
  GridMode,
  MotionData,
  PictographData,
} from "@tka/types";
import type { IArrowLocationCalculator } from "../../positioning/contracts/IArrowLocationCalculator";
import type { IArrowRotationCalculator } from "../../positioning/contracts/IArrowRotationCalculator";
import type { IArrowAdjustmentCalculator } from "../../positioning/contracts/IArrowAdjustmentCalculator";
import type { IArrowGridCoordinator } from "../contracts/IArrowGridCoordinator";
import type { IArrowDataProcessor } from "../contracts/IArrowDataProcessor";
import type { IArrowPositioningOrchestrator } from "../contracts/IArrowPositioningOrchestrator";

export class ArrowPositioningOrchestrator
  implements IArrowPositioningOrchestrator
{
  constructor(
    private locationCalculator: IArrowLocationCalculator,
    private rotationCalculator: IArrowRotationCalculator,
    private adjustmentCalculator: IArrowAdjustmentCalculator,
    private coordinateSystem: IArrowGridCoordinator,
    private dataProcessor: IArrowDataProcessor
  ) {}

  async calculateArrowPoint(
    pictographData: PictographData,
    motionData: MotionData,
    gridMode?: GridMode
  ): Promise<[number, number, number]> {
    try {
      const motion = motionData;
      if (!motion) {
        const center = this.coordinateSystem.getSceneCenter();
        return [center.x, center.y, 0];
      }

      const location = this.locationCalculator.calculateLocation(
        motion,
        pictographData
      );
      const initialPosition = this.coordinateSystem.getInitialPosition(
        motion,
        location,
        gridMode
      );

      const validPosition =
        this.dataProcessor.ensureValidPosition(initialPosition);

      const rotation = await this.rotationCalculator.calculateRotation(
        motion,
        location,
        pictographData
      );

      const adjustment = await this.adjustmentCalculator.calculateAdjustment(
        pictographData,
        motion,
        pictographData.letter || "A",
        location,
        motion.color
      );

      const [adjustmentX, adjustmentY] =
        this.dataProcessor.extractAdjustmentValues(adjustment);

      const finalX = validPosition.x + adjustmentX;
      const finalY = validPosition.y + adjustmentY;

      return [finalX, finalY, rotation];
    } catch (error) {
      console.error("Arrow positioning calculation failed:", error);
      const center = this.coordinateSystem.getSceneCenter();
      return [center.x, center.y, 0];
    }
  }

  async calculateAllArrowPoints(
    pictographData: PictographData
  ): Promise<PictographData> {
    try {
      if (!pictographData.motions) {
        return pictographData;
      }

      let updatedPictograph = { ...pictographData };

      for (const color of Object.keys(pictographData.motions)) {
        const motionData =
          pictographData.motions[color as keyof typeof pictographData.motions];
        const arrowData = motionData?.arrowPlacementData;
        if (arrowData && motionData) {
          const calculatedLocation = this.locationCalculator.calculateLocation(
            motionData,
            updatedPictograph
          );

          const [x, y, rotation] = await this.calculateArrowPoint(
            updatedPictograph,
            motionData
          );

          const currentMotionData =
            updatedPictograph.motions[
              color as keyof typeof updatedPictograph.motions
            ];
          const shouldMirror = this.shouldMirrorArrow(
            arrowData,
            updatedPictograph,
            currentMotionData
          );

          const manualAdjustX = arrowData.manualAdjustmentX || 0;
          const manualAdjustY = arrowData.manualAdjustmentY || 0;

          const updates: Partial<ArrowPlacementData> = {
            positionX: x + manualAdjustX,
            positionY: y + manualAdjustY,
            rotationAngle: rotation,
            svgMirrored: shouldMirror,
            manualAdjustmentX: manualAdjustX,
            manualAdjustmentY: manualAdjustY,
          };

          const motionUpdates = {
            arrowLocation: calculatedLocation,
          } as unknown as Partial<MotionData>;

          updatedPictograph = this.dataProcessor.updateArrowInPictograph(
            updatedPictograph,
            color,
            updates,
            motionUpdates
          );
        }
      }

      return updatedPictograph;
    } catch (error) {
      console.error("Failed to calculate all arrow positions:", error);
      return pictographData;
    }
  }

  shouldMirrorArrow(
    _arrowData: ArrowPlacementData,
    pictographData?: PictographData,
    motionData?: MotionData
  ): boolean {
    if (!pictographData?.motions || !motionData) {
      return false;
    }

    const motionType = motionData.motionType.toLowerCase();
    const propRotDir = motionData.rotationDirection.toLowerCase();

    if (!motionType || !propRotDir) {
      return false;
    }

    const mirrorConditions = {
      anti: { cw: true, ccw: false },
      other: { cw: false, ccw: true },
    };

    const conditionKey = motionType === "anti" ? "anti" : "other";
    const shouldMirror =
      mirrorConditions[conditionKey][
        propRotDir as keyof typeof mirrorConditions.anti
      ] ?? false;

    return shouldMirror;
  }

  applyMirrorTransform(
    arrowItem: HTMLElement | SVGElement,
    shouldMirror: boolean
  ): void {
    if (shouldMirror) {
      arrowItem.style.transform = `${arrowItem.style.transform || ""} scaleX(-1)`;
    } else {
      const transform = arrowItem.style.transform || "";
      arrowItem.style.transform = transform
        .replace(/scaleX\(-1\)\s*/g, "")
        .trim();
    }
  }
}
