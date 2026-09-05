import { describe, expect, it } from "vitest";
import {
  createFlowFestCarDynamics,
  FLOW_FEST_CAR_CATALOG,
  FLOW_FEST_CAR_CONFIG,
  flowFestCarCargoSetDownPoint,
  flowFestCarDriverDoorPoint,
  flowFestCarSpec,
  flowFestCarSteeringLimitRadians,
  stepFlowFestCar,
  type FlowFestCarDynamics,
  type FlowFestCarEnvironment,
} from "../../src/lib/features/flow-fest-sim/domain/flow-fest-car";
import {
  FLOW_FEST_GROUND_VEHICLE_IDLE_INPUT,
  flowFestGroundVehicleKeyboardInput,
  type FlowFestGroundVehicleInput,
} from "../../src/lib/features/flow-fest-sim/domain/flow-fest-ground-vehicle";
import { FLOW_FEST_PARKED_CAR_MODELS } from "../../src/routes/test/flow-fest-sim/flow-fest-parked-car-catalog";

const DT = FLOW_FEST_CAR_CONFIG.simulationSubstepSeconds;
const FIFTEEN_MPH = 15 / 2.2369362921;

function input(
  overrides: Partial<FlowFestGroundVehicleInput>
): FlowFestGroundVehicleInput {
  return { ...FLOW_FEST_GROUND_VEHICLE_IDLE_INPUT, ...overrides };
}

function drive(
  modelId: string,
  start: FlowFestCarDynamics,
  control: FlowFestGroundVehicleInput,
  seconds: number,
  environment?: FlowFestCarEnvironment
): { state: FlowFestCarDynamics; travel: { x: number; z: number } } {
  const spec = flowFestCarSpec(modelId);
  let state = start;
  const travel = { x: 0, z: 0 };
  for (let elapsed = 0; elapsed < seconds; elapsed += DT) {
    const step = stepFlowFestCar(spec, state, control, DT, environment);
    state = step.state;
    travel.x += step.displacement.x;
    travel.z += step.displacement.z;
  }
  return { state, travel };
}

function secondsTo(
  modelId: string,
  targetSpeed: number,
  environment?: FlowFestCarEnvironment
): number {
  const spec = flowFestCarSpec(modelId);
  let state = createFlowFestCarDynamics();
  let elapsed = 0;
  while (state.speedMetersPerSecond < targetSpeed && elapsed < 60) {
    state = stepFlowFestCar(
      spec,
      state,
      input({ throttle: 1, source: "keyboard" }),
      DT,
      environment
    ).state;
    elapsed += DT;
  }
  return elapsed;
}

describe("Flow Fest car catalog", () => {
  it("offers every parked-car body with measured geometry and authored driving numbers", () => {
    expect(FLOW_FEST_CAR_CATALOG.map((spec) => spec.modelId)).toEqual(
      FLOW_FEST_PARKED_CAR_MODELS.map((model) => model.id)
    );
    const hatchback = flowFestCarSpec("ace-hatchback");
    // 1.101 - (-1.302) from the measured tyre contacts, not an authored number.
    expect(hatchback.wheelbaseMeters).toBeCloseTo(2.403, 3);
    expect(hatchback.trackMeters).toBeCloseTo(1.442, 3);
    expect(hatchback.lengthMeters).toBe(3.84);
    expect(hatchback.priceUsd).toBe(1800);
    expect(hatchback.cargoLitres).toBe(270);
    expect(() => flowFestCarSpec("hovercraft")).toThrow(
      /Unknown Flow Fest car/
    );
  });
});

