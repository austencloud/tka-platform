/**
 * Fits a curated preset to a specific cast.
 *
 * Distance is derived from a target framing rather than a multiplier, then
 * clamped to the preset's declared range. The clamp is the substantive
 * difference from the bounding-box scaling this replaced: absurd framing is
 * unreachable regardless of how wide or how small the cast is.
 */

import { userProportionsState } from "@austencloud/scene-3d";

import type { DirectorCameraPresetDefinition } from "./director-camera-presets";

/** Horizontal room a performer needs beyond their own position, prop included. */
const PER_PERFORMER_EXTENT = 1.2;

/** A body may fill this much of the frame's height before distance backs off. */
const VERTICAL_FILL_CAP = 0.9;

const ORBIT_SEGMENT_DEGREES = 22;

export interface CastGeometry {
  centerX: number;
  centerZ: number;
  /** Farthest performer from the center, plus prop extent. */
  radiusMeters: number;
  /** Floor-to-prop-tip extent of a single performer. */
  extentMeters: number;
  floorY: number;
}

export interface PresetFitContext {
  aspectRatio: number;
  durationSeconds: number;
}

export interface FittedCameraFrame {
  atSeconds: number;
  position: [number, number, number];
  target: [number, number, number];
  fovDeg: number;
}

export function measureCastGeometry(
  positions: readonly { x: number; z: number }[],
  groundOffset: number
): CastGeometry {
  const count = Math.max(1, positions.length);
  let centerX = 0;
  let centerZ = 0;
  for (const position of positions) {
    centerX += position.x;
    centerZ += position.z;
  }
  centerX /= count;
  centerZ /= count;

  let farthest = 0;
  for (const position of positions) {
    farthest = Math.max(
      farthest,
      Math.hypot(position.x - centerX, position.z - centerZ)
    );
  }

  // groundOffset is the rig ORIGIN (shoulder height); the floor sits
  // groundY below it and props reach PER_PERFORMER_EXTENT above it.
  const shoulderToFloor = -userProportionsState.groundY;
  return {
    centerX,
    centerZ,
    radiusMeters: farthest + PER_PERFORMER_EXTENT,
    extentMeters: shoulderToFloor + PER_PERFORMER_EXTENT,
    floorY: groundOffset + userProportionsState.groundY,
  };
}

function halfFovTangents(
  fovDeg: number,
  aspectRatio: number
): { vertical: number; horizontal: number } {
  const vertical = Math.tan((fovDeg * Math.PI) / 360);
  return {
    vertical,
    horizontal: vertical * Math.max(0.1, aspectRatio),
  };
}

/**
 * Distance at which the cast subtends `fillFraction` of the frame's width,
 * backed off if that would crop the performers' height, then clamped.
 */
export function fitDistance(
  preset: DirectorCameraPresetDefinition,
  cast: CastGeometry,
  aspectRatio: number,
  fillFraction = preset.fillFraction
): number {
  const tangents = halfFovTangents(preset.fovDeg, aspectRatio);
  const horizontal =
    cast.radiusMeters / (Math.max(0.05, fillFraction) * tangents.horizontal);
  const vertical =
    cast.extentMeters / 2 / (VERTICAL_FILL_CAP * tangents.vertical);
  const [minimum, maximum] = preset.distanceRangeMeters;
  return Math.min(maximum, Math.max(minimum, horizontal, vertical));
}

function eyeAt(
  cast: CastGeometry,
  target: [number, number, number],
  azimuthDegrees: number,
  elevationDegrees: number,
  distance: number
): [number, number, number] {
  const azimuth = (azimuthDegrees * Math.PI) / 180;
  const elevation = (elevationDegrees * Math.PI) / 180;
  const horizontal = distance * Math.cos(elevation);
  // Azimuth 0 puts the camera on the -Z side, which is the audience side:
  // a film's default cast faces -Z (see buildResolvedPerformers).
  return [
    cast.centerX + Math.sin(azimuth) * horizontal,
    target[1] + distance * Math.sin(elevation),
    cast.centerZ - Math.cos(azimuth) * horizontal,
  ];
}

export function fitPresetKeyframes(
  preset: DirectorCameraPresetDefinition,
  cast: CastGeometry,
  context: PresetFitContext,
  targetOverride?: [number, number, number]
): FittedCameraFrame[] {
  const target: [number, number, number] = targetOverride ?? [
    cast.centerX,
    cast.floorY + cast.extentMeters * preset.targetHeightFraction,
    cast.centerZ,
  ];
  const distance = fitDistance(preset, cast, context.aspectRatio);
  const end = context.durationSeconds;
  const frame = (
    atSeconds: number,
    position: [number, number, number]
  ): FittedCameraFrame => ({
    atSeconds,
    position,
    target: [...target],
    fovDeg: preset.fovDeg,
  });

  switch (preset.motion.kind) {
    case "hold": {
      // One frame, not a pair: the sampler clamps a static track, and a
      // single keyframe says "this shot does not move" without a reader
      // having to compare two positions to find that out.
      return [
        frame(
          0,
          eyeAt(
            cast,
            target,
            preset.azimuthDegrees,
            preset.elevationDegrees,
            distance
          )
        ),
      ];
    }

    case "dolly": {
      const closeDistance = Math.max(
        preset.distanceRangeMeters[0],
        distance * preset.motion.closeDistanceMultiplier
      );
      return [
        frame(
          0,
          eyeAt(
            cast,
            target,
            preset.azimuthDegrees,
            preset.elevationDegrees,
            distance
          )
        ),
        frame(
          end,
          eyeAt(
            cast,
            target,
            preset.azimuthDegrees,
            preset.elevationDegrees,
            closeDistance
          )
        ),
      ];
    }

    case "descend": {
      return [
        frame(
          0,
          eyeAt(
            cast,
            target,
            preset.azimuthDegrees,
            preset.motion.fromElevationDegrees,
            distance
          )
        ),
        frame(
          end,
          eyeAt(
            cast,
            target,
            preset.azimuthDegrees,
            preset.elevationDegrees,
            distance
          )
        ),
      ];
    }

    case "orbit": {
      const arcDegrees = preset.motion.degrees;
      const segments = Math.max(
        2,
        Math.ceil(Math.abs(arcDegrees) / ORBIT_SEGMENT_DEGREES)
      );
      return Array.from({ length: segments + 1 }, (_, index) => {
        const progress = index / segments;
        return frame(
          end * progress,
          eyeAt(
            cast,
            target,
            preset.azimuthDegrees + arcDegrees * progress,
            preset.elevationDegrees,
            distance
          )
        );
      });
    }
  }
}
