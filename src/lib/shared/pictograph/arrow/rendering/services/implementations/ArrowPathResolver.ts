/**
 * Arrow Path Resolution Service
 *
 * Resolves motion data to symbol IDs in the arrow sprite.
 * The sprite file is located at /images/arrows-sprite.svg
 *
 * Symbol naming convention: {motionType}_{turns}_{orientation}[_skew+/-]
 * Examples: pro_0.0_radial, anti_1.5_nonradial, dash_2.0_radial_skew+
 */

import type { IArrowPathResolver } from "../contracts/IArrowPathResolver";
import type { MotionData } from "../../../../shared/domain/models/MotionData";
import {
  MotionType,
  Orientation,
  HandPath,
} from "../../../../shared/domain/enums/pictograph-enums";
import type { ArrowPlacementData } from "../../../positioning/placement/domain/ArrowPlacementData";

/** Path to the consolidated arrow sprite file */
export const ARROW_SPRITE_PATH = "/images/arrows-sprite.svg";

export class ArrowPathResolver implements IArrowPathResolver {
  /**
   * Get arrow symbol ID based on motion type and properties
   */
  getArrowPath(
    arrowData: ArrowPlacementData,
    motionData: MotionData
  ): string | null {
    return this.getArrowSymbolId(motionData);
  }

  /**
   * Get the correct arrow symbol ID based on motion data
   */
  getArrowSvgPath(motionData: MotionData | undefined): string {
    return this.getArrowSymbolId(motionData);
  }

  /**
   * Get the symbol ID for an arrow based on motion data
   *
   * @returns Symbol ID like "pro_0.0_radial" or "float"
   */
  getArrowSymbolId(motionData: MotionData | undefined): string {
    if (!motionData) {
      return "static_0.5_radial";
    }

    const motionType = motionData.motionType;

    // Float is a special case - single symbol
    if (motionType === MotionType.FLOAT) {
      return "float";
    }

    // Determine orientation from start orientation
    const startOrientation = motionData.startOrientation;
    const orientation =
      startOrientation === Orientation.IN ||
      startOrientation === Orientation.OUT
        ? "radial"
        : "nonradial";

    // Format turns value
    const turnsVal = motionData.turns;
    let turnsStr: string;
    if (turnsVal === "fl") {
      turnsStr = "fl";
    } else if (typeof turnsVal === "number") {
      turnsStr = turnsVal % 1 === 0 ? `${turnsVal}.0` : turnsVal.toString();
    } else {
      turnsStr = "0.0";
    }

    // Determine skew suffix based on skewSteps and handPath
    // skewSteps > 0 means motion crossed grid boundary (cardinal <-> intercardinal)
    // handPath CW = skew+, handPath CCW = skew-
    let skewSuffix = "";
    if (motionData.skewSteps && motionData.skewSteps > 0 && motionData.handPath) {
      skewSuffix =
        motionData.handPath === HandPath.CLOCKWISE ? "_skew+" : "_skew-";
    }

    // Build symbol ID: {motionType}_{turns}_{orientation}[_skew+/-]
    return `${motionType}_${turnsStr}_${orientation}${skewSuffix}`;
  }
}
