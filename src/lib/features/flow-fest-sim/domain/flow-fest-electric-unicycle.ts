import {
  FLOW_FEST_GAMEPLAY_SPRINT_MULTIPLIER,
  FLOW_FEST_GAMEPLAY_WALK_SPEED_METERS_PER_SECOND,
} from "./flow-fest-simulation-contract";

const HUMAN_SPRINT_SPEED_METERS_PER_SECOND =
  FLOW_FEST_GAMEPLAY_WALK_SPEED_METERS_PER_SECOND *
  FLOW_FEST_GAMEPLAY_SPRINT_MULTIPLIER;

const degreesToRadians = (degrees: number): number =>
  (degrees * Math.PI) / 180;

export const FLOW_FEST_EUC_TRAVERSAL_ENVELOPES = Object.freeze({
  onFoot: Object.freeze({
    maxSlopeClimbAngleRadians: degreesToRadians(25),
    minSlopeSlideAngleRadians: degreesToRadians(35),
    autoStepMaxHeightMeters: 0.3,
    autoStepMinWidthMeters: 0.3,
    snapToGroundDistanceMeters: 0.35,
  }),
  mounted: Object.freeze({
    // Current high-torque suspension EUCs publish 45-50 degree peak climbing
    // envelopes. Dirt, roots, and rider margin make 42 degrees the honest
    // technical ceiling here, with a separate slide threshold above it so a
    // brief loss of speed does not strand the wheel on a recoverable sidehill.
    maxSlopeClimbAngleRadians: degreesToRadians(42),
    minSlopeSlideAngleRadians: degreesToRadians(48),
    autoStepMaxHeightMeters: 0.42,
    autoStepMinWidthMeters: 0.18,
    snapToGroundDistanceMeters: 0.55,
  }),
});

export interface FlowFestEucTraversalEnvelope {
  maxSlopeClimbAngleRadians: number;
  minSlopeSlideAngleRadians: number;
  autoStepMaxHeightMeters: number;
  autoStepMinWidthMeters: number;
  snapToGroundDistanceMeters: number;
}

export function flowFestEucTraversalEnvelope(
  mounted: boolean
): FlowFestEucTraversalEnvelope {
  return mounted
    ? FLOW_FEST_EUC_TRAVERSAL_ENVELOPES.mounted
    : FLOW_FEST_EUC_TRAVERSAL_ENVELOPES.onFoot;
}

export const FLOW_FEST_EUC_CONFIG = Object.freeze({
  wheelRadiusMeters: 0.34,
  humanWalkSpeedMetersPerSecond:
    FLOW_FEST_GAMEPLAY_WALK_SPEED_METERS_PER_SECOND,
  humanSprintSpeedMetersPerSecond: HUMAN_SPRINT_SPEED_METERS_PER_SECOND,
  // The campground is a kilometre across. Cruise stays controllable on its
  // dirt roads; Shift opens the performance envelope of a current suspension
  // EUC without letting the vehicle feel like a slightly faster runner.
  cruiseSpeedMetersPerSecond: 14.5,
  performanceSpeedMetersPerSecond: 22,
  reverseSpeedMetersPerSecond: FLOW_FEST_GAMEPLAY_WALK_SPEED_METERS_PER_SECOND,
  accelerationMetersPerSecondSquared: 7.2,
  performanceAccelerationMetersPerSecondSquared: 10.5,
  brakingMetersPerSecondSquared: 13,
  regenerativeBrakingMetersPerSecondSquared: 16,
  reverseAccelerationMetersPerSecondSquared: 3.4,
  coastDecelerationMetersPerSecondSquared: 0.9,
  speedDragPerSecond: 0.042,
  lowSpeedSteerRadiansPerSecond: 2.15,
  highSpeedSteerRadiansPerSecond: 0.36,
  maximumVisualLeanRadians: 0.24,
  maximumVisualPitchRadians: 0.14,
  maximumTerrainPitchRadians:
    FLOW_FEST_EUC_TRAVERSAL_ENVELOPES.mounted.maxSlopeClimbAngleRadians,
  maximumTerrainRollRadians: degreesToRadians(30),
  suspensionTravelMeters: 0.095,
  visualLeanResponsePerSecond: 8,
  visualPitchResponsePerSecond: 6,
  batteryPercentPerMeter: 0.0019,
  safeDismountSpeedMetersPerSecond: 1.5,
  mountRangeMeters: 2.2,
  parkedSideOffsetMeters: 0.92,
  mountedEyeHeightGainMeters: 0.18,
  // Rapier's shared character controller uses a 2 cm skin. Mounted movement
  // has to cross that boundary before collision reconciliation can judge it.
  minimumCollisionMovementMeters: 0.022,
  riderPedalHeightMeters: 0.275,
  riderOffsetZMeters: -0.09,
  riderAvatarId: "ch01" as const,
  chaseCameraPitchRadians: 0.16,
  simulationSubstepSeconds: 1 / 60,
  maximumSimulationCatchUpSeconds: 0.25,
});

