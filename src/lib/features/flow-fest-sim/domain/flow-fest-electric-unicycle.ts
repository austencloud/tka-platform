import {
  clampFlowFestNumber,
  dampFlowFestNumber,
  flowFestGroundVehicleGamepadInput,
  flowFestGroundVehicleKeyboardInput,
  flowFestGroundVehicleSpeedKilometresPerHour,
  flowFestGroundVehicleSpeedMilesPerHour,
  mergeFlowFestGroundVehicleInput,
  moveFlowFestNumberTowards,
  reconcileFlowFestGroundVehicleTravel,
  wrapFlowFestGroundVehicleAngle,
  type FlowFestGroundVehicleInput,
} from "./flow-fest-ground-vehicle";
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

/** The EUC reads the shared ground-vehicle input; see flow-fest-ground-vehicle.ts. */
export type FlowFestElectricUnicycleInput = FlowFestGroundVehicleInput;

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

export type { FlowFestStandardGamepadSample } from "./flow-fest-ground-vehicle";

const clamp = clampFlowFestNumber;
const moveTowards = moveFlowFestNumberTowards;
const damp = dampFlowFestNumber;

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

export const wrapFlowFestEucAngle = wrapFlowFestGroundVehicleAngle;

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

export const flowFestEucKeyboardInput = flowFestGroundVehicleKeyboardInput;
export const flowFestEucGamepadInput = flowFestGroundVehicleGamepadInput;
export const mergeFlowFestEucInput = mergeFlowFestGroundVehicleInput;

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
  const travel = reconcileFlowFestGroundVehicleTravel(
    current,
    actualVelocity,
    requestedVelocity,
    {
      maximumGradeRatio:
        Math.tan(FLOW_FEST_EUC_CONFIG.maximumTerrainPitchRadians) + 0.05,
      includeVerticalSurfaceTravel,
    }
  );
  if (!travel.limited) return current;
  return {
    ...current,
    speedMetersPerSecond: travel.speedMetersPerSecond,
    pitchRadians: Math.max(
      current.pitchRadians,
      FLOW_FEST_EUC_CONFIG.maximumVisualPitchRadians * 0.7
    ),
  };
}

export const flowFestEucSpeedKilometresPerHour =
  flowFestGroundVehicleSpeedKilometresPerHour;
export const flowFestEucSpeedMilesPerHour =
  flowFestGroundVehicleSpeedMilesPerHour;
