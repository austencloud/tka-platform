/**
 * Camera and terrain presets for the mounted-pose evidence harness.
 *
 * FFS-FID-001 asks for close-up rear, side, and three-quarter frames on level
 * ground and on registered 20 and 35 degree slopes, riding and at rest. The
 * sim's own chase camera sits several metres back and cannot resolve a sole on
 * a pedal, so the framing lives here - pointed at the pedal band rather than
 * at the rider's head.
 */

export const EUC_POSE_VIEW_IDS = ["rear", "side", "quarter", "wide"] as const;
export type EucPoseViewId = (typeof EUC_POSE_VIEW_IDS)[number];

export interface EucPoseView {
  id: EucPoseViewId;
  label: string;
  /** Camera position in world metres, with the wheel contact patch at origin. */
  position: [number, number, number];
  target: [number, number, number];
  fovDegrees: number;
}

/**
 * Framing is centred on y = 0.75 m at a 2.7 m stand-off, which at 32 degrees
 * shows about 1.5 m of height: the ground under the wheel at 0 m through the
 * hips at roughly 1.3 m, with both pedals, both soles, and both knees between
 * them. Closer than this and a hip or a pedal leaves the frame.
 */
const CONTACT_TARGET: [number, number, number] = [0, 0.75, 0];

export const EUC_POSE_VIEWS: Readonly<Record<EucPoseViewId, EucPoseView>> =
  Object.freeze({
    rear: {
      id: "rear",
      label: "Rear",
      position: [0, 0.95, -2.7],
      target: CONTACT_TARGET,
      fovDegrees: 32,
    },
    side: {
      id: "side",
      label: "Side",
      position: [-2.7, 0.95, 0.02],
      target: CONTACT_TARGET,
      fovDegrees: 32,
    },
    /**
     * Swung further toward the rear than a 45-degree three-quarter, because the
     * tyre occludes the far sole at 45 degrees.
     *
     * The sightline from the camera to the far pedal centre (+0.23, 0.277,
     * 0.015) crosses the wheel plane at x = 0. At a 45-degree azimuth it
     * crosses 0.19 m from the wheel centre - inside the 0.363 m tyre, so the
     * far sole and its contact marker are hidden. At this azimuth it crosses
     * 0.43 m out, clearing the tyre, so both soles are visible at once.
     */
    quarter: {
      id: "quarter",
      label: "Three-quarter",
      position: [-1.15, 1.15, -2.65],
      target: CONTACT_TARGET,
      fovDegrees: 32,
    },
    wide: {
      id: "wide",
      label: "Whole rider",
      position: [-2.5, 1.6, -2.5],
      target: [0, 1.05, 0],
      fovDegrees: 40,
    },
  });

export const EUC_POSE_SLOPE_DEGREES = [0, 20, 35] as const;
export type EucPoseSlopeDegrees = (typeof EUC_POSE_SLOPE_DEGREES)[number];

export const EUC_POSE_MOTION_IDS = ["rest", "cruise", "launch", "brake", "carve"] as const;
export type EucPoseMotionId = (typeof EUC_POSE_MOTION_IDS)[number];

export interface EucPoseMotion {
  id: EucPoseMotionId;
  label: string;
  speedMetersPerSecond: number;
  longitudinalAccelerationMetersPerSecondSquared: number;
  /** Steering lean, radians. Negative is a left carve. */
  leanRadians: number;
  pitchRadians: number;
}

export const EUC_POSE_MOTIONS: Readonly<
  Record<EucPoseMotionId, EucPoseMotion>
> = Object.freeze({
  rest: {
    id: "rest",
    label: "At rest",
    speedMetersPerSecond: 0,
    longitudinalAccelerationMetersPerSecondSquared: 0,
    leanRadians: 0,
    pitchRadians: 0,
  },
  cruise: {
    id: "cruise",
    label: "Riding straight",
    speedMetersPerSecond: 9,
    longitudinalAccelerationMetersPerSecondSquared: 0,
    leanRadians: 0,
    pitchRadians: 0.02,
  },
  launch: {
    id: "launch",
    label: "Accelerating",
    speedMetersPerSecond: 6,
    longitudinalAccelerationMetersPerSecondSquared: 10.5,
    leanRadians: 0,
    pitchRadians: 0.13,
  },
  brake: {
    id: "brake",
    label: "Braking",
    speedMetersPerSecond: 6,
    longitudinalAccelerationMetersPerSecondSquared: -16,
    leanRadians: 0,
    pitchRadians: -0.11,
  },
  carve: {
    id: "carve",
    label: "Carving left",
    speedMetersPerSecond: 10,
    longitudinalAccelerationMetersPerSecondSquared: 0,
    leanRadians: -0.24,
    pitchRadians: 0.01,
  },
});

function parseFrom<T extends string>(
  allowed: readonly T[],
  raw: string | null,
  fallback: T
): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

export function parseEucPoseView(raw: string | null): EucPoseViewId {
  return parseFrom(EUC_POSE_VIEW_IDS, raw, "quarter");
}

export function parseEucPoseMotion(raw: string | null): EucPoseMotionId {
  return parseFrom(EUC_POSE_MOTION_IDS, raw, "rest");
}

export function parseEucPoseSlope(raw: string | null): EucPoseSlopeDegrees {
  const value = Number(raw);
  return (EUC_POSE_SLOPE_DEGREES as readonly number[]).includes(value)
    ? (value as EucPoseSlopeDegrees)
    : 0;
}