export interface FlowFestElectricUnicycleInput {
  throttle: number;
  brake: number;
  steer: number;
  performanceMode: boolean;
  source: "keyboard" | "gamepad" | "mixed" | "none";
}

export interface FlowFestElectricUnicycleDynamics {
  speedMetersPerSecond: number;
  headingRadians: number;
  wheelRotationRadians: number;
  leanRadians: number;
  pitchRadians: number;
  batteryPercent: number;
  odometerMeters: number;
}

export interface FlowFestElectricUnicycleStep {
  state: FlowFestElectricUnicycleDynamics;
  displacement: { x: number; z: number };
  longitudinalAccelerationMetersPerSecondSquared: number;
}

export interface FlowFestElectricUnicycleTerrainAttitude {
  pitchRadians: number;
  rollRadians: number;
  roughnessMeters: number;
}

export interface FlowFestElectricUnicycleTerrainSamples {
  centerMeters: number;
  forwardMeters: number;
  rearMeters: number;
  leftMeters: number;
  rightMeters: number;
  longitudinalSpanMeters: number;
  lateralSpanMeters: number;
}

export interface FlowFestStandardGamepadSample {
  connected: boolean;
  mapping: string;
  axes: readonly number[];
  buttons: ReadonlyArray<{ pressed: boolean; value: number }>;
}

const TAU = Math.PI * 2;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function moveTowards(
  current: number,
  target: number,
  maximumDelta: number
): number {
  if (current < target) return Math.min(target, current + maximumDelta);
  if (current > target) return Math.max(target, current - maximumDelta);
  return current;
}

function damp(
  current: number,
  target: number,
  responsePerSecond: number,
  deltaSeconds: number
): number {
  const blend = 1 - Math.exp(-responsePerSecond * deltaSeconds);
  return current + (target - current) * blend;
}

export function deriveFlowFestEucTerrainAttitude(
  samples: FlowFestElectricUnicycleTerrainSamples
): FlowFestElectricUnicycleTerrainAttitude {
  const longitudinalSpan = Math.max(0.01, samples.longitudinalSpanMeters);
  const lateralSpan = Math.max(0.01, samples.lateralSpanMeters);
  const pitchRadians = clamp(
    Math.atan2(samples.forwardMeters - samples.rearMeters, longitudinalSpan),
    -FLOW_FEST_EUC_CONFIG.maximumTerrainPitchRadians,
    FLOW_FEST_EUC_CONFIG.maximumTerrainPitchRadians
  );
  const rollRadians = clamp(
    Math.atan2(samples.leftMeters - samples.rightMeters, lateralSpan),
    -FLOW_FEST_EUC_CONFIG.maximumTerrainRollRadians,
    FLOW_FEST_EUC_CONFIG.maximumTerrainRollRadians
  );
  const surroundingMean =
    (samples.forwardMeters +
      samples.rearMeters +
      samples.leftMeters +
      samples.rightMeters) /
    4;

  return {
    pitchRadians,
    rollRadians,
    roughnessMeters: Math.min(
      FLOW_FEST_EUC_CONFIG.suspensionTravelMeters,
      Math.abs(samples.centerMeters - surroundingMean)
    ),
  };
}

