/**
 * Arrow Path Resolution Service
 *
 * Responsible for determining the correct SVG file path based on motion data.
 */

import type { MotionData } from "../../../shared/domain/models/motion-data";
import { MotionType } from "../../../shared/domain/enums/pictograph-enums";
import type { ArrowPlacementData } from "../../positioning/placement/domain/arrow-placement-data";
import { HALF_ASSET_TURNS } from "./half-asset-manifest";
import { resolveFullArrowAssetPath } from "@tka/render-core";

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

function fullArrowPath(motionData: MotionData): string {
  const skewDirection =
    motionData.skewDir === "+"
      ? "+"
      : motionData.skewDir === "-"
        ? "-"
        : undefined;
  return `/${resolveFullArrowAssetPath({
    motionType: motionData.motionType,
    startOrientation: motionData.startOrientation,
    turns: motionData.turns,
    skewSteps: motionData.skewSteps ?? undefined,
    skewDirection,
  })}`;
}

/**
 * Get arrow SVG path based on motion type and properties (extracted from Arrow.svelte)
 */
export function getArrowPath(
  arrowData: ArrowPlacementData,
  motionData: MotionData
): string | null {
  const { motionType } = motionData;

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
    return fullArrowPath(motionData);
  }

  return `${baseDir}.svg`;
}

/**
 * Get the correct arrow SVG path based on motion data (optimized version)
 */
export function getArrowSvgPath(motionData: MotionData | undefined): string {
  if (!motionData) {
    // Turn values are written with `toFixed(1)`, so every asset on disk is
    // `static_0.0.svg`. This fallback said `static_0.svg` and had resolved to
    // a 404 for as long as it has existed — it only fires when motionData is
    // missing, so nothing ever exercised it.
    return "/images/arrows/static/from_radial/static_0.0.svg";
  }

  const motionType = motionData.motionType;
  if (motionType === MotionType.FLOAT) {
    return "/images/arrows/float.svg";
  }

  if (motionData.segment) {
    return halfArrowPath(motionData);
  }

  return fullArrowPath(motionData);
}
