import {
  FLOW_FEST_PARKED_CAR_MODELS,
  type FlowFestParkedCarModel,
} from "../../../../routes/test/flow-fest-sim/flow-fest-parked-car-catalog";
import {
  clampFlowFestNumber as clamp,
  dampFlowFestNumber as damp,
  FLOW_FEST_GROUND_VEHICLE_REVERSE_THRESHOLD_METERS_PER_SECOND,
  moveFlowFestNumberTowards as moveTowards,
  wrapFlowFestGroundVehicleAngle,
  type FlowFestGroundVehicleInput,
} from "./flow-fest-ground-vehicle";

/**
 * Authored, class-typical driving numbers for each body in the parked-car
 * catalog. None of this is surveyed: a '80 sedan of this size and era is
 * about 1.5 t with an 80 kW engine, and that is the honesty level of every
 * row. Length, width, wheelbase and track are NOT authored here; they come
 * from the measured GLB contacts in the parked-car catalog.
 */
interface FlowFestCarAuthoredSpec {
  modelId: string;
  massKilograms: number;
  peakPowerWatts: number;
  /** Traction-limited launch on a grippy surface, m/s². The pickup feels heavier here. */
  launchAccelerationMetersPerSecondSquared: number;
  brakeDecelerationMetersPerSecondSquared: number;
  /** Drag coefficient times frontal area, m². */
  dragAreaSquareMeters: number;
  maxSteerRadians: number;
  /** How fast the wheels reach full lock at standstill, rad/s. */
  steerRateRadiansPerSecond: number;
  topSpeedMetersPerSecond: number;
  bodyPitchGainRadiansPerMeterPerSecondSquared: number;
  bodyRollGainRadiansPerMeterPerSecondSquared: number;
  cargoLitres: number;
  priceUsd: number;
}

export interface FlowFestCarSpec extends FlowFestCarAuthoredSpec {
  label: string;
  lengthMeters: number;
  widthMeters: number;
  heightMeters: number;
  wheelbaseMeters: number;
  trackMeters: number;
}

const AUTHORED_SPECS: readonly FlowFestCarAuthoredSpec[] = Object.freeze([
  {
    modelId: "ace-hatchback",
    massKilograms: 1100,
    peakPowerWatts: 75_000,
    launchAccelerationMetersPerSecondSquared: 3.4,
    brakeDecelerationMetersPerSecondSquared: 8.0,
    dragAreaSquareMeters: 0.7,
    maxSteerRadians: 0.5,
    steerRateRadiansPerSecond: 2.8,
    topSpeedMetersPerSecond: 33,
    bodyPitchGainRadiansPerMeterPerSecondSquared: 0.01,
    bodyRollGainRadiansPerMeterPerSecondSquared: 0.012,
    cargoLitres: 270,
    priceUsd: 1800,
  },
  {
    modelId: "fairheaven-sedan",
    massKilograms: 1500,
    peakPowerWatts: 80_000,
    launchAccelerationMetersPerSecondSquared: 3.2,
    brakeDecelerationMetersPerSecondSquared: 7.5,
    dragAreaSquareMeters: 0.85,
    maxSteerRadians: 0.48,
    steerRateRadiansPerSecond: 2.4,
    topSpeedMetersPerSecond: 35,
    bodyPitchGainRadiansPerMeterPerSecondSquared: 0.012,
    bodyRollGainRadiansPerMeterPerSecondSquared: 0.014,
    cargoLitres: 570,
    priceUsd: 2400,
  },
  {
    modelId: "fairheaven-wagon",
    massKilograms: 1600,
    peakPowerWatts: 85_000,
    launchAccelerationMetersPerSecondSquared: 3.0,
    brakeDecelerationMetersPerSecondSquared: 7.5,
    dragAreaSquareMeters: 0.85,
    maxSteerRadians: 0.48,
    steerRateRadiansPerSecond: 2.3,
    topSpeedMetersPerSecond: 34,
    bodyPitchGainRadiansPerMeterPerSecondSquared: 0.012,
    bodyRollGainRadiansPerMeterPerSecondSquared: 0.014,
    cargoLitres: 1300,
    priceUsd: 2600,
  },
  {
    modelId: "bokaroo-suv",
    massKilograms: 1950,
    peakPowerWatts: 110_000,
    launchAccelerationMetersPerSecondSquared: 2.8,
    brakeDecelerationMetersPerSecondSquared: 7.0,
    dragAreaSquareMeters: 1.2,
    maxSteerRadians: 0.45,
    steerRateRadiansPerSecond: 2.0,
    topSpeedMetersPerSecond: 32,
    bodyPitchGainRadiansPerMeterPerSecondSquared: 0.016,
    bodyRollGainRadiansPerMeterPerSecondSquared: 0.02,
    cargoLitres: 1100,
    priceUsd: 3200,
  },
  {
    modelId: "lightbody-pickup",
    massKilograms: 2050,
    peakPowerWatts: 100_000,
    launchAccelerationMetersPerSecondSquared: 2.6,
    brakeDecelerationMetersPerSecondSquared: 7.0,
    dragAreaSquareMeters: 1.3,
    maxSteerRadians: 0.42,
    steerRateRadiansPerSecond: 1.8,
    topSpeedMetersPerSecond: 32,
    bodyPitchGainRadiansPerMeterPerSecondSquared: 0.018,
    bodyRollGainRadiansPerMeterPerSecondSquared: 0.018,
    cargoLitres: 1800,
    priceUsd: 3000,
  },
  {
    modelId: "t2-camper",
    massKilograms: 1350,
    peakPowerWatts: 40_000,
    launchAccelerationMetersPerSecondSquared: 1.9,
    brakeDecelerationMetersPerSecondSquared: 6.0,
    dragAreaSquareMeters: 1.4,
    maxSteerRadians: 0.46,
    steerRateRadiansPerSecond: 2.0,
    topSpeedMetersPerSecond: 25,
    bodyPitchGainRadiansPerMeterPerSecondSquared: 0.016,
    bodyRollGainRadiansPerMeterPerSecondSquared: 0.022,
    cargoLitres: 2000,
    priceUsd: 4500,
  },
]);

