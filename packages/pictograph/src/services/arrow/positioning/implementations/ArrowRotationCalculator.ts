import type { GridLocation, MotionData, PictographData } from "@tka/types";
import { MotionType, Orientation } from "@tka/types";
import type { IArrowRotationCalculator } from "../contracts/IArrowRotationCalculator";
import type {
  ISpecialPlacer,
  IRotationAngleOverrideKeyGenerator,
} from "../../../../utils/arrow/RotationOverrideChecker";
import type { IHandpathDirectionCalculator } from "../contracts/IHandpathDirectionCalculator";
import { dashNoRotationMap } from "../../../../constants/arrow/DashRotationMaps";
import { RotationMapSelector } from "../../../../utils/arrow/RotationMapSelector";
import { RotationOverrideChecker } from "../../../../utils/arrow/RotationOverrideChecker";
import { isNoRotation } from "../../../../utils/arrow/RotationDirectionUtils";

/**
 * Arrow Rotation Calculator Service
 *
 * Pure algorithmic service for calculating arrow rotation angles.
 * Each motion type has its own rotation strategy based on proven algorithms.
 *
 * Optional dependencies (ISpecialPlacer, IRotationAngleOverrideKeyGenerator)
 * allow rotation overrides for specific pictographs when provided.
 */
export class ArrowRotationCalculator implements IArrowRotationCalculator {
  constructor(
    private specialPlacer?: ISpecialPlacer,
    private rotationOverrideKeyGenerator?: IRotationAngleOverrideKeyGenerator,
    private handpathDirectionCalculator?: IHandpathDirectionCalculator
  ) {}

  async calculateRotation(
    motion: MotionData,
    location: GridLocation,
    pictographData?: PictographData
  ): Promise<number> {
    const motionType = motion.motionType.toLowerCase();

    switch (motionType) {
      case "static":
        return await this.calculateStaticRotation(
          motion,
          location,
          pictographData
        );
      case "pro":
        return this.calculateProRotation(motion, location);
      case "anti":
        return this.calculateAntiRotation(motion, location);
      case "dash":
        return await this.calculateDashRotation(
          motion,
          location,
          pictographData
        );
      case "float":
        return this.calculateFloatRotation(motion, location);
      default:
        console.warn(`Unknown motion type: ${motionType}, returning 0.0`);
        return 0.0;
    }
  }

  private async calculateStaticRotation(
    motion: MotionData,
    location: GridLocation,
    pictographData?: PictographData
  ): Promise<number> {
    const startOrientation = motion.startOrientation;
    const endOrientation = motion.endOrientation;
    const rotationDirection = motion.rotationDirection.toLowerCase();

    const isStartRadial =
      startOrientation === Orientation.IN ||
      startOrientation === Orientation.OUT;

    const isEndRadial =
      endOrientation === Orientation.IN || endOrientation === Orientation.OUT;

    const overrideRotation = await this.checkRotationOverride(
      motion,
      location,
      pictographData,
      isEndRadial
    );

    if (overrideRotation !== null) {
      return overrideRotation;
    }

    const rotationMap = RotationMapSelector.selectStaticMap(
      isStartRadial,
      rotationDirection
    );

    return rotationMap[location] || 0.0;
  }

  private calculateProRotation(
    motion: MotionData,
    location: GridLocation
  ): number {
    const rotationMap = RotationMapSelector.selectProMap(
      motion.rotationDirection.toLowerCase()
    );
    return rotationMap[location] || 0.0;
  }

  private calculateAntiRotation(
    motion: MotionData,
    location: GridLocation
  ): number {
    const rotationMap = RotationMapSelector.selectAntiMap(
      motion.rotationDirection.toLowerCase()
    );
    return rotationMap[location] || 0.0;
  }

  private async calculateDashRotation(
    motion: MotionData,
    location: GridLocation,
    pictographData?: PictographData
  ): Promise<number> {
    const rotationDirection = motion.rotationDirection.toLowerCase();
    const endOrientation = motion.endOrientation;

    const isEndRadial =
      endOrientation === Orientation.IN || endOrientation === Orientation.OUT;

    const overrideRotation = await this.checkRotationOverride(
      motion,
      location,
      pictographData,
      isEndRadial
    );

    if (overrideRotation !== null) {
      return overrideRotation;
    }

    if (isNoRotation(rotationDirection)) {
      const key = `${motion.startLocation},${motion.endLocation}`;
      return dashNoRotationMap[key] || 0.0;
    }

    const rotationMap = RotationMapSelector.selectDashMap(rotationDirection);
    return rotationMap[location] || 0.0;
  }

  private calculateFloatRotation(
    motion: MotionData,
    location: GridLocation
  ): number {
    if (!this.handpathDirectionCalculator) {
      console.warn("HandpathDirectionCalculator not available, returning 0.0");
      return 0.0;
    }

    const handpathDirection =
      this.handpathDirectionCalculator.calculateDirection(
        motion.startLocation,
        motion.endLocation
      );

    if (handpathDirection === "cw" || handpathDirection === "ccw") {
      const rotationMap = RotationMapSelector.selectFloatMap(handpathDirection);
      return rotationMap[location] || 0.0;
    }

    return 0.0;
  }

  private async checkRotationOverride(
    motion: MotionData,
    location: GridLocation,
    pictographData: PictographData | undefined,
    isRadial: boolean
  ): Promise<number | null> {
    if (!pictographData) return null;
    if (!this.specialPlacer) return null;
    if (!this.rotationOverrideKeyGenerator) return null;

    return RotationOverrideChecker.checkAndApplyOverride(
      motion,
      location,
      pictographData,
      isRadial,
      this.specialPlacer,
      this.rotationOverrideKeyGenerator
    );
  }

  getSupportedMotionTypes(): MotionType[] {
    return [
      MotionType.STATIC,
      MotionType.PRO,
      MotionType.ANTI,
      MotionType.DASH,
      MotionType.FLOAT,
    ];
  }

  validateMotionData(motion: MotionData): boolean {
    if (!motion) return false;
    const motionType = motion.motionType.toLowerCase();
    if (!this.getSupportedMotionTypes().includes(motionType as MotionType)) {
      return false;
    }
    if (!motion.rotationDirection) return false;
    return true;
  }
}
