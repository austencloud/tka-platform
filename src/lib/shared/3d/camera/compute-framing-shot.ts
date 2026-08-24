/**
 * General-purpose camera framing for 1..N performers.
 *
 * Computes eye + target positions that guarantee all performers (plus
 * prop extent + padding) fit inside the vertical frustum for a given
 * FOV. Works for wall, wheel, and floor planes.
 *
 * Unlike the shots.ts helpers in camera-choreography (which take full
 * AvatarInstanceState objects), this accepts plain {x, z} positions so
 * it can be used anywhere — quiz stages, previews, thumbnails — without
 * depending on the full avatar system.
 */

import { userProportionsState } from "@austencloud/scene-3d";

export type FramingPlane = "wall" | "wheel" | "floor";

export interface FramingOptions {
  performers: { x: number; z: number }[];
  plane: FramingPlane;
  groundOffset: number;
  fovDeg?: number;
  /** Width divided by height for the actual canvas viewport. */
  aspectRatio?: number;
  paddingMult?: number;
  elevationDeg?: number;
}

export interface FramingShot {
  eye: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

const PER_PERFORMER_EXTENT = 1.2;
const DEFAULT_FOV_DEG = 50;
const DEFAULT_PADDING = 1.15;
const DEFAULT_ELEVATION_DEG = 0;
const MIN_DIST = 2.0;

export function computeFramingShot(opts: FramingOptions): FramingShot {
  const {
    performers,
    plane,
    groundOffset,
    fovDeg = DEFAULT_FOV_DEG,
    aspectRatio = 1,
    paddingMult = DEFAULT_PADDING,
    elevationDeg = DEFAULT_ELEVATION_DEG,
  } = opts;

  const halfFovRad = ((fovDeg / 2) * Math.PI) / 180;
  const safeAspectRatio = Math.max(0.1, aspectRatio);
  const horizontalHalfFovRad = Math.atan(
    Math.tan(halfFovRad) * safeAspectRatio
  );

  // Rig origin sits at y = groundOffset (shoulder height).
  // Feet are absGroundY below that; props extend above.
  const absGroundY = -userProportionsState.groundY;
  const feetY = groundOffset - absGroundY;
  const topY = groundOffset + PER_PERFORMER_EXTENT;

  // Target at geometric center of the performer bounding box
  const centerY = (feetY + topY) / 2;
  const performerHalfHeight = (topY - feetY) / 2;

  // Group center in XZ
  let cx = 0;
  let cz = 0;
  if (performers.length > 0) {
    for (const p of performers) {
      cx += p.x;
      cz += p.z;
    }
    cx /= performers.length;
    cz /= performers.length;
  }

  // Horizontal group radius: farthest performer from center + prop extent
  let maxDist = 0;
  for (const p of performers) {
    const d = Math.hypot(p.x - cx, p.z - cz);
    if (d > maxDist) maxDist = d;
  }
  const horizontalRadius = maxDist + PER_PERFORMER_EXTENT;

  // Fit both axes against their actual frustum. Portrait canvases have a much
  // narrower horizontal FOV than their vertical FOV; treating them as square
  // silently pushes the outer performers off-screen.
  const verticalDistance =
    (performerHalfHeight * paddingMult) / Math.tan(halfFovRad);
  const horizontalDistance =
    (horizontalRadius * paddingMult) / Math.tan(horizontalHalfFovRad);
  const dist = Math.max(MIN_DIST, verticalDistance, horizontalDistance);

  const elevationRad = (elevationDeg * Math.PI) / 180;
  const horizDist = dist * Math.cos(elevationRad);
  const elevY = dist * Math.sin(elevationRad);

  // When elevated, the tilted frustum sees less above the look direction
  // than below. Shift target up so the AABB is visually centered.
  let adjustedCenterY = centerY;
  if (elevationDeg > 0) {
    const tanTop = Math.tan(halfFovRad - elevationRad);
    const tanBot = Math.tan(halfFovRad + elevationRad);
    adjustedCenterY = centerY + (horizDist * (tanBot - tanTop)) / 2 - elevY;
  }

  const target = { x: cx, y: adjustedCenterY, z: cz };

  switch (plane) {
    case "wall":
      return {
        eye: { x: cx, y: adjustedCenterY + elevY, z: cz - horizDist },
        target,
      };
    case "wheel":
      return {
        eye: { x: cx + horizDist, y: adjustedCenterY + elevY, z: cz },
        target,
      };
    case "floor":
      return {
        eye: { x: cx, y: adjustedCenterY + dist, z: cz },
        target,
      };
  }
}
