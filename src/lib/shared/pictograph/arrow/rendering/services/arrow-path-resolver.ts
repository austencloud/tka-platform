/**
 * Arrow Path Resolution Service
 *
 * Responsible for determining the correct SVG file path based on motion data.
 */

import type { MotionData } from "../../../shared/domain/models/motion-data";
import {
  MotionType,
  Orientation,
  SkewDirection,
} from "../../../shared/domain/enums/pictograph-enums";
import type { ArrowPlacementData } from "../../positioning/placement/domain/arrow-placement-data";

/**
 * Get arrow SVG path based on motion type and properties (extracted from Arrow.svelte)
 */
export function getArrowPath(
  arrowData: ArrowPlacementData,
  motionData: MotionData
): string | null {
  const { motionType, turns } = motionData;
  const baseDir = `/images/arrows/${motionType}`;

  if (
    motionType === MotionType.PRO ||
    motionType === MotionType.ANTI ||
    motionType === MotionType.STATIC ||
    motionType === MotionType.DASH
  ) {
    const isNonRadial =
      motionData.startOrientation === Orientation.CLOCK ||
      motionData.startOrientation === Orientation.COUNTER;

    const subDir = isNonRadial ? "from_nonradial" : "from_radial";
    const turnValue = typeof turns === "number" ? turns.toFixed(1) : "0.0";

    let skewSuffix = "";
    if (
      motionData.skewSteps &&
      motionData.skewSteps > 0 &&
      motionData.skewDir &&
      (motionType === MotionType.PRO || motionType === MotionType.ANTI)
    ) {
      skewSuffix = motionData.skewDir === SkewDirection.PLUS ? "_skew+" : "_skew-";
    }

    return `${baseDir}/${subDir}/${motionType}_${turnValue}${skewSuffix}.svg`;
  }

  return `${baseDir}.svg`;
}

/**
 * Get the correct arrow SVG path based on motion data (optimized version)
 */
export function getArrowSvgPath(motionData: MotionData | undefined): string {
  if (!motionData) {
    return "/images/arrows/static/from_radial/static_0.svg";
  }

  const motionType = motionData.motionType;
  const turnsVal = motionData.turns;
  const startOrientation = motionData.startOrientation;

  if (motionType === MotionType.FLOAT) {
    return "/images/arrows/float.svg";
  }

  const radialPath =
    startOrientation === Orientation.IN || startOrientation === Orientation.OUT
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