function joinCarSpec(
  authored: FlowFestCarAuthoredSpec,
  model: FlowFestParkedCarModel
): FlowFestCarSpec {
  return Object.freeze({
    ...authored,
    label: model.label,
    lengthMeters: model.lengthMeters,
    widthMeters: model.widthMeters,
    heightMeters: model.heightMeters,
    wheelbaseMeters:
      model.wheels.frontAlongMeters - model.wheels.rearAlongMeters,
    trackMeters: model.wheels.halfTrackMeters * 2,
  });
}

/** Every car the loadout screen can offer, in the parked-car catalog's order. */
export const FLOW_FEST_CAR_CATALOG: readonly FlowFestCarSpec[] = Object.freeze(
  FLOW_FEST_PARKED_CAR_MODELS.map((model) => {
    const authored = AUTHORED_SPECS.find((entry) => entry.modelId === model.id);
    if (!authored) {
      throw new Error(
        `Flow Fest car catalog has no driving spec for ${model.id}`
      );
    }
    return joinCarSpec(authored, model);
  })
);

export function flowFestCarSpec(modelId: string): FlowFestCarSpec {
  const spec = FLOW_FEST_CAR_CATALOG.find((entry) => entry.modelId === modelId);
  if (!spec) throw new Error(`Unknown Flow Fest car ${modelId}`);
  return spec;
}

