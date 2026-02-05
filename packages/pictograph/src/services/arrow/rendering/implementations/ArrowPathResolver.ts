import type { IArrowPathResolver } from "../contracts/IArrowPathResolver";
import {
  MotionType,
  Orientation,
  SkewDirection,
} from "@tka/types";
import type { ArrowPlacementData, MotionData } from "@tka/types";

export class ArrowPathResolver implements IArrowPathResolver {
  constructor(private readonly assetBasePath: string = "") {}

  getArrowPath(
    arrowData: ArrowPlacementData,
    motionData: MotionData
  ): string | null {
    const { motionType, turns } = motionData;
    const baseDir = `${this.assetBasePath}/images/arrows/${motionType}`;

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

  getArrowSvgPath(motionData: MotionData | undefined): string {
    const base = this.assetBasePath;

    if (!motionData) {
      return `${base}/images/arrows/static/from_radial/static_0.svg`;
    }

    const motionType = motionData.motionType;
    const turnsVal = motionData.turns;
    const startOrientation = motionData.startOrientation;

    if (motionType === MotionType.FLOAT) {
      return `${base}/images/arrows/float.svg`;
    }

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

    let skewSuffix = "";
    if (
      motionData.skewSteps &&
      motionData.skewSteps > 0 &&
      motionData.skewDir &&
      (motionType === MotionType.PRO || motionType === MotionType.ANTI)
    ) {
      skewSuffix = motionData.skewDir === SkewDirection.PLUS ? "_skew+" : "_skew-";
    }

    return `${base}/images/arrows/${motionType}/${radialPath}/${motionType}_${turnsStr}${skewSuffix}.svg`;
  }
}

export const arrowPathResolver = new ArrowPathResolver();
