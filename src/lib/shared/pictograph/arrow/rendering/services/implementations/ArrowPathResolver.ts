/**
 * Arrow Path Resolution Service
 *
 * Responsible for determining the correct SVG file path based on motion data.
 * Extracted from ArrowRenderer to improve modularity and reusability.
 */

import type { MotionData } from "../../../../shared/domain/models/MotionData";
import {
  MotionType,
  Orientation,
  SkewDirection,
} from "../../../../shared/domain/enums/pictograph-enums";
import type { ArrowPlacementData } from "../../../positioning/placement/domain/ArrowPlacementData";

export class ArrowPathResolver {
  /**
   * Get arrow SVG path based on motion type and properties (extracted from Arrow.svelte)
   */
  getArrowPath(
    arrowData: ArrowPlacementData,
    motionData: MotionData
  ): string | null {
    const { motionType, turns } = motionData;
    const baseDir = `/images/arrows/${motionType}`;

    // For motion types that have turn-based subdirectories (pro, anti, static, dash)
    if (
      motionType === MotionType.PRO ||
      motionType === MotionType.ANTI ||
      motionType === MotionType.STATIC ||
      motionType === MotionType.DASH
    ) {
      // Determine if we should use radial vs non-radial arrows based on START orientation only
      // "from_radial" = arrow starts from radial orientation (in/out)
      // "from_nonradial" = arrow starts from non-radial orientation (clock/counter)
      const isNonRadial =
        motionData.startOrientation === Orientation.CLOCK ||
        motionData.startOrientation === Orientation.COUNTER;

      const subDir = isNonRadial ? "from_nonradial" : "from_radial";
      const turnValue = typeof turns === "number" ? turns.toFixed(1) : "0.0";

      // Add skew suffix for skewed motions (only PRO and ANTI can be skewed)
      let skewSuffix = "";
      if (
        motionData.skewSteps &&
        motionData.skewSteps > 0 &&
        motionData.skewDir &&
        (motionType === MotionType.PRO || motionType === MotionType.ANTI)
      ) {
        skewSuffix = motionData.skewDir === SkewDirection.PLUS ? "_skew+" : "_skew-";
      }

      const path = `${baseDir}/${subDir}/${motionType}_${turnValue}${skewSuffix}.svg`;

      return path;
    }

    // For float (truly turn-agnostic) - use base directory
    const path = `${baseDir}.svg`;
    return path;
  }

  /**
   * Get the correct arrow SVG path based on motion data (optimized version)
   */
  getArrowSvgPath(motionData: MotionData | undefined): string {
    if (!motionData) {
      return "/images/arrows/static/from_radial/static_0.svg";
    }

    const motionType = motionData.motionType;
    const turnsVal = motionData.turns;
    const startOrientation = motionData.startOrientation;

    if (motionType === MotionType.FLOAT) {
      return "/images/arrows/float.svg";
    }

    // Folder is based on START orientation only ("from_radial" = starts from radial)
    const radialPath =
      startOrientation === Orientation.IN ||
      startOrientation === Orientation.OUT
        ? "from_radial"
        : "from_nonradial";

    let turnsStr: string;
    if (turnsVal === "fl") {
      turnsStr = "fl";
    } else if (typeof turnsVal === "number") {
      turnsStr = turnsVal % 1 === 0 ? `${turnsVal}.0` : turnsVal.toString();
    } else {
      turnsStr = "0.0";
    }

    // Add skew suffix for skewed motions (only PRO and ANTI can be skewed)
    let skewSuffix = "";
    if (
      motionData.skewSteps &&
      motionData.skewSteps > 0 &&
      motionData.skewDir &&
      (motionType === MotionType.PRO || motionType === MotionType.ANTI)
    ) {
      skewSuffix = motionData.skewDir === SkewDirection.PLUS ? "_skew+" : "_skew-";
    }

    return `/images/arrows/${motionType}/${radialPath}/${motionType}_${turnsStr}${skewSuffix}.svg`;
  }
}

// Direct singleton export for HMR-friendly imports
export const arrowPathResolver = new ArrowPathResolver();
