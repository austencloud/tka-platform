/**
 * Shared ground-vehicle primitives for the Flow Fest sim.
 *
 * The electric unicycle was the first vehicle; the car is the second. Both
 * read the same keys and thumbsticks, wrap headings the same way, and judge
 * collision-limited travel the same way against Rapier's character
 * controller. Vehicle-specific dynamics stay in their own modules.
 */

export interface FlowFestGroundVehicleInput {
  /** −1..1; negative is a reverse request, honoured only near standstill. */
  throttle: number;
  /** 0..1 */
  brake: number;
  /** −1..1; positive means the driver's left in this world frame. */
  steer: number;
  performanceMode: boolean;
  source: "keyboard" | "gamepad" | "mixed" | "none";
}

export interface FlowFestStandardGamepadSample {
  connected: boolean;
  mapping: string;
  axes: readonly number[];
  buttons: ReadonlyArray<{ pressed: boolean; value: number }>;
}

export const FLOW_FEST_GROUND_VEHICLE_IDLE_INPUT: FlowFestGroundVehicleInput =
  Object.freeze({
    throttle: 0,
    brake: 0,
    steer: 0,
    performanceMode: false,
    source: "none",
  });

const TAU = Math.PI * 2;

/** Below this signed speed a brake request becomes a reverse request. */
export const FLOW_FEST_GROUND_VEHICLE_REVERSE_THRESHOLD_METERS_PER_SECOND = 0.18;

