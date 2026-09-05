import type { PhysicsProvider, Vector3 } from "@austencloud/camera-3d";
import {
  createFlowFestCarDynamics,
  FLOW_FEST_CAR_CONFIG,
  FLOW_FEST_CAR_FLAT_ROAD,
  stepFlowFestCar,
  type FlowFestCarDynamics,
  type FlowFestCarEnvironment,
  type FlowFestCarSpec,
} from "../domain/flow-fest-car";
import { FLOW_FEST_EUC_CONFIG } from "../domain/flow-fest-electric-unicycle";
import {
  FLOW_FEST_GROUND_VEHICLE_IDLE_INPUT,
  flowFestGroundVehicleGamepadInput,
  flowFestGroundVehicleKeyboardInput,
  mergeFlowFestGroundVehicleInput,
  reconcileFlowFestGroundVehicleTravel,
  type FlowFestGroundVehicleInput,
  type FlowFestStandardGamepadSample,
} from "../domain/flow-fest-ground-vehicle";

export interface FlowFestCarDriveFrame {
  driving: boolean;
  dynamics: FlowFestCarDynamics;
  input: FlowFestGroundVehicleInput;
  environment: FlowFestCarEnvironment;
  collisionLimited: boolean;
  /** True on a frame the drive refused to leave the surveyed square. */
  edgeLimited: boolean;
  longitudinalAccelerationMetersPerSecondSquared: number;
  lateralAccelerationMetersPerSecondSquared: number;
}

export const FLOW_FEST_CAR_EDGE_MESSAGE = "Edge of the surveyed square";

/**
 * Matches the wheel's climb envelope: a resolved ascent steeper than this
 * cannot be surface travel, so it counts as a collision instead.
 */
const MAXIMUM_GRADE_RATIO =
  Math.tan(FLOW_FEST_EUC_CONFIG.maximumTerrainPitchRadians) + 0.05;

type FrameListener = (frame: FlowFestCarDriveFrame) => void;

/**
 * The car on the electric unicycle's pattern: controls become a
 * heading-aligned planar request, and the wrapped provider (the wheel's
 * drive, which in turn wraps Rapier) keeps ownership of collision, grounding,
 * gravity and pose. While driving, the wheel is dismounted cargo and its
 * drive is a pass-through; on foot this class is a pass-through itself.
 */
export class FlowFestCarDrive implements PhysicsProvider {
  private driving = false;
  private activeCodes: readonly string[] = [];
  private gamepad: FlowFestStandardGamepadSample | null = null;
  private dynamics: FlowFestCarDynamics;
  private environment: FlowFestCarEnvironment = FLOW_FEST_CAR_FLAT_ROAD;
  private pendingPlanarMovement = { x: 0, z: 0 };
  private longitudinalAcceleration = 0;
  private lateralAcceleration = 0;
  private lastInput: FlowFestGroundVehicleInput = {
    ...FLOW_FEST_GROUND_VEHICLE_IDLE_INPUT,
  };

  constructor(
    private readonly base: PhysicsProvider,
    private spec: FlowFestCarSpec,
    initialDynamics?: Partial<FlowFestCarDynamics>,
    private readonly onFrame?: FrameListener
  ) {
    this.dynamics = createFlowFestCarDynamics(initialDynamics);
  }

  setKeyboardCodes(activeCodes: readonly string[]): void {
    this.activeCodes = activeCodes;
  }

  setGamepad(gamepad: FlowFestStandardGamepadSample | null): void {
    this.gamepad = gamepad;
  }

  setEnvironment(environment: FlowFestCarEnvironment): void {
    this.environment = environment;
  }

  setSpec(spec: FlowFestCarSpec): void {
    this.spec = spec;
  }

  getSpec(): FlowFestCarSpec {
    return this.spec;
  }

  isDriving(): boolean {
    return this.driving;
  }

