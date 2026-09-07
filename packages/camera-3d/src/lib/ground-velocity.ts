/**
 * Bounded horizontal ground velocity for a walking character.
 *
 * A body has mass. Snapping horizontal velocity to the commanded speed on the
 * first frame is the loudest tell that a character is a camera with legs drawn
 * on it: the gait pops to full stride from standing, and any locomotion
 * animator that blends gait tiers on measured ground speed crosses its whole
 * walk-to-run band in a single frame instead of being accelerated through it.
 *
 * So the commanded speed is a target, and a bounded acceleration chases it.
 * The bound is on the velocity VECTOR rather than each axis, which is what
 * gives a direction change its weight: a hard turn at speed carries through
 * the arc instead of teleporting sideways.
 *
 * This lives outside the component so the model can be measured directly
 * rather than only inferred from a moving picture.
 */

export interface GroundVelocity {
  x: number;
  z: number;
}

export interface GroundVelocityStep {
  /** Velocity carried in from the previous frame, in m/s. */
  current: GroundVelocity;
  /** Commanded velocity for this frame, in m/s, before the speed clamp. */
  targetX: number;
  targetZ: number;
  /** Ceiling on the commanded speed, in m/s. */
  maximumSpeed: number;
  /** Rate available while growing speed, in m/s^2. */
  acceleration: number;
  /** Rate available while shedding speed, in m/s^2. */
  deceleration: number;
  /** Whether a foot is down. */
  grounded: boolean;
  deltaSeconds: number;
  /**
   * Share of the rate available with no foot down. A body in the air has only
   * drag and limb swing to steer with, so full authority midair is the other
   * half of the same tell.
   */
  airControlFraction?: number;
}

export const DEFAULT_AIR_CONTROL_FRACTION = 0.15;

/**
 * Advance one frame of horizontal ground velocity.
 *
 * An infinite `acceleration` reproduces instant response exactly, so a caller
 * that has not opted into momentum is unaffected by this function existing.
 */
export function advanceGroundVelocity(step: GroundVelocityStep): GroundVelocity {
  const {
    current,
    maximumSpeed,
    acceleration,
    deceleration,
    grounded,
    deltaSeconds,
    airControlFraction = DEFAULT_AIR_CONTROL_FRACTION,
  } = step;

  let targetX = step.targetX;
  let targetZ = step.targetZ;
  const commandedSpeed = Math.hypot(targetX, targetZ);
  const ceiling = Math.max(0, maximumSpeed);
  if (commandedSpeed > ceiling) {
    const scale = ceiling / commandedSpeed;
    targetX *= scale;
    targetZ *= scale;
  }
  const targetSpeed = Math.min(commandedSpeed, ceiling);

  // Growing the speed is acceleration; shedding it is braking. Comparing
  // magnitudes rather than asking whether a key is held is what makes
  // releasing sprint while still walking forward brake instead of coast.
  const currentSpeed = Math.hypot(current.x, current.z);
  const rate = targetSpeed >= currentSpeed ? acceleration : deceleration;
  const maximumStep =
    rate * Math.max(0, deltaSeconds) * (grounded ? 1 : airControlFraction);

  const deltaX = targetX - current.x;
  const deltaZ = targetZ - current.z;
  const distance = Math.hypot(deltaX, deltaZ);
  if (distance === 0 || distance <= maximumStep) {
    return { x: targetX, z: targetZ };
  }
  const scale = maximumStep / distance;
  return { x: current.x + deltaX * scale, z: current.z + deltaZ * scale };
}
