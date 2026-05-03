/**
 * Arrow Positioning Orchestrator
 *
 * Main implementation of the arrow positioning pipeline.
 * Coordinates with other services to compute final arrow positions.
 */

import type { ArrowAdjustmentCalculator } from "../../../positioning/calculation/services/implementations/ArrowAdjustmentCalculator";
import type { ArrowLocationCalculator } from "../../../positioning/calculation/services/implementations/ArrowLocationCalculator";
import type { ArrowPlacementData } from "../../../positioning/placement/domain/ArrowPlacementData";
import type { MotionData } from "../../../../shared/domain/models/MotionData";
import type { PictographData } from "../../../../shared/domain/models/PictographData";
import type { ArrowRotationCalculator } from "../../../positioning/calculation/services/implementations/ArrowRotationCalculator";
import type { ArrowDataProcessor } from "./ArrowDataProcessor";
import type { ArrowGridCoordinator } from "./ArrowGridCoordinator";
import type { GridMode } from "../../../../grid/domain/enums/grid-enums";

export class ArrowPositioningOrchestrator {
  constructor(
    private locationCalculator: ArrowLocationCalculator,
    private rotationCalculator: ArrowRotationCalculator,
    private adjustmentCalculator: ArrowAdjustmentCalculator,
    private coordinateSystem: ArrowGridCoordinator,
    private dataProcessor: ArrowDataProcessor
  ) {}

  async calculateArrowPoint(
    pictographData: PictographData,
    motionData: MotionData,
    gridMode?: GridMode
  ): Promise<[number, number, number]> {
    /**
     * Calculate arrow position asynchronously with full service coordination.
     * @param gridMode Optional grid mode - if provided, used for positioning instead of motion.gridMode
     */
    try {
      const motion = motionData;
      if (!motion) {
        console.warn(
          "🚫 ArrowPositioningOrchestrator: No motion data provided, using scene center"
        );
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

  async updateArrowPosition(
    pictographData: PictographData,
    color: string,
    _motionData?: MotionData
  ): Promise<PictographData> {
    /**
     * Update arrow position in pictograph data.
     */
    try {
      const motionData =
        pictographData.motions[color as keyof typeof pictographData.motions];
      const arrowData = motionData?.arrowPlacementData;
      if (!arrowData || !motionData) {
        console.warn(`No arrow data found for color: ${color}`);
        return pictographData;
      }

      const [x, y, rotation] = await this.calculateArrowPoint(
        pictographData,
        motionData
      );

      const shouldMirror = this.shouldMirrorArrow(arrowData, pictographData);

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
        arrowLocation: location,
      } as unknown as Partial<MotionData>;

      return this.dataProcessor.updateArrowInPictograph(
        pictographData,
        color,
        updates,
        motionUpdates
      );
    } catch (error) {
      console.error("Arrow position update failed:", error);
      return pictographData;
    }
  }

  async calculateAllArrowPoints(
    pictographData: PictographData
  ): Promise<PictographData> {
    /**
     * Calculate positions for all arrows in the pictograph.
     */
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
    /**
     * Determine if arrow should be mirrored based on motion type and prop rotation direction.
     *
     * Mirror conditions (matching desktop logic):
     * - Anti motion + clockwise → Mirror = True
     * - Anti motion + counterclockwise → Mirror = False
     * - Pro motion + clockwise → Mirror = False
     * - Pro motion + counterclockwise → Mirror = True
     * - Other motions follow "pro" rules
     */

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
    /**
     * Apply mirror transformation to arrow graphics item.
     */
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

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of arrowPositioningOrchestrator to avoid DI container rebuilds.
// ============================================================================

import { arrowLocationCalculator } from "../../../positioning/calculation/services/implementations/ArrowLocationCalculator";
import { arrowRotationCalculator } from "../../../positioning/calculation/services/implementations/ArrowRotationCalculator";
import { arrowAdjustmentCalculator } from "../../../positioning/calculation/services/implementations/ArrowAdjustmentCalculator";
import { arrowGridCoordinator } from "./ArrowGridCoordinator";
import { arrowDataProcessor } from "./ArrowDataProcessor";


export const arrowPositioningOrchestrator = new ArrowPositioningOrchestrator(
  arrowLocationCalculator,
  arrowRotationCalculator,
  arrowAdjustmentCalculator,
  arrowGridCoordinator,
  arrowDataProcessor
);