  board(headingRadians: number): void {
    this.clearPendingMovement();
    this.driving = true;
    this.dynamics = createFlowFestCarDynamics({
      ...this.dynamics,
      speedMetersPerSecond: 0,
      headingRadians,
      steeringRadians: 0,
      bodyPitchRadians: 0,
      bodyRollRadians: 0,
    });
    this.longitudinalAcceleration = 0;
    this.lateralAcceleration = 0;
    this.base.setCrouch?.(false);
    this.emitFrame(false, false);
  }

  /** Only honoured below the exit speed; returns whether the driver got out. */
  exit(): boolean {
    if (
      Math.abs(this.dynamics.speedMetersPerSecond) >
      FLOW_FEST_CAR_CONFIG.exitSpeedMetersPerSecond
    ) {
      return false;
    }
    this.clearPendingMovement();
    this.driving = false;
    this.dynamics = createFlowFestCarDynamics({
      ...this.dynamics,
      speedMetersPerSecond: 0,
      steeringRadians: 0,
      bodyPitchRadians: 0,
      bodyRollRadians: 0,
    });
    this.longitudinalAcceleration = 0;
    this.lateralAcceleration = 0;
    this.emitFrame(false, false);
    return true;
  }

  replaceDynamics(
    dynamics: Partial<FlowFestCarDynamics>,
    driving: boolean
  ): void {
    this.clearPendingMovement();
    this.dynamics = createFlowFestCarDynamics(dynamics);
    this.longitudinalAcceleration = 0;
    this.lateralAcceleration = 0;
    this.driving = driving;
    this.emitFrame(false, false);
  }

  snapshot(): FlowFestCarDynamics {
    return { ...this.dynamics };
  }

  inputSnapshot(): FlowFestGroundVehicleInput {
    return { ...this.lastInput };
  }

  movePlayer(desiredMovement: Vector3, deltaTime: number): void {
    if (!this.driving) {
      this.base.movePlayer(desiredMovement, deltaTime);
      return;
    }

    const keyboard = flowFestGroundVehicleKeyboardInput(
      this.activeCodes,
      this.dynamics.speedMetersPerSecond
    );
    const gamepad = flowFestGroundVehicleGamepadInput(
      this.gamepad,
      this.dynamics.speedMetersPerSecond
    );
    this.lastInput = mergeFlowFestGroundVehicleInput(keyboard, gamepad);
    // Fixed substeps keep car time on wall time through a slow frame; the
    // bounded catch-up keeps a resumed tab from teleporting down the road.
    const simulationDeltaSeconds = Math.min(
      Math.max(deltaTime, 0),
      FLOW_FEST_CAR_CONFIG.maximumSimulationCatchUpSeconds
    );
    let remainingSeconds = simulationDeltaSeconds;
    while (remainingSeconds > 1e-9) {
      const substepSeconds = Math.min(
        remainingSeconds,
        FLOW_FEST_CAR_CONFIG.simulationSubstepSeconds
      );
      const step = stepFlowFestCar(
        this.spec,
        this.dynamics,
        this.lastInput,
        substepSeconds,
        this.environment
      );
      this.dynamics = step.state;
      this.longitudinalAcceleration =
        step.longitudinalAccelerationMetersPerSecondSquared;
      this.lateralAcceleration = step.lateralAccelerationMetersPerSecondSquared;
      this.pendingPlanarMovement.x += step.displacement.x;
      this.pendingPlanarMovement.z += step.displacement.z;
      remainingSeconds -= substepSeconds;
    }

    // The square has no wall. Refuse to leave it and say so, instead of
    // letting the car drop off the edge of the terrain.
    const position = this.base.getPlayerPosition();
    const half = FLOW_FEST_CAR_CONFIG.worldHalfExtentMeters;
    const nextX = position.x + this.pendingPlanarMovement.x;
    const nextZ = position.z + this.pendingPlanarMovement.z;
    const edgeLimited = Math.abs(nextX) > half || Math.abs(nextZ) > half;
    if (edgeLimited) {
      this.pendingPlanarMovement.x =
        Math.max(-half, Math.min(half, nextX)) - position.x;
      this.pendingPlanarMovement.z =
        Math.max(-half, Math.min(half, nextZ)) - position.z;
      this.dynamics = {
        ...this.dynamics,
        speedMetersPerSecond: 0,
      };
    }

    const pendingDistance = Math.hypot(
      this.pendingPlanarMovement.x,
      this.pendingPlanarMovement.z
    );
    const shouldFlushPlanarMovement =
      pendingDistance >= FLOW_FEST_CAR_CONFIG.minimumCollisionMovementMeters;
    const requestedPlanarMovement = shouldFlushPlanarMovement
      ? { ...this.pendingPlanarMovement }
      : { x: 0, z: 0 };

    this.base.movePlayer(
      {
        x: requestedPlanarMovement.x,
        y: desiredMovement.y,
        z: requestedPlanarMovement.z,
      },
      simulationDeltaSeconds
    );

    if (!shouldFlushPlanarMovement) {
      if (Math.abs(this.dynamics.speedMetersPerSecond) < 1e-6) {
        this.clearPendingMovement();
      }
      this.emitFrame(false, edgeLimited);
      return;
    }

    this.clearPendingMovement();
    const actual = this.base.getVelocity();
    const safeDeltaTime = Math.max(simulationDeltaSeconds, 1e-6);
    const reconciled = reconcileFlowFestGroundVehicleTravel(
      this.dynamics,
      { x: actual.x, y: actual.y, z: actual.z },
      {
        x: requestedPlanarMovement.x / safeDeltaTime,
        z: requestedPlanarMovement.z / safeDeltaTime,
      },
      { maximumGradeRatio: MAXIMUM_GRADE_RATIO }
    );
    if (reconciled.limited) {
      this.dynamics = {
        ...this.dynamics,
        speedMetersPerSecond: reconciled.speedMetersPerSecond,
      };
    }
    this.emitFrame(reconciled.limited, edgeLimited);
  }