export function clampFlowFestNumber(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function moveFlowFestNumberTowards(
  current: number,
  target: number,
  maximumDelta: number
): number {
  if (current < target) return Math.min(target, current + maximumDelta);
  if (current > target) return Math.max(target, current - maximumDelta);
  return current;
}

export function dampFlowFestNumber(
  current: number,
  target: number,
  responsePerSecond: number,
  deltaSeconds: number
): number {
  const blend = 1 - Math.exp(-responsePerSecond * deltaSeconds);
  return current + (target - current) * blend;
}

export function wrapFlowFestGroundVehicleAngle(radians: number): number {
  let wrapped = radians % TAU;
  if (wrapped > Math.PI) wrapped -= TAU;
  if (wrapped < -Math.PI) wrapped += TAU;
  return wrapped;
}

export function flowFestGroundVehicleKeyboardInput(
  activeCodes: readonly string[],
  speedMetersPerSecond: number
): FlowFestGroundVehicleInput {
  const codes = new Set(activeCodes);
  const forward = codes.has("KeyW") || codes.has("ArrowUp");
  const reverseOrBrake = codes.has("KeyS") || codes.has("ArrowDown");
  const hardBrake = codes.has("ControlLeft") || codes.has("ControlRight");
  // Positive yaw turns the driver toward their left in this world frame. Keep
  // the input semantic as "positive means left" across keys and thumbsticks.
  const steer =
    (codes.has("KeyA") || codes.has("ArrowLeft") ? 1 : 0) -
    (codes.has("KeyD") || codes.has("ArrowRight") ? 1 : 0);
  let throttle = forward ? 1 : 0;
  let brake = hardBrake ? 1 : 0;

  if (reverseOrBrake) {
    if (
      speedMetersPerSecond >
      FLOW_FEST_GROUND_VEHICLE_REVERSE_THRESHOLD_METERS_PER_SECOND
    ) {
      brake = 1;
    } else {
      throttle = -1;
    }
  }

  const hasInput = throttle !== 0 || brake !== 0 || steer !== 0;
  return {
    throttle,
    brake,
    steer,
    performanceMode: codes.has("ShiftLeft") || codes.has("ShiftRight"),
    source: hasInput ? "keyboard" : "none",
  };
}

export function flowFestGroundVehicleGamepadInput(
  gamepad: FlowFestStandardGamepadSample | null,
  speedMetersPerSecond: number
): FlowFestGroundVehicleInput {
  if (!gamepad?.connected || gamepad.mapping !== "standard") {
    return { ...FLOW_FEST_GROUND_VEHICLE_IDLE_INPUT };
  }

  const deadzone = (value: number): number => {
    const magnitude = Math.abs(value);
    if (magnitude <= 0.12) return 0;
    return Math.sign(value) * ((magnitude - 0.12) / 0.88);
  };
  const leftY = deadzone(gamepad.axes[1] ?? 0);
  const triggerThrottle = clampFlowFestNumber(
    gamepad.buttons[7]?.value ?? 0,
    0,
    1
  );
  const triggerBrake = clampFlowFestNumber(gamepad.buttons[6]?.value ?? 0, 0, 1);
  const stickThrottle = leftY < 0 ? -leftY : 0;
  const stickBrakeOrReverse = leftY > 0 ? leftY : 0;
  let throttle = Math.max(triggerThrottle, stickThrottle);
  let brake = triggerBrake;
  if (stickBrakeOrReverse > 0) {
    if (
      speedMetersPerSecond >
      FLOW_FEST_GROUND_VEHICLE_REVERSE_THRESHOLD_METERS_PER_SECOND
    ) {
      brake = Math.max(brake, stickBrakeOrReverse);
    } else {
      throttle = -stickBrakeOrReverse;
    }
  }
  const steer = -deadzone(gamepad.axes[0] ?? 0);
  const hasInput = throttle !== 0 || brake !== 0 || steer !== 0;
  return {
    throttle,
    brake,
    steer,
    performanceMode: gamepad.buttons[5]?.pressed ?? false,
    source: hasInput ? "gamepad" : "none",
  };
}

export function mergeFlowFestGroundVehicleInput(
  keyboard: FlowFestGroundVehicleInput,
  gamepad: FlowFestGroundVehicleInput
): FlowFestGroundVehicleInput {
  const keyboardActive = keyboard.source !== "none";
  const gamepadActive = gamepad.source !== "none";
  const throttle =
    Math.abs(gamepad.throttle) > Math.abs(keyboard.throttle)
      ? gamepad.throttle
      : keyboard.throttle;
  const steer =
    Math.abs(gamepad.steer) > Math.abs(keyboard.steer)
      ? gamepad.steer
      : keyboard.steer;
  return {
    throttle: clampFlowFestNumber(throttle, -1, 1),
    brake: clampFlowFestNumber(Math.max(keyboard.brake, gamepad.brake), 0, 1),
    steer: clampFlowFestNumber(steer, -1, 1),
    performanceMode: keyboard.performanceMode || gamepad.performanceMode,
    source:
      keyboardActive && gamepadActive
        ? "mixed"
        : gamepadActive
          ? "gamepad"
          : keyboardActive
            ? "keyboard"
            : "none",
  };
}

export interface FlowFestGroundVehicleTravelReconciliation {
  speedMetersPerSecond: number;
  /** True when the physics world let the vehicle travel materially less than it asked. */
  limited: boolean;
}

/**
 * Compare what the character controller actually moved against what the
 * vehicle asked for, along the vehicle's heading.
 *
 * Rapier resolves a grounded climb into planar and vertical components. If
 * reconciliation observes only X/Z, a legitimate ascent looks collision-limited
 * every frame and repeatedly erases motor torque. The vertical component counts
 * only while the grade it implies is one the vehicle could be climbing
 * (`maximumGradeRatio`, tan of the traversal envelope's climb angle plus a
 * margin), so an airborne fall cannot masquerade as successful travel.
 */
export function reconcileFlowFestGroundVehicleTravel(
  current: { speedMetersPerSecond: number; headingRadians: number },
  actualVelocity: { x: number; y?: number; z: number },
  requestedVelocity: { x: number; z: number } | undefined,
  options: {
    maximumGradeRatio: number;
    includeVerticalSurfaceTravel?: boolean;
  }
): FlowFestGroundVehicleTravelReconciliation {
  const speed = current.speedMetersPerSecond;
  if (Math.abs(speed) < 0.05) {
    return { speedMetersPerSecond: speed, limited: false };
  }
  const sinHeading = Math.sin(current.headingRadians);
  const cosHeading = Math.cos(current.headingRadians);
  const projectedActualSpeed =
    actualVelocity.x * sinHeading + actualVelocity.z * cosHeading;
  const projectedRequestedSpeed = requestedVelocity
    ? requestedVelocity.x * sinHeading + requestedVelocity.z * cosHeading
    : speed;
  const sameDirection =
    Math.sign(projectedActualSpeed) === Math.sign(speed);
  const verticalSpeed = actualVelocity.y ?? 0;
  const gradeRatio =
    Math.abs(projectedActualSpeed) > 1e-6
      ? Math.abs(verticalSpeed) / Math.abs(projectedActualSpeed)
      : Number.POSITIVE_INFINITY;
  const plausibleSurfaceTravel =
    sameDirection &&
    Math.abs(projectedActualSpeed) > 0.05 &&
    gradeRatio <= options.maximumGradeRatio;
  const actualSurfaceSpeed =
    options.includeVerticalSurfaceTravel || plausibleSurfaceTravel
      ? Math.hypot(projectedActualSpeed, verticalSpeed)
      : Math.abs(projectedActualSpeed);
  const travelRatio =
    Math.abs(projectedRequestedSpeed) > 1e-6
      ? clampFlowFestNumber(
          actualSurfaceSpeed / Math.abs(projectedRequestedSpeed),
          0,
          1
        )
      : 0;
  const correctedMagnitude = sameDirection
    ? Math.abs(speed) * travelRatio
    : 0;
  if (correctedMagnitude >= Math.abs(speed) * 0.985) {
    return { speedMetersPerSecond: speed, limited: false };
  }
  return {
    speedMetersPerSecond: Math.sign(speed) * correctedMagnitude,
    limited: true,
  };
}

export function flowFestGroundVehicleSpeedKilometresPerHour(
  speedMetersPerSecond: number
): number {
  return Math.abs(speedMetersPerSecond) * 3.6;
}

export function flowFestGroundVehicleSpeedMilesPerHour(
  speedMetersPerSecond: number
): number {
  return Math.abs(speedMetersPerSecond) * 2.2369362921;
}
