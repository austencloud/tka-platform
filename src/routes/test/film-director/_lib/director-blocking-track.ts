import { applyDirectorEasing } from "./director-easing";
import type { ResolvedDirectorBlockingKeyframe } from "./blocking-language";

export interface DirectorBlockingFrame {
  position: { x: number; z: number };
  facingAngle: number;
  isMoving: boolean;
  /** Ground speed in meters per second — what keeps the walk clip in step. */
  moveSpeed: number;
  /** Travel direction in the performer's own frame: +z ahead, +x to their right. */
  moveDirection: { x: number; z: number };
}

interface BlockingPose {
  position: { x: number; z: number };
  facingAngle: number;
  walking: boolean;
  segmentDelta: { x: number; z: number };
  /** Bounds of the keyframe segment this pose came from. */
  segmentStart: number;
  segmentEnd: number;
}

const REST: DirectorBlockingFrame = {
  position: { x: 0, z: 0 },
  facingAngle: 0,
  isMoving: false,
  moveSpeed: 0,
  moveDirection: { x: 0, z: 1 },
};

/**
 * Half-width of the finite difference that measures ground speed. Reading the
 * sampled positions rather than differentiating each easing curve keeps speed
 * correct no matter which curve a move asked for.
 */
const SPEED_PROBE_SECONDS = 1 / 60;

export function sampleDirectorBlockingTrack(
  keyframes: readonly ResolvedDirectorBlockingKeyframe[],
  atSeconds: number
): DirectorBlockingFrame {
  if (keyframes.length === 0) return { ...REST, position: { ...REST.position } };

  const pose = samplePose(keyframes, atSeconds);

  return {
    position: pose.position,
    facingAngle: pose.facingAngle,
    isMoving: pose.walking,
    moveSpeed: measureSpeed(keyframes, atSeconds, pose),
    moveDirection: toLocalDirection(pose.segmentDelta, pose.facingAngle),
  };
}

/**
 * Ground speed at one instant, measured inside the segment that owns it.
 *
 * The probe is clamped to the segment because a centred difference that
 * reaches past a keyframe measures the neighbouring segment instead: on the
 * frame a performer arrives, half the window still lies in the travel they
 * just finished, and the walk would be handed a standing performer a speed to
 * stretch their stride to.
 */
function measureSpeed(
  keyframes: readonly ResolvedDirectorBlockingKeyframe[],
  atSeconds: number,
  pose: BlockingPose
): number {
  if (!pose.walking) return 0;

  const from = Math.max(pose.segmentStart, atSeconds - SPEED_PROBE_SECONDS);
  const to = Math.min(pose.segmentEnd, atSeconds + SPEED_PROBE_SECONDS);
  const span = to - from;
  if (span < 1e-6) return 0;

  const ahead = samplePose(keyframes, to).position;
  const behind = samplePose(keyframes, from).position;
  return Math.hypot(ahead.x - behind.x, ahead.z - behind.z) / span;
}

function samplePose(
  keyframes: readonly ResolvedDirectorBlockingKeyframe[],
  atSeconds: number
): BlockingPose {
  const first = keyframes[0]!;
  const last = keyframes.at(-1)!;
  if (keyframes.length === 1 || atSeconds <= first.atSeconds) {
    return held(first);
  }
  if (atSeconds >= last.atSeconds) return held(last);

  const endIndex = keyframes.findIndex((frame) => frame.atSeconds > atSeconds);
  const start = keyframes[Math.max(0, endIndex - 1)]!;
  const end = keyframes[endIndex]!;
  const duration = Math.max(1e-4, end.atSeconds - start.atSeconds);
  const progress = applyDirectorEasing(
    Math.max(0, Math.min(1, (atSeconds - start.atSeconds) / duration)),
    start.easing
  );
  const delta = {
    x: end.position.x - start.position.x,
    z: end.position.z - start.position.z,
  };

  return {
    position: {
      x: start.position.x + delta.x * progress,
      z: start.position.z + delta.z * progress,
    },
    facingAngle:
      start.facingAngle + shortestTurn(start.facingAngle, end.facingAngle) * progress,
    walking: start.walking,
    segmentDelta: delta,
    segmentStart: start.atSeconds,
    segmentEnd: end.atSeconds,
  };
}

function held(frame: ResolvedDirectorBlockingKeyframe): BlockingPose {
  return {
    position: { ...frame.position },
    facingAngle: frame.facingAngle,
    walking: false,
    segmentDelta: { x: 0, z: 0 },
    segmentStart: frame.atSeconds,
    segmentEnd: frame.atSeconds,
  };
}

function shortestTurn(from: number, to: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

/**
 * The direction is taken from the whole segment rather than the instantaneous
 * velocity, so an eased travel still names which way the performer is going at
 * the moments its speed passes through zero.
 */
function toLocalDirection(
  delta: { x: number; z: number },
  facingAngle: number
): { x: number; z: number } {
  const distance = Math.hypot(delta.x, delta.z);
  if (distance < 1e-6) return { x: 0, z: 1 };
  const nx = delta.x / distance;
  const nz = delta.z / distance;
  const sin = Math.sin(facingAngle);
  const cos = Math.cos(facingAngle);
  return { x: nx * cos - nz * sin, z: nx * sin + nz * cos };
}