  getPlayerPosition(): Vector3 {
    return this.base.getPlayerPosition();
  }

  isGrounded(): boolean {
    return this.base.isGrounded();
  }

  getVelocity(): Vector3 {
    return this.base.getVelocity();
  }

  teleport(position: Vector3): void {
    this.clearPendingMovement();
    this.base.teleport?.(position);
    if (this.driving) {
      this.dynamics = createFlowFestCarDynamics({
        ...this.dynamics,
        speedMetersPerSecond: 0,
        bodyPitchRadians: 0,
        bodyRollRadians: 0,
      });
      this.emitFrame(false, false);
    }
  }

  toggleNoclip(): boolean {
    if (this.driving) return false;
    return this.base.toggleNoclip?.() ?? false;
  }

  isNoclipEnabled(): boolean {
    return this.base.isNoclipEnabled?.() ?? false;
  }

  setNoclip(enabled: boolean): void {
    this.base.setNoclip?.(this.driving ? false : enabled);
  }

  /**
   * Swallowed while driving: the seat has its own collider, and a crouch
   * request resizing it back to the standing capsule would drop the car
   * through its own floor.
   */
  setCrouch(crouching: boolean): void {
    if (this.driving) return;
    this.base.setCrouch?.(crouching);
  }

  private emitFrame(collisionLimited: boolean, edgeLimited: boolean): void {
    this.onFrame?.({
      driving: this.driving,
      dynamics: { ...this.dynamics },
      input: { ...this.lastInput },
      environment: { ...this.environment },
      collisionLimited,
      edgeLimited,
      longitudinalAccelerationMetersPerSecondSquared:
        this.longitudinalAcceleration,
      lateralAccelerationMetersPerSecondSquared: this.lateralAcceleration,
    });
  }

  private clearPendingMovement(): void {
    this.pendingPlanarMovement.x = 0;
    this.pendingPlanarMovement.z = 0;
  }
}