describe("Flow Fest car dynamics", () => {
  it("launches the hatchback to 15 mph faster than the lifted pickup", () => {
    const hatchback = secondsTo("ace-hatchback", FIFTEEN_MPH);
    const pickup = secondsTo("lightbody-pickup", FIFTEEN_MPH);
    // 6.7 m/s at 3.4 m/s² is a hair over two seconds once rolling drag is paid.
    expect(hatchback).toBeGreaterThan(1.9);
    expect(hatchback).toBeLessThan(2.4);
    expect(pickup).toBeGreaterThan(hatchback + 0.4);
  });

  it("is power-limited at speed and never exceeds the top speed", () => {
    const { state } = drive(
      "ace-hatchback",
      createFlowFestCarDynamics(),
      input({ throttle: 1, source: "keyboard" }),
      90
    );
    expect(state.speedMetersPerSecond).toBeLessThanOrEqual(33);
    expect(state.speedMetersPerSecond).toBeGreaterThan(30);
    expect(state.odometerMeters).toBeGreaterThan(2000);
  });

  it("stops from 20 m/s in about 25 m on tarmac and further on grass", () => {
    const start = createFlowFestCarDynamics({ speedMetersPerSecond: 20 });
    const brake = input({ brake: 1, source: "keyboard" });
    const road = drive("ace-hatchback", start, brake, 6);
    const grass = drive("ace-hatchback", start, brake, 6, {
      gripFraction: 0.65,
      gradeSine: 0,
    });
    expect(road.state.speedMetersPerSecond).toBe(0);
    const roadDistance = Math.hypot(road.travel.x, road.travel.z);
    const grassDistance = Math.hypot(grass.travel.x, grass.travel.z);
    // v² / (2 · 8.0) = 25 m before rolling and aero drag help.
    expect(roadDistance).toBeGreaterThan(22);
    expect(roadDistance).toBeLessThan(26);
    expect(grassDistance).toBeGreaterThan(roadDistance * 1.3);
  });

  it("coasts down under engine braking and drag without a brake", () => {
    const { state } = drive(
      "fairheaven-sedan",
      createFlowFestCarDynamics({ speedMetersPerSecond: 20 }),
      FLOW_FEST_GROUND_VEHICLE_IDLE_INPUT,
      10
    );
    expect(state.speedMetersPerSecond).toBeLessThan(15);
    expect(state.speedMetersPerSecond).toBeGreaterThan(10);
  });

  it("holds a stopped car on a 12 % grade with the brake or in Park, and rolls back once it is already moving", () => {
    const hill: FlowFestCarEnvironment = {
      gripFraction: 1,
      gradeSine: 0.12,
    };
    const held = drive(
      "t2-camper",
      createFlowFestCarDynamics(),
      input({ brake: 1, source: "keyboard" }),
      2,
      hill
    );
    expect(held.state.speedMetersPerSecond).toBe(0);
    // No pedal at a standstill is Park: the hill cannot draw it back.
    const parked = drive(
      "t2-camper",
      createFlowFestCarDynamics(),
      FLOW_FEST_GROUND_VEHICLE_IDLE_INPUT,
      2,
      hill
    );
    expect(parked.state.speedMetersPerSecond).toBe(0);
    // Already rolling back faster than the hold, it keeps going:
    // 9.81 · 0.12 = 1.18 m/s² downhill against 0.5 m/s² of resistance.
    const rolling = drive(
      "t2-camper",
      createFlowFestCarDynamics({ speedMetersPerSecond: -1 }),
      FLOW_FEST_GROUND_VEHICLE_IDLE_INPUT,
      2,
      hill
    );
    expect(rolling.state.speedMetersPerSecond).toBeLessThan(-2);
  });

  it("settles a slow coast into Park instead of creeping forever", () => {
    // A 4 % descent: 0.39 m/s² of gravity is less than the 0.5 m/s² of
    // resistance, so the car slows, and once it is under the hold speed the
    // grade stops counting and it comes to rest.
    const descent: FlowFestCarEnvironment = {
      gripFraction: 1,
      gradeSine: -0.04,
    };
    const { state } = drive(
      "ace-hatchback",
      createFlowFestCarDynamics({ speedMetersPerSecond: 0.7 }),
      FLOW_FEST_GROUND_VEHICLE_IDLE_INPUT,
      3,
      descent
    );
    expect(state.speedMetersPerSecond).toBe(0);
  });

  it("reverses only from standstill and caps reverse speed", () => {
    const reverse = flowFestGroundVehicleKeyboardInput(["KeyS"], 0);
    expect(reverse.throttle).toBe(-1);
    const { state } = drive(
      "bokaroo-suv",
      createFlowFestCarDynamics(),
      reverse,
      8
    );
    expect(state.speedMetersPerSecond).toBeCloseTo(
      -FLOW_FEST_CAR_CONFIG.reverseTopSpeedMetersPerSecond,
      2
    );
    const braking = flowFestGroundVehicleKeyboardInput(["KeyS"], 10);
    expect(braking.throttle).toBe(0);
    expect(braking.brake).toBe(1);
  });

  it("caps the steering lock with speed so a fast car understeers", () => {
    const hatchback = flowFestCarSpec("ace-hatchback");
    expect(flowFestCarSteeringLimitRadians(hatchback, 0)).toBe(0.5);
    const lock = flowFestCarSteeringLimitRadians(hatchback, 20);
    // radius = L / tan(δ) must be at least v² / a_lat = 400 / 6 ≈ 66.7 m.
    expect(hatchback.wheelbaseMeters / Math.tan(lock)).toBeGreaterThan(60);
    const grassLock = flowFestCarSteeringLimitRadians(hatchback, 20, 0.65);
    expect(grassLock).toBeLessThan(lock);
  });

  it("turns left with positive steer, rolls to the outside and slews slower in the pickup", () => {
    // Coasting, so the grip-limited lock stays at full 0.5 rad around 5 m/s.
    const steerLeft = input({ steer: 1, source: "keyboard" });
    const hatchback = drive(
      "ace-hatchback",
      createFlowFestCarDynamics({ speedMetersPerSecond: 5 }),
      steerLeft,
      1
    );
    expect(hatchback.state.headingRadians).toBeGreaterThan(0.6);
    expect(hatchback.state.steeringRadians).toBeGreaterThan(0.45);
    // Turning left leans the body right: right side down is positive roll.
    expect(hatchback.state.bodyRollRadians).toBeGreaterThan(0);
    const pickup = drive(
      "lightbody-pickup",
      createFlowFestCarDynamics({ speedMetersPerSecond: 5 }),
      steerLeft,
      0.15
    );
    const hatchbackEarly = drive(
      "ace-hatchback",
      createFlowFestCarDynamics({ speedMetersPerSecond: 5 }),
      steerLeft,
      0.15
    );
    expect(pickup.state.steeringRadians).toBeLessThan(
      hatchbackEarly.state.steeringRadians
    );
  });

  it("returns the wheels to centre and settles the body when the input drops", () => {
    let state = drive(
      "fairheaven-wagon",
      createFlowFestCarDynamics({ speedMetersPerSecond: 4 }),
      input({ throttle: 1, steer: -1, source: "keyboard" }),
      1
    ).state;
    // About 6.5 m/s after a second of throttle: the lock is near 0.36 rad.
    expect(state.steeringRadians).toBeLessThan(-0.25);
    expect(state.bodyPitchRadians).toBeGreaterThan(0);
    state = drive(
      "fairheaven-wagon",
      state,
      FLOW_FEST_GROUND_VEHICLE_IDLE_INPUT,
      2
    ).state;
    expect(Math.abs(state.steeringRadians)).toBeLessThan(1e-6);
    // Coasting still decelerates about 0.5 m/s² (engine braking + rolling +
    // aero), so the nose settles into a 0.006 rad dip rather than dead level.
    expect(state.bodyPitchRadians).toBeLessThan(0);
    expect(Math.abs(state.bodyPitchRadians)).toBeLessThan(0.01);
    expect(Math.abs(state.bodyRollRadians)).toBeLessThan(0.001);
  });

  it("moves along its heading and keeps signed wheel travel", () => {
    const heading = 1.616;
    const { state, travel } = drive(
      "ace-hatchback",
      createFlowFestCarDynamics({ headingRadians: heading }),
      input({ throttle: 1, source: "keyboard" }),
      3
    );
    const distance = Math.hypot(travel.x, travel.z);
    expect(Math.atan2(travel.x, travel.z)).toBeCloseTo(heading, 5);
    expect(state.odometerMeters).toBeCloseTo(distance, 6);
    expect(state.wheelTravelMeters).toBeCloseTo(distance, 6);
  });

  it("ignores a zero or negative delta", () => {
    const spec = flowFestCarSpec("ace-hatchback");
    const start = createFlowFestCarDynamics({ speedMetersPerSecond: 4 });
    const step = stepFlowFestCar(spec, start, input({ throttle: 1 }), 0);
    expect(step.state).toEqual(start);
    expect(step.displacement).toEqual({ x: 0, z: 0 });
  });
});

describe("Flow Fest car geometry helpers", () => {
  it("puts the driver's door on the left and the wheel behind the bumper", () => {
    const spec = flowFestCarSpec("fairheaven-sedan");
    // Heading 0 faces +Z (south); the driver's left is then +X (east).
    const pose = { x: 10, z: 20, headingRadians: 0 };
    const door = flowFestCarDriverDoorPoint(spec, pose);
    expect(door.x).toBeCloseTo(10 + 1.83 / 2 + 0.4, 6);
    expect(door.z).toBeCloseTo(20, 6);
    const setDown = flowFestCarCargoSetDownPoint(spec, pose);
    expect(setDown.x).toBeCloseTo(10, 6);
    expect(setDown.z).toBeCloseTo(20 - (5.0 / 2 + 1.2), 6);
  });
});
