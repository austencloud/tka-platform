import type { PhysicsProvider, Vector3 } from "@austencloud/camera-3d";
import {
  FLOW_FEST_EUC_CONFIG,
  createFlowFestElectricUnicycleDynamics,
  flowFestEucGamepadInput,
  flowFestEucKeyboardInput,
  mergeFlowFestEucInput,
  reconcileFlowFestEucCollision,
  stepFlowFestElectricUnicycle,
  type FlowFestElectricUnicycleDynamics,
  type FlowFestElectricUnicycleInput,
  type FlowFestStandardGamepadSample,
} from "../domain/flow-fest-electric-unicycle";

export interface FlowFestElectricUnicycleDriveFrame {
  mounted: boolean;
  dynamics: FlowFestElectricUnicycleDynamics;
  input: FlowFestElectricUnicycleInput;
  collisionLimited: boolean;
  traversal: FlowFestElectricUnicycleTraversalDiagnostics | null;
  /**
   * Longitudinal acceleration from the last simulation substep, m/s².
   *
   * The dynamics compute it every substep and the displacement consumed it,
   * but nothing downstream could see it. The mounted rider pose needs it: how
   * hard the wheel is pulling or braking is what decides whether the rider
   * stands neutral, presses forward, or sits back.
   */
  longitudinalAccelerationMetersPerSecondSquared: number;
}

export interface FlowFestElectricUnicycleTraversalDiagnostics {
  grounded: boolean;
  actualVelocity: Vector3;
  requestedVelocity: Vector3;
}

type FrameListener = (frame: FlowFestElectricUnicycleDriveFrame) => void;

/**
 * Converts vehicle controls into a heading-aligned request, then delegates the
 * actual movement to the established Rapier player provider. The shared
 * provider remains the only owner of collision, grounding, gravity, and pose.
 */
export class FlowFestElectricUnicycleDrive implements PhysicsProvider {
  private mounted = true;
  private activeCodes: readonly string[] = [];
  private gamepad: FlowFestStandardGamepadSample | null = null;
  private dynamics: FlowFestElectricUnicycleDynamics;
  private pendingPlanarMovement = { x: 0, z: 0 };
  private longitudinalAcceleration = 0;
  private lastTraversal: FlowFestElectricUnicycleTraversalDiagnostics | null =
    null;
  private lastInput: FlowFestElectricUnicycleInput = {
    throttle: 0,
    brake: 0,
    steer: 0,
    performanceMode: false,
    source: "none",
  };

  constructor(
    private readonly base: PhysicsProvider,
    initialDynamics?: Partial<FlowFestElectricUnicycleDynamics>,
    private readonly onFrame?: FrameListener
  ) {
    this.dynamics = createFlowFestElectricUnicycleDynamics(initialDynamics);
  }

  setKeyboardCodes(activeCodes: readonly string[]): void {
    this.activeCodes = activeCodes;
  }

  setGamepad(gamepad: FlowFestStandardGamepadSample | null): void {
    this.gamepad = gamepad;
  }

  isMounted(): boolean {
    return this.mounted;
  }

  mount(headingRadians: number): void {
    this.clearPendingMovement();
    this.mounted = true;
    this.dynamics = createFlowFestElectricUnicycleDynamics({
      ...this.dynamics,
      speedMetersPerSecond: 0,
      headingRadians,
      leanRadians: 0,
      pitchRadians: 0,
    });
    this.emitFrame(false);
  }

  dismount(): void {
    this.clearPendingMovement();
    this.mounted = false;
    this.dynamics = createFlowFestElectricUnicycleDynamics({
      ...this.dynamics,
      speedMetersPerSecond: 0,
      leanRadians: 0,
      pitchRadians: 0,
    });
    this.base.setCrouch?.(false);
    this.emitFrame(false);
  }

  replaceDynamics(
    dynamics: Partial<FlowFestElectricUnicycleDynamics>,
    mounted: boolean
  ): void {
    this.clearPendingMovement();
    this.dynamics = createFlowFestElectricUnicycleDynamics(dynamics);
    this.longitudinalAcceleration = 0;
    this.mounted = mounted;
    this.emitFrame(false);
  }

  snapshot(): FlowFestElectricUnicycleDynamics {
    return { ...this.dynamics };
  }

  inputSnapshot(): FlowFestElectricUnicycleInput {
    return { ...this.lastInput };
  }