export const FLOW_FEST_CAR_CONFIG = Object.freeze({
  reverseTopSpeedMetersPerSecond: 3,
  /** Reverse is a manoeuvre, not a gear: a fraction of the launch envelope. */
  reverseLaunchFraction: 0.6,
  rollingResistanceCoefficient: 0.015,
  airDensityKilogramsPerCubicMeter: 1.225,
  /** An automatic in Drive with a closed throttle, m/s². */
  engineBrakingMetersPerSecondSquared: 0.35,
  /** Lateral grip on a good surface, m/s²; the steering cap that makes the understeer. */
  lateralGripMetersPerSecondSquared: 6,
  /** Grass and the loose gravel shoulder: launch and cornering both scale by this. */
  offRoadGripFraction: 0.65,
  /** Wheels return to centre faster than the driver can wind them on. */
  steerReturnRateRadiansPerSecond: 3.5,
  /** Full lock reaches this fraction of its standstill rate at 15 m/s. */
  steerRateHalvingSpeedMetersPerSecond: 15,
  bodyResponsePerSecond: 6,
  maximumBodyPitchRadians: 0.06,
  maximumBodyRollRadians: 0.08,
  /** You can open the door below this. */
  exitSpeedMetersPerSecond: 0.5,
  /**
   * No pedal and all but stopped: the car is in Park and stays put. Below
   * this the grade may not draw it down the county road while the driver
   * reads the road; above it, lifting off still rolls.
   */
  autoHoldSpeedMetersPerSecond: 0.75,
  /** How close to the driver's door the on-foot player must stand to get in. */
  boardRangeMeters: 1.8,
  driverDoorOffsetMeters: 0.4,
  /** The wheel rides along when it is this close to the car at boarding. */
  electricUnicycleCargoRangeMeters: 4,
  /** Where the wheel is set down on exit, behind the rear bumper. */
  electricUnicycleSetDownBehindMeters: 1.2,
  /** The rider's stated cargo volume; authored. */
  electricUnicycleCargoLitres: 60,
  bodyColliderHalfHeightMeters: 0.6,
  gravityMetersPerSecondSquared: 9.81,
  simulationSubstepSeconds: 1 / 60,
  maximumSimulationCatchUpSeconds: 0.25,
  minimumCollisionMovementMeters: 0.022,
  /** The car stays inside the surveyed square; the terrain colliders end there. */
  worldHalfExtentMeters: 508,
  /** Signed wheel travel is wrapped here so the visual keeps float precision. */
  wheelTravelWrapMeters: 10_000,
  chaseCameraPitchRadians: 0.16,
  chaseCameraDistanceMeters: 7.5,
  chaseCameraMinDistanceMeters: 3,
  chaseCameraMaxDistanceMeters: 14,
  chaseCameraHeightMeters: 2.4,
  chaseCameraLookAtHeightMeters: 1.0,
});

export interface FlowFestCarDynamics {
  /** Signed; negative is reversing. */
  speedMetersPerSecond: number;
  headingRadians: number;
  /** Front-wheel angle, positive left. */
  steeringRadians: number;
  /** Weight-transfer pitch, positive nose up. */
  bodyPitchRadians: number;
  /** Weight-transfer roll, positive right side down. */
  bodyRollRadians: number;
  odometerMeters: number;
  /** Signed distance for wheel spin, wrapped at `wheelTravelWrapMeters`. */
  wheelTravelMeters: number;
}

export interface FlowFestCarEnvironment {
  /** 1 on the road, lower on grass and loose gravel. */
  gripFraction: number;
  /** Sine of the grade under the car along its heading; positive is climbing. */
  gradeSine: number;
}

export interface FlowFestCarStep {
  state: FlowFestCarDynamics;
  displacement: { x: number; z: number };
  longitudinalAccelerationMetersPerSecondSquared: number;
  /** Positive toward the driver's left. */
  lateralAccelerationMetersPerSecondSquared: number;
}

export const FLOW_FEST_CAR_FLAT_ROAD: FlowFestCarEnvironment = Object.freeze({
  gripFraction: 1,
  gradeSine: 0,
});

export function createFlowFestCarDynamics(
  initial?: Partial<FlowFestCarDynamics>
): FlowFestCarDynamics {
  return {
    speedMetersPerSecond: initial?.speedMetersPerSecond ?? 0,
    headingRadians: wrapFlowFestGroundVehicleAngle(
      initial?.headingRadians ?? 0
    ),
    steeringRadians: initial?.steeringRadians ?? 0,
    bodyPitchRadians: initial?.bodyPitchRadians ?? 0,
    bodyRollRadians: initial?.bodyRollRadians ?? 0,
    odometerMeters: Math.max(0, initial?.odometerMeters ?? 0),
    wheelTravelMeters: initial?.wheelTravelMeters ?? 0,
  };
}