export function wrapFlowFestEucAngle(radians: number): number {
  let wrapped = radians % TAU;
  if (wrapped > Math.PI) wrapped -= TAU;
  if (wrapped < -Math.PI) wrapped += TAU;
  return wrapped;
}

export function createFlowFestElectricUnicycleDynamics(
  initial?: Partial<FlowFestElectricUnicycleDynamics>
): FlowFestElectricUnicycleDynamics {
  return {
    speedMetersPerSecond: initial?.speedMetersPerSecond ?? 0,
    headingRadians: wrapFlowFestEucAngle(initial?.headingRadians ?? 0),
    wheelRotationRadians: wrapFlowFestEucAngle(
      initial?.wheelRotationRadians ?? 0
    ),
    leanRadians: initial?.leanRadians ?? 0,
    pitchRadians: initial?.pitchRadians ?? 0,
    batteryPercent: clamp(initial?.batteryPercent ?? 100, 0, 100),
    odometerMeters: Math.max(0, initial?.odometerMeters ?? 0),
  };
}

export function flowFestEucKeyboardInput(
  activeCodes: readonly string[],
  speedMetersPerSecond: number
): FlowFestElectricUnicycleInput {
  const codes = new Set(activeCodes);
  const forward = codes.has("KeyW") || codes.has("ArrowUp");
  const reverseOrBrake = codes.has("KeyS") || codes.has("ArrowDown");
  const regenerativeBrake =
    codes.has("ControlLeft") || codes.has("ControlRight");
  // Positive yaw turns the rider toward their left in this world frame. Keep
  // the input semantic as "positive means left" across keys and thumbsticks.
  const steer =
    (codes.has("KeyA") || codes.has("ArrowLeft") ? 1 : 0) -
    (codes.has("KeyD") || codes.has("ArrowRight") ? 1 : 0);
  let throttle = forward ? 1 : 0;
  let brake = regenerativeBrake ? 1 : 0;

  if (reverseOrBrake) {
    if (speedMetersPerSecond > 0.18) brake = 1;
    else throttle = -1;
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

export function flowFestEucGamepadInput(
  gamepad: FlowFestStandardGamepadSample | null,
  speedMetersPerSecond: number
): FlowFestElectricUnicycleInput {
  if (!gamepad?.connected || gamepad.mapping !== "standard") {
    return {
      throttle: 0,
      brake: 0,
      steer: 0,
      performanceMode: false,
      source: "none",
    };
  }

  const deadzone = (value: number): number => {
    const magnitude = Math.abs(value);
    if (magnitude <= 0.12) return 0;
    return Math.sign(value) * ((magnitude - 0.12) / 0.88);
  };
  const leftY = deadzone(gamepad.axes[1] ?? 0);
  const triggerThrottle = clamp(gamepad.buttons[7]?.value ?? 0, 0, 1);
  const triggerBrake = clamp(gamepad.buttons[6]?.value ?? 0, 0, 1);
  const stickThrottle = leftY < 0 ? -leftY : 0;
  const stickBrakeOrReverse = leftY > 0 ? leftY : 0;
  let throttle = Math.max(triggerThrottle, stickThrottle);
  let brake = triggerBrake;
  if (stickBrakeOrReverse > 0) {
    if (speedMetersPerSecond > 0.18) {
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

export function mergeFlowFestEucInput(
  keyboard: FlowFestElectricUnicycleInput,
  gamepad: FlowFestElectricUnicycleInput
): FlowFestElectricUnicycleInput {
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
    throttle: clamp(throttle, -1, 1),
    brake: clamp(Math.max(keyboard.brake, gamepad.brake), 0, 1),
    steer: clamp(steer, -1, 1),
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

export function stepFlowFestElectricUnicycle(
  current: FlowFestElectricUnicycleDynamics,
  rawInput: FlowFestElectricUnicycleInput,
  rawDeltaSeconds: number
): FlowFestElectricUnicycleStep {
  const deltaSeconds = clamp(rawDeltaSeconds, 0, 1 / 30);
  if (deltaSeconds === 0) {
    return {
      state: { ...current },
      displacement: { x: 0, z: 0 },
      longitudinalAccelerationMetersPerSecondSquared: 0,
    };
  }

  const throttle = clamp(rawInput.throttle, -1, 1);
  const brake = clamp(rawInput.brake, 0, 1);
  const steer = clamp(rawInput.steer, -1, 1);
  const maximumForwardSpeed = rawInput.performanceMode
    ? FLOW_FEST_EUC_CONFIG.performanceSpeedMetersPerSecond
    : FLOW_FEST_EUC_CONFIG.cruiseSpeedMetersPerSecond;
  const startingSpeed = current.speedMetersPerSecond;
  let speed = startingSpeed;

  if (current.batteryPercent <= 0 && throttle > 0) {
    speed = moveTowards(
      speed,
      0,
      FLOW_FEST_EUC_CONFIG.coastDecelerationMetersPerSecondSquared *
        deltaSeconds
    );
  } else if (brake > 0) {
    const braking =
      FLOW_FEST_EUC_CONFIG.regenerativeBrakingMetersPerSecondSquared * brake;
    speed = moveTowards(speed, 0, braking * deltaSeconds);
  } else if (throttle > 0) {
    const acceleration = rawInput.performanceMode
      ? FLOW_FEST_EUC_CONFIG.performanceAccelerationMetersPerSecondSquared
      : FLOW_FEST_EUC_CONFIG.accelerationMetersPerSecondSquared;
    speed = moveTowards(
      speed,
      maximumForwardSpeed,
      acceleration * throttle * deltaSeconds
    );
  } else if (throttle < 0) {
    if (speed > 0.18) {
      speed = moveTowards(
        speed,
        0,
        FLOW_FEST_EUC_CONFIG.brakingMetersPerSecondSquared *
          Math.abs(throttle) *
          deltaSeconds
      );
    } else {
      speed = moveTowards(
        speed,
        -FLOW_FEST_EUC_CONFIG.reverseSpeedMetersPerSecond,
        FLOW_FEST_EUC_CONFIG.reverseAccelerationMetersPerSecondSquared *
          Math.abs(throttle) *
          deltaSeconds
      );
    }
  } else {
    const coast =
      FLOW_FEST_EUC_CONFIG.coastDecelerationMetersPerSecondSquared +
      Math.abs(speed) * FLOW_FEST_EUC_CONFIG.speedDragPerSecond;
    speed = moveTowards(speed, 0, coast * deltaSeconds);
  }

  speed = clamp(
    speed,
    -FLOW_FEST_EUC_CONFIG.reverseSpeedMetersPerSecond,
    maximumForwardSpeed
  );
  const speedRatio = clamp(
    Math.abs(speed) / FLOW_FEST_EUC_CONFIG.performanceSpeedMetersPerSecond,
    0,
    1
  );
  const steerRate =
    FLOW_FEST_EUC_CONFIG.lowSpeedSteerRadiansPerSecond +
    (FLOW_FEST_EUC_CONFIG.highSpeedSteerRadiansPerSecond -
      FLOW_FEST_EUC_CONFIG.lowSpeedSteerRadiansPerSecond) *
      Math.sqrt(speedRatio);
  const direction = speed < -0.05 ? -1 : 1;
  const headingRadians = wrapFlowFestEucAngle(
    current.headingRadians + steer * steerRate * direction * deltaSeconds
  );
  const distanceMeters = Math.abs(speed) * deltaSeconds;
  const longitudinalAccelerationMetersPerSecondSquared =
    (speed - startingSpeed) / deltaSeconds;
  const targetLean =
    -steer *
    Math.min(1, Math.abs(speed) / 5) *
    FLOW_FEST_EUC_CONFIG.maximumVisualLeanRadians;
  const targetPitch = clamp(
    -longitudinalAccelerationMetersPerSecondSquared * 0.022,
    -FLOW_FEST_EUC_CONFIG.maximumVisualPitchRadians,
    FLOW_FEST_EUC_CONFIG.maximumVisualPitchRadians
  );

  const state: FlowFestElectricUnicycleDynamics = {
    speedMetersPerSecond: speed,
    headingRadians,
    wheelRotationRadians: wrapFlowFestEucAngle(
      current.wheelRotationRadians +
        (speed / FLOW_FEST_EUC_CONFIG.wheelRadiusMeters) * deltaSeconds
    ),
    leanRadians: damp(
      current.leanRadians,
      targetLean,
      FLOW_FEST_EUC_CONFIG.visualLeanResponsePerSecond,
      deltaSeconds
    ),
    pitchRadians: damp(
      current.pitchRadians,
      targetPitch,
      FLOW_FEST_EUC_CONFIG.visualPitchResponsePerSecond,
      deltaSeconds
    ),
    batteryPercent: clamp(
      current.batteryPercent -
        distanceMeters * FLOW_FEST_EUC_CONFIG.batteryPercentPerMeter,
      0,
      100
    ),
    odometerMeters: current.odometerMeters + distanceMeters,
  };

  return {
    state,
    displacement: {
      x: Math.sin(headingRadians) * speed * deltaSeconds,
      z: Math.cos(headingRadians) * speed * deltaSeconds,
    },
    longitudinalAccelerationMetersPerSecondSquared,
  };
}

export function reconcileFlowFestEucCollision(
  current: FlowFestElectricUnicycleDynamics,
  actualVelocity: { x: number; y?: number; z: number },
  requestedVelocity?: { x: number; z: number },
  includeVerticalSurfaceTravel = false
): FlowFestElectricUnicycleDynamics {
  if (Math.abs(current.speedMetersPerSecond) < 0.05) return current;
  const projectedActualSpeed =
    actualVelocity.x * Math.sin(current.headingRadians) +
    actualVelocity.z * Math.cos(current.headingRadians);
  const projectedRequestedSpeed = requestedVelocity
    ? requestedVelocity.x * Math.sin(current.headingRadians) +
      requestedVelocity.z * Math.cos(current.headingRadians)
    : current.speedMetersPerSecond;
  const sameDirection =
    Math.sign(projectedActualSpeed) === Math.sign(current.speedMetersPerSecond);
  // Rapier resolves a grounded climb into planar and vertical components. If
  // reconciliation observes only X/Z, a legitimate 30-degree ascent looks
  // 13% collision-limited every frame and repeatedly erases motor torque. The
  // vertical component counts only while the character controller is grounded,
  // so an airborne fall cannot masquerade as successful wheel travel.
  const verticalSpeed = actualVelocity.y ?? 0;
  const gradeRatio =
    Math.abs(projectedActualSpeed) > 1e-6
      ? Math.abs(verticalSpeed) / Math.abs(projectedActualSpeed)
      : Number.POSITIVE_INFINITY;
  const plausibleSurfaceTravel =
    sameDirection &&
    Math.abs(projectedActualSpeed) > 0.05 &&
    gradeRatio <=
      Math.tan(FLOW_FEST_EUC_CONFIG.maximumTerrainPitchRadians) + 0.05;
  const actualSurfaceSpeed =
    includeVerticalSurfaceTravel || plausibleSurfaceTravel
    ? Math.hypot(projectedActualSpeed, actualVelocity.y ?? 0)
    : Math.abs(projectedActualSpeed);
  const travelRatio =
    Math.abs(projectedRequestedSpeed) > 1e-6
      ? clamp(
          actualSurfaceSpeed / Math.abs(projectedRequestedSpeed),
          0,
          1
        )
      : 0;
  const correctedMagnitude = sameDirection
    ? Math.abs(current.speedMetersPerSecond) * travelRatio
    : 0;
  if (correctedMagnitude >= Math.abs(current.speedMetersPerSecond) * 0.985) {
    return current;
  }
  return {
    ...current,
    speedMetersPerSecond:
      Math.sign(current.speedMetersPerSecond) * correctedMagnitude,
    pitchRadians: Math.max(
      current.pitchRadians,
      FLOW_FEST_EUC_CONFIG.maximumVisualPitchRadians * 0.7
    ),
  };
}

export function flowFestEucSpeedKilometresPerHour(
  speedMetersPerSecond: number
): number {
  return Math.abs(speedMetersPerSecond) * 3.6;
}

export function flowFestEucSpeedMilesPerHour(
  speedMetersPerSecond: number
): number {
  return Math.abs(speedMetersPerSecond) * 2.2369362921;
}
