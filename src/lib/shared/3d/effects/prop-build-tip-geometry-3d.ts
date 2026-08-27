import { PropType } from "@austencloud/scene-3d";
import {
  FAN_TIP_POINTS,
  QUIAD_TIP_POINTS,
  TRIAD_TIP_POINTS,
  type PropTipConfig,
} from "$lib/shared/animation-engine/domain/types/prop-tip-points";
import type { PropTipAnchor3D } from "./prop-tip-geometry-3d";

export interface PropBuildTipGeometry3D {
  readonly fanBuild: "pictograph" | "fire" | "day";
  readonly finish: "fire" | "day";
}

/**
 * Measured wick centres from `scripts/assets/doodlegrip-fire-reference.json`,
 * authored into the model by `scripts/build-fan-model.py`. These are absolute
 * metres because the fire GLB is a fixed physical object.
 */
export const FAN_FIRE_WICK_CENTERS_M = [
  { x: -0.2217705, y: 0.10651613, z: 0 },
  { x: -0.13347299, y: 0.20877161, z: 0 },
  { x: 0, y: 0.25363129, z: 0 },
  { x: 0.13347299, y: 0.20877161, z: 0 },
  { x: 0.2217705, y: 0.10651613, z: 0 },
] as const;

const TIP_POINT_SPACE = 252.8;
const DAY_FAN_WIDTH_M = 0.51;
const DAY_FAN_HEIGHT_M = 0.35;

function scalingAnchors(
  config: PropTipConfig,
  alongScale: number,
  acrossScale = alongScale
): PropTipAnchor3D[] {
  return config.points.map(({ dx, dy }) => ({
    effectTipIndex: 1,
    offset: { x: dy * acrossScale, y: dx * alongScale, z: 0 },
  }));
}

export function resolveBuildTipAnchors3D(
  propType: string | undefined,
  staffLength: number,
  build: PropBuildTipGeometry3D
): PropTipAnchor3D[] | null {
  if (propType === PropType.FAN) {
    if (build.fanBuild === "fire") {
      return FAN_FIRE_WICK_CENTERS_M.map((offset) => ({
        effectTipIndex: 1,
        offset: { ...offset },
      }));
    }
    if (build.fanBuild === "day") {
      // No measured rib-apex set exists. This scales the pictograph silhouette
      // to the Day fan's fixed 51 x 35 cm envelope; it is derived, not measured.
      return scalingAnchors(
        FAN_TIP_POINTS,
        DAY_FAN_HEIGHT_M / TIP_POINT_SPACE,
        DAY_FAN_WIDTH_M / TIP_POINT_SPACE
      );
    }
    return scalingAnchors(FAN_TIP_POINTS, staffLength / TIP_POINT_SPACE);
  }

  if (propType === PropType.TRIAD) {
    return scalingAnchors(TRIAD_TIP_POINTS, staffLength / TIP_POINT_SPACE);
  }
  if (propType === PropType.QUIAD) {
    return scalingAnchors(QUIAD_TIP_POINTS, staffLength / TIP_POINT_SPACE);
  }

  return null;
}