/** Unit vectors of a car at `headingRadians` in the world frame (x east, z south). */
export function flowFestCarAxes(headingRadians: number): {
  forward: { x: number; z: number };
  right: { x: number; z: number };
} {
  return {
    forward: { x: Math.sin(headingRadians), z: Math.cos(headingRadians) },
    right: { x: -Math.cos(headingRadians), z: Math.sin(headingRadians) },
  };
}

/** Where the on-foot player stands to get in, and is set down on exit. */
export function flowFestCarDriverDoorPoint(
  spec: Pick<FlowFestCarSpec, "widthMeters">,
  pose: { x: number; z: number; headingRadians: number }
): { x: number; z: number } {
  const { right } = flowFestCarAxes(pose.headingRadians);
  const offset =
    spec.widthMeters / 2 + FLOW_FEST_CAR_CONFIG.driverDoorOffsetMeters;
  return { x: pose.x - right.x * offset, z: pose.z - right.z * offset };
}

/** Where the electric unicycle is set down when the driver gets out. */
export function flowFestCarCargoSetDownPoint(
  spec: Pick<FlowFestCarSpec, "lengthMeters">,
  pose: { x: number; z: number; headingRadians: number }
): { x: number; z: number } {
  const { forward } = flowFestCarAxes(pose.headingRadians);
  const offset =
    spec.lengthMeters / 2 +
    FLOW_FEST_CAR_CONFIG.electricUnicycleSetDownBehindMeters;
  return { x: pose.x - forward.x * offset, z: pose.z - forward.z * offset };
}

/** Speed-sensitive steering lock: the understeer that keeps a fast car honest. */
export function flowFestCarSteeringLimitRadians(
  spec: Pick<FlowFestCarSpec, "maxSteerRadians" | "wheelbaseMeters">,
  speedMetersPerSecond: number,
  gripFraction = 1
): number {
  const speed = Math.abs(speedMetersPerSecond);
  if (speed <= 1) return spec.maxSteerRadians;
  const lateralLimit =
    FLOW_FEST_CAR_CONFIG.lateralGripMetersPerSecondSquared *
    clamp(gripFraction, 0.2, 1);
  return Math.min(
    spec.maxSteerRadians,
    Math.atan((lateralLimit * spec.wheelbaseMeters) / (speed * speed))
  );
}

