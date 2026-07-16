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
import { HALF_ASSET_TURNS } from "./half-asset-manifest";

/**
 * Halved-motion glyphs are TURNS-SPECIFIC, like the regular per-turn arrow
 * files: the guide draws a different halfway arc for a 1-turn and a 2-turn
 * motion (proven by scripts/half-glyph-parity.mjs). Coverage is PER MOTION
 * TYPE (see half-asset-manifest.ts, generated from the files on disk);
 * anything without a dedicated `{mt}_half_{turns}.svg` falls back to the bare
 * `{mt}_half.svg`.
 */
function halfArrowPath(motionData: MotionData): string {
  const mt = motionData.motionType;
  const turns = motionData.turns;
  const hasArt = HALF_ASSET_TURNS[mt]?.has(turns as number | "fl") ?? false;
  const suffix = !hasArt
    ? ""
    : turns === "fl"
      ? "_fl"
      : `_${(turns as number).toFixed(1)}`;
  return `/images/arrows/${mt}_half/from_radial/${mt}_half${suffix}.svg`;
}

/**
 * Get arrow SVG path based on motion type and properties (extracted from Arrow.svelte)
 */
export function getArrowPath(
  arrowData: ArrowPlacementData,
  motionData: MotionData
): string | null {
  const { motionType, turns } = motionData;

  // Half-motion arrows live in a dedicated asset dir, one file per halvable
  // turns value (see halfArrowPath). No skew variant.
  if (motionData.segment) {
    return halfArrowPath(motionData);
  }

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

  if (motionData.segment) {
    return halfArrowPath(motionData);
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