  movePlayer(desiredMovement: Vector3, deltaTime: number): void {
    if (!this.mounted) {
      this.base.movePlayer(desiredMovement, deltaTime);
      this.emitFrame(false);
      return;
    }

    const keyboard = flowFestEucKeyboardInput(
      this.activeCodes,
      this.dynamics.speedMetersPerSecond
    );
    const gamepad = flowFestEucGamepadInput(
      this.gamepad,
      this.dynamics.speedMetersPerSecond
    );
    this.lastInput = mergeFlowFestEucInput(keyboard, gamepad);
    // Rendering can become expensive around the live fire circle. Vehicle
    // time must still follow wall time, so consume a slow frame through small
    // deterministic dynamics steps and send Rapier one continuous sweep.
    // The bounded catch-up prevents a backgrounded tab from jumping hundreds
    // of metres when it resumes.
    const simulationDeltaSeconds = Math.min(
      Math.max(deltaTime, 0),
      FLOW_FEST_EUC_CONFIG.maximumSimulationCatchUpSeconds
    );
    let remainingSeconds = simulationDeltaSeconds;
    while (remainingSeconds > 1e-9) {
      const substepSeconds = Math.min(
        remainingSeconds,
        FLOW_FEST_EUC_CONFIG.simulationSubstepSeconds
      );
      const step = stepFlowFestElectricUnicycle(
        this.dynamics,
        this.lastInput,
        substepSeconds
      );
      this.dynamics = step.state;
      this.longitudinalAcceleration =
        step.longitudinalAccelerationMetersPerSecondSquared;
      this.pendingPlanarMovement.x += step.displacement.x;
      this.pendingPlanarMovement.z += step.displacement.z;
      remainingSeconds -= substepSeconds;
    }
    const pendingDistance = Math.hypot(
      this.pendingPlanarMovement.x,
      this.pendingPlanarMovement.z
    );
    const shouldFlushPlanarMovement =
      pendingDistance >= FLOW_FEST_EUC_CONFIG.minimumCollisionMovementMeters;
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
      this.emitFrame(false);
      return;
    }

    this.clearPendingMovement();
    const beforeCollision = this.dynamics.speedMetersPerSecond;
    const actual = this.base.getVelocity();
    const safeDeltaTime = Math.max(simulationDeltaSeconds, 1e-6);
    const grounded = this.base.isGrounded();
    const requestedVelocity = {
      x: requestedPlanarMovement.x / safeDeltaTime,
      y: desiredMovement.y / safeDeltaTime,
      z: requestedPlanarMovement.z / safeDeltaTime,
    };
    this.lastTraversal = {
      grounded,
      actualVelocity: { ...actual },
      requestedVelocity,
    };
    this.dynamics = reconcileFlowFestEucCollision(
      this.dynamics,
      { x: actual.x, y: actual.y, z: actual.z },
      {
        x: requestedVelocity.x,
        z: requestedVelocity.z,
      },
      grounded
    );
    this.emitFrame(
      Math.abs(this.dynamics.speedMetersPerSecond) + 0.02 <
        Math.abs(beforeCollision)
    );
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
    this.dynamics = createFlowFestElectricUnicycleDynamics({
      ...this.dynamics,
      speedMetersPerSecond: 0,
      leanRadians: 0,
      pitchRadians: 0,
    });
    this.emitFrame(false);
  }

  toggleNoclip(): boolean {
    if (this.mounted) return false;
    return this.base.toggleNoclip?.() ?? false;
  }

  isNoclipEnabled(): boolean {
    return this.base.isNoclipEnabled?.() ?? false;
  }

  setNoclip(enabled: boolean): void {
    this.base.setNoclip?.(this.mounted ? false : enabled);
  }

  setCrouch(crouching: boolean): void {
    this.base.setCrouch?.(this.mounted ? false : crouching);
  }

  private emitFrame(collisionLimited: boolean): void {
    this.onFrame?.({
      mounted: this.mounted,
      dynamics: { ...this.dynamics },
      input: { ...this.lastInput },
      collisionLimited,
      longitudinalAccelerationMetersPerSecondSquared:
        this.longitudinalAcceleration,
      traversal: this.lastTraversal
        ? {
            grounded: this.lastTraversal.grounded,
            actualVelocity: { ...this.lastTraversal.actualVelocity },
            requestedVelocity: { ...this.lastTraversal.requestedVelocity },
          }
        : null,
    });
  }

  private clearPendingMovement(): void {
    this.pendingPlanarMovement.x = 0;
    this.pendingPlanarMovement.z = 0;
  }
}