export function stepFlowFestCar(
  spec: FlowFestCarSpec,
  current: FlowFestCarDynamics,
  rawInput: FlowFestGroundVehicleInput,
  rawDeltaSeconds: number,
  environment: FlowFestCarEnvironment = FLOW_FEST_CAR_FLAT_ROAD
): FlowFestCarStep {
  const deltaSeconds = clamp(rawDeltaSeconds, 0, 1 / 30);
  if (deltaSeconds === 0) {
    return {
      state: { ...current },
      displacement: { x: 0, z: 0 },
      longitudinalAccelerationMetersPerSecondSquared: 0,
      lateralAccelerationMetersPerSecondSquared: 0,
    };
  }

  const config = FLOW_FEST_CAR_CONFIG;
  const throttle = clamp(rawInput.throttle, -1, 1);
  const brake = clamp(rawInput.brake, 0, 1);
  const steer = clamp(rawInput.steer, -1, 1);
  const grip = clamp(environment.gripFraction, 0.2, 1);
  const startingSpeed = current.speedMetersPerSecond;
  const absStartingSpeed = Math.abs(startingSpeed);
  let speed = startingSpeed;

  // Drive: traction-limited off the line, power-limited once rolling.
  let driveAcceleration = 0;
  let braking = brake;
  if (throttle > 0) {
    const powerLimited =
      (spec.peakPowerWatts * throttle) /
      (spec.massKilograms * Math.max(absStartingSpeed, 2));
    driveAcceleration = Math.min(
      powerLimited,
      spec.launchAccelerationMetersPerSecondSquared * throttle * grip
    );
  } else if (throttle < 0) {
    if (
      startingSpeed >
      FLOW_FEST_GROUND_VEHICLE_REVERSE_THRESHOLD_METERS_PER_SECOND
    ) {
      braking = Math.max(braking, Math.abs(throttle));
    } else {
      driveAcceleration =
        -spec.launchAccelerationMetersPerSecondSquared *
        config.reverseLaunchFraction *
        Math.abs(throttle) *
        grip;
    }
  }

  // In Park: no pedal and all but stopped, so the grade may not move it and
  // the resistance below brings it to rest.
  const held =
    throttle === 0 &&
    brake === 0 &&
    absStartingSpeed <= config.autoHoldSpeedMetersPerSecond;
  const gravity = held
    ? 0
    : -config.gravityMetersPerSecondSquared * environment.gradeSine;
  speed += (driveAcceleration + gravity) * deltaSeconds;

  // Everything that opposes motion is applied toward zero so it can hold a
  // stopped car on a hill but never push it the other way.
  const rolling =
    config.rollingResistanceCoefficient *
    config.gravityMetersPerSecondSquared *
    (2 - grip);
  const aero =
    (0.5 *
      config.airDensityKilogramsPerCubicMeter *
      spec.dragAreaSquareMeters *
      absStartingSpeed *
      absStartingSpeed) /
    spec.massKilograms;
  const engineBraking =
    throttle === 0 && brake === 0
      ? config.engineBrakingMetersPerSecondSquared
      : 0;
  const brakeDeceleration =
    spec.brakeDecelerationMetersPerSecondSquared *
    braking *
    Math.min(1, grip * 1.1);
  speed = moveTowards(
    speed,
    0,
    (rolling + aero + engineBraking + brakeDeceleration) * deltaSeconds
  );
  speed = clamp(
    speed,
    -config.reverseTopSpeedMetersPerSecond,
    spec.topSpeedMetersPerSecond
  );

  // Steering: a bicycle model with a grip-limited lock and a heavy-car slew.
  const steeringLimit = flowFestCarSteeringLimitRadians(spec, speed, grip);
  const targetSteering = steer * steeringLimit;
  const steerRate =
    steer !== 0
      ? spec.steerRateRadiansPerSecond /
        (1 + Math.abs(speed) / config.steerRateHalvingSpeedMetersPerSecond)
      : config.steerReturnRateRadiansPerSecond;
  const steeringRadians = moveTowards(
    current.steeringRadians,
    targetSteering,
    steerRate * deltaSeconds
  );
  const yawRate =
    (speed * Math.tan(steeringRadians)) / Math.max(spec.wheelbaseMeters, 0.5);
  const headingRadians = wrapFlowFestGroundVehicleAngle(
    current.headingRadians + yawRate * deltaSeconds
  );

  const longitudinalAccelerationMetersPerSecondSquared =
    (speed - startingSpeed) / deltaSeconds;
  const lateralAccelerationMetersPerSecondSquared = speed * yawRate;
  const targetPitch = clamp(
    longitudinalAccelerationMetersPerSecondSquared *
      spec.bodyPitchGainRadiansPerMeterPerSecondSquared,
    -config.maximumBodyPitchRadians,
    config.maximumBodyPitchRadians
  );
  const targetRoll = clamp(
    lateralAccelerationMetersPerSecondSquared *
      spec.bodyRollGainRadiansPerMeterPerSecondSquared,
    -config.maximumBodyRollRadians,
    config.maximumBodyRollRadians
  );

  const distance = Math.abs(speed) * deltaSeconds;
  let wheelTravelMeters = current.wheelTravelMeters + speed * deltaSeconds;
  if (Math.abs(wheelTravelMeters) > config.wheelTravelWrapMeters) {
    wheelTravelMeters %= config.wheelTravelWrapMeters;
  }

  const state: FlowFestCarDynamics = {
    speedMetersPerSecond: speed,
    headingRadians,
    steeringRadians,
    bodyPitchRadians: damp(
      current.bodyPitchRadians,
      targetPitch,
      config.bodyResponsePerSecond,
      deltaSeconds
    ),
    bodyRollRadians: damp(
      current.bodyRollRadians,
      targetRoll,
      config.bodyResponsePerSecond,
      deltaSeconds
    ),
    odometerMeters: current.odometerMeters + distance,
    wheelTravelMeters,
  };

  return {
    state,
    displacement: {
      x: Math.sin(headingRadians) * speed * deltaSeconds,
      z: Math.cos(headingRadians) * speed * deltaSeconds,
    },
    longitudinalAccelerationMetersPerSecondSquared,
    lateralAccelerationMetersPerSecondSquared,
  };
}
