import type { IArrowLocationCalculator } from "../contracts/IArrowLocationCalculator";
import { GridLocation, MotionType } from "@tka/types";
import type { MotionData, PictographData } from "@tka/types";
import type { DashLocationCalculator } from "./DashLocationCalculator";

/**
 * Arrow Location Calculator Service
 *
 * Pure algorithmic service for calculating arrow locations based on motion data.
 * Handles static, shift (PRO/ANTI/FLOAT), and dash motion types.
 */
export class ArrowLocationCalculator implements IArrowLocationCalculator {
  private readonly shiftDirectionPairs: Record<string, GridLocation> = {
    // Cardinal + Adjacent Cardinal combinations (normal shifts)
    [this.pairKey([GridLocation.NORTH, GridLocation.EAST])]:
      GridLocation.NORTHEAST,
    [this.pairKey([GridLocation.EAST, GridLocation.SOUTH])]:
      GridLocation.SOUTHEAST,
    [this.pairKey([GridLocation.SOUTH, GridLocation.WEST])]:
      GridLocation.SOUTHWEST,
    [this.pairKey([GridLocation.WEST, GridLocation.NORTH])]:
      GridLocation.NORTHWEST,
    // Adjacent Intercardinal combinations
    [this.pairKey([GridLocation.NORTHEAST, GridLocation.NORTHWEST])]:
      GridLocation.NORTH,
    [this.pairKey([GridLocation.NORTHEAST, GridLocation.SOUTHEAST])]:
      GridLocation.EAST,
    [this.pairKey([GridLocation.SOUTHWEST, GridLocation.SOUTHEAST])]:
      GridLocation.SOUTH,
    [this.pairKey([GridLocation.NORTHWEST, GridLocation.SOUTHWEST])]:
      GridLocation.WEST,
    // SKEWED: cardinal <-> non-adjacent intercardinal
    [this.pairKey([GridLocation.WEST, GridLocation.NORTHEAST])]:
      GridLocation.NORTH,
    [this.pairKey([GridLocation.WEST, GridLocation.SOUTHEAST])]:
      GridLocation.SOUTH,
    [this.pairKey([GridLocation.NORTH, GridLocation.SOUTHEAST])]:
      GridLocation.EAST,
    [this.pairKey([GridLocation.NORTH, GridLocation.SOUTHWEST])]:
      GridLocation.WEST,
    [this.pairKey([GridLocation.EAST, GridLocation.SOUTHWEST])]:
      GridLocation.SOUTH,
    [this.pairKey([GridLocation.EAST, GridLocation.NORTHWEST])]:
      GridLocation.NORTH,
    [this.pairKey([GridLocation.SOUTH, GridLocation.NORTHWEST])]:
      GridLocation.WEST,
    [this.pairKey([GridLocation.SOUTH, GridLocation.NORTHEAST])]:
      GridLocation.EAST,
    // MINUS SKEW: cardinal <-> adjacent intercardinal
    [this.pairKey([GridLocation.NORTH, GridLocation.NORTHEAST])]:
      GridLocation.NORTH,
    [this.pairKey([GridLocation.NORTH, GridLocation.NORTHWEST])]:
      GridLocation.NORTH,
    [this.pairKey([GridLocation.EAST, GridLocation.NORTHEAST])]:
      GridLocation.EAST,
    [this.pairKey([GridLocation.EAST, GridLocation.SOUTHEAST])]:
      GridLocation.EAST,
    [this.pairKey([GridLocation.SOUTH, GridLocation.SOUTHEAST])]:
      GridLocation.SOUTH,
    [this.pairKey([GridLocation.SOUTH, GridLocation.SOUTHWEST])]:
      GridLocation.SOUTH,
    [this.pairKey([GridLocation.WEST, GridLocation.SOUTHWEST])]:
      GridLocation.WEST,
    [this.pairKey([GridLocation.WEST, GridLocation.NORTHWEST])]:
      GridLocation.WEST,
  };

  constructor(private dashLocationService: DashLocationCalculator) {}

  calculateLocation(
    motion: MotionData,
    pictographData: PictographData
  ): GridLocation {
    switch (motion.motionType) {
      case MotionType.STATIC:
        return motion.startLocation;
      case MotionType.PRO:
      case MotionType.ANTI:
      case MotionType.FLOAT:
        return this.calculateShiftLocation(motion);
      case MotionType.DASH:
        return this.calculateDashLocation(motion, pictographData);
    }
  }

  private calculateShiftLocation(motion: MotionData): GridLocation {
    const locationPairKey = this.pairKey([
      motion.startLocation,
      motion.endLocation,
    ]);
    return this.shiftDirectionPairs[locationPairKey] ?? motion.startLocation;
  }

  private calculateDashLocation(
    motion: MotionData,
    pictographData: PictographData
  ): GridLocation {
    const isBlueArrow = this.isBlueArrowMotion(motion, pictographData);
    return this.dashLocationService.calculateDashLocationFromPictographData(
      pictographData,
      isBlueArrow
    );
  }

  getSupportedMotionTypes(): MotionType[] {
    return [
      MotionType.STATIC,
      MotionType.PRO,
      MotionType.ANTI,
      MotionType.FLOAT,
      MotionType.DASH,
    ];
  }

  validateMotionData(motion: MotionData): boolean {
    if (!this.getSupportedMotionTypes().includes(motion.motionType)) {
      return false;
    }
    return true;
  }

  isBlueArrowMotion(
    motion: MotionData,
    pictographData: PictographData
  ): boolean {
    if (pictographData.motions.blue === motion) {
      return true;
    }
    if (pictographData.motions.red === motion) {
      return false;
    }
    console.warn("Could not determine arrow color for motion, assuming blue");
    return true;
  }

  /** Normalized bidirectional key for location pairs */
  private pairKey(locations: GridLocation[]): string {
    const sorted = [...locations].sort();
    return sorted.join(",");
  }
}
