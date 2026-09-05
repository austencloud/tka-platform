import { describe, expect, it } from "vitest";
import type { PhysicsProvider, Vector3 } from "@austencloud/camera-3d";
import {
  FLOW_FEST_CAR_EDGE_MESSAGE,
  FlowFestCarDrive,
  type FlowFestCarDriveFrame,
} from "../../src/lib/features/flow-fest-sim/services/flow-fest-car-drive";
import {
  FLOW_FEST_CAR_CONFIG,
  flowFestCarSpec,
} from "../../src/lib/features/flow-fest-sim/domain/flow-fest-car";
import { FLOW_FEST_DRIVE_IN_SPAWN } from "../../src/routes/test/flow-fest-sim/flow-fest-camp-plan";

const DT = FLOW_FEST_CAR_CONFIG.simulationSubstepSeconds;

/**
 * Stands in for the character controller: planar requests below the flush
 * threshold are dropped exactly as Rapier's controller would ignore them,
 * and a wall refuses every planar request while still reporting a velocity.
 */
class ControllerSkinPhysicsProvider implements PhysicsProvider {
  position: Vector3;
  private velocity: Vector3 = { x: 0, y: 0, z: 0 };
  crouchCalls: boolean[] = [];
  noclipCalls: boolean[] = [];
  toggleCalls = 0;

  constructor(
    position: Vector3,
    private readonly wall = false
  ) {
    this.position = { ...position };
  }

  movePlayer(desired: Vector3, deltaTime: number): void {
    const planarDistance = Math.hypot(desired.x, desired.z);
    const corrected =
      this.wall || planarDistance < 0.02
        ? { x: 0, y: desired.y, z: 0 }
        : desired;
    this.position = {
      x: this.position.x + corrected.x,
      y: this.position.y + corrected.y,
      z: this.position.z + corrected.z,
    };
    this.velocity = {
      x: corrected.x / deltaTime,
      y: corrected.y / deltaTime,
      z: corrected.z / deltaTime,
    };
  }

  getPlayerPosition(): Vector3 {
    return { ...this.position };
  }

  isGrounded(): boolean {
    return true;
  }

  getVelocity(): Vector3 {
    return { ...this.velocity };
  }

  teleport(position: Vector3): void {
    this.position = { ...position };
    this.velocity = { x: 0, y: 0, z: 0 };
  }

  toggleNoclip(): boolean {
    this.toggleCalls += 1;
    return true;
  }

  setNoclip(enabled: boolean): void {
    this.noclipCalls.push(enabled);
  }

  setCrouch(crouching: boolean): void {
    this.crouchCalls.push(crouching);
  }
}

function spawnPosition(): Vector3 {
  return { x: FLOW_FEST_DRIVE_IN_SPAWN.x, y: 1, z: FLOW_FEST_DRIVE_IN_SPAWN.z };
}

function run(
  drive: FlowFestCarDrive,
  codes: readonly string[],
  seconds: number
): void {
  drive.setKeyboardCodes(codes);
  for (let elapsed = 0; elapsed < seconds; elapsed += DT) {
    drive.movePlayer({ x: 0, y: -0.001, z: 0 }, DT);
  }
}

describe("Flow Fest car drive", () => {
  it("launches the hatchback east from the county-road spawn through the wrapped provider", () => {
    const base = new ControllerSkinPhysicsProvider(spawnPosition());
    const frames: FlowFestCarDriveFrame[] = [];
    const drive = new FlowFestCarDrive(
      base,
      flowFestCarSpec("ace-hatchback"),
      undefined,
      (frame) => frames.push(frame)
    );
    expect(drive.isDriving()).toBe(false);
    drive.board(FLOW_FEST_DRIVE_IN_SPAWN.headingRadians);
    expect(drive.isDriving()).toBe(true);
    // Boarding stands the driver up; the seat is not a crouch.
    expect(base.crouchCalls).toEqual([false]);

    run(drive, ["KeyW"], 3);
    const state = drive.snapshot();
    expect(state.speedMetersPerSecond).toBeGreaterThan(4);
    expect(state.speedMetersPerSecond).toBeLessThan(
      flowFestCarSpec("ace-hatchback").topSpeedMetersPerSecond
    );
    // Heading 1.616 rad points a hair south of east: x grows, z drifts by
    // cos/sin of the heading (−0.045 per metre east).
    const east = base.position.x - FLOW_FEST_DRIVE_IN_SPAWN.x;
    const south = base.position.z - FLOW_FEST_DRIVE_IN_SPAWN.z;
    expect(east).toBeGreaterThan(6);
    expect(south / east).toBeCloseTo(
      Math.cos(FLOW_FEST_DRIVE_IN_SPAWN.headingRadians) /
        Math.sin(FLOW_FEST_DRIVE_IN_SPAWN.headingRadians),
      3
    );
    // Everything the model travelled reached the provider except the
    // sub-threshold remainder still pending for the next frame.
    const travelled = Math.hypot(
      base.position.x - FLOW_FEST_DRIVE_IN_SPAWN.x,
      base.position.z - FLOW_FEST_DRIVE_IN_SPAWN.z
    );
    expect(Math.abs(travelled - state.odometerMeters)).toBeLessThan(
      FLOW_FEST_CAR_CONFIG.minimumCollisionMovementMeters
    );
    const last = frames.at(-1)!;
    expect(last.driving).toBe(true);
    expect(last.input).toMatchObject({ throttle: 1, brake: 0, source: "keyboard" });
    expect(last.collisionLimited).toBe(false);
    expect(last.edgeLimited).toBe(false);
    expect(last.longitudinalAccelerationMetersPerSecondSquared).toBeGreaterThan(0);
    expect(drive.inputSnapshot().throttle).toBe(1);
  });

  it("bleeds the speed when the world refuses the travel", () => {
    const base = new ControllerSkinPhysicsProvider(spawnPosition(), true);
    const frames: FlowFestCarDriveFrame[] = [];
    const drive = new FlowFestCarDrive(
      base,
      flowFestCarSpec("lightbody-pickup"),
      undefined,
      (frame) => frames.push(frame)
    );
    drive.board(FLOW_FEST_DRIVE_IN_SPAWN.headingRadians);
    run(drive, ["KeyW"], 2);
    const speeds = frames.map((frame) =>
      Math.abs(frame.dynamics.speedMetersPerSecond)
    );
    // Against a wall the motor only ever wins the frames between flushes:
    // 3.4 m/s² for the three or four frames it takes to bank 22 mm.
    expect(Math.max(...speeds)).toBeLessThan(0.5);
    const limitedFrames = frames.filter((frame) => frame.collisionLimited);
    expect(limitedFrames.length).toBeGreaterThan(10);
    expect(limitedFrames.at(-1)!.dynamics.speedMetersPerSecond).toBe(0);
    expect(base.position.x).toBe(FLOW_FEST_DRIVE_IN_SPAWN.x);
    expect(base.position.z).toBe(FLOW_FEST_DRIVE_IN_SPAWN.z);
  });

  it("keeps the door shut above walking pace and opens it once braked", () => {
    const base = new ControllerSkinPhysicsProvider(spawnPosition());
    const drive = new FlowFestCarDrive(base, flowFestCarSpec("ace-hatchback"));
    drive.board(FLOW_FEST_DRIVE_IN_SPAWN.headingRadians);
    run(drive, ["KeyW"], 3);
    expect(drive.snapshot().speedMetersPerSecond).toBeGreaterThan(
      FLOW_FEST_CAR_CONFIG.exitSpeedMetersPerSecond
    );
    expect(drive.exit()).toBe(false);
    expect(drive.isDriving()).toBe(true);

    // S above the reverse threshold is the brake pedal; the driver lifts off
    // as the car stops rather than holding it into reverse.
    drive.setKeyboardCodes(["KeyS"]);
    let braked = 0;
    while (drive.snapshot().speedMetersPerSecond > 0.3 && braked < 10) {
      drive.movePlayer({ x: 0, y: -0.001, z: 0 }, DT);
      braked += DT;
    }
    // ~8 m/s at 8 m/s² of brake: about a second.
    expect(braked).toBeGreaterThan(0.7);
    expect(braked).toBeLessThan(1.6);
    run(drive, [], 0.5);
    expect(Math.abs(drive.snapshot().speedMetersPerSecond)).toBeLessThan(
      FLOW_FEST_CAR_CONFIG.exitSpeedMetersPerSecond
    );
    expect(drive.exit()).toBe(true);
    expect(drive.isDriving()).toBe(false);
    expect(drive.snapshot().speedMetersPerSecond).toBe(0);
    const parkedHeading = drive.snapshot().headingRadians;
    expect(parkedHeading).toBeCloseTo(FLOW_FEST_DRIVE_IN_SPAWN.headingRadians, 2);

    // On foot the request goes straight through to the base provider.
    const before = base.getPlayerPosition();
    drive.setKeyboardCodes(["KeyW"]);
    drive.movePlayer({ x: 0.5, y: 0, z: -0.25 }, DT);
    expect(base.position).toEqual({
      x: before.x + 0.5,
      y: before.y,
      z: before.z - 0.25,
    });
    expect(drive.snapshot().headingRadians).toBe(parkedHeading);
  });

  it("stops at the edge of the surveyed square instead of driving off it", () => {
    const half = FLOW_FEST_CAR_CONFIG.worldHalfExtentMeters;
    const base = new ControllerSkinPhysicsProvider({ x: half - 4, y: 1, z: 0 });
    const frames: FlowFestCarDriveFrame[] = [];
    const drive = new FlowFestCarDrive(
      base,
      flowFestCarSpec("fairheaven-sedan"),
      undefined,
      (frame) => frames.push(frame)
    );
    expect(half).toBe(508);
    expect(FLOW_FEST_CAR_EDGE_MESSAGE).toBe("Edge of the surveyed square");
    // Heading π/2 faces +X, straight at the east edge four metres away.
    drive.board(Math.PI / 2);
    run(drive, ["KeyW"], 4);
    expect(base.position.x).toBeLessThanOrEqual(half + 1e-9);
    expect(base.position.x).toBeGreaterThan(half - 0.05);
    expect(frames.some((frame) => frame.edgeLimited)).toBe(true);
    expect(frames.at(-1)!.edgeLimited).toBe(true);
    expect(Math.abs(drive.snapshot().speedMetersPerSecond)).toBeLessThan(0.2);
    // The edge is not a wall in the model: nothing reads as a collision.
    expect(frames.every((frame) => !frame.collisionLimited)).toBe(true);
  });

  it("blocks noclip and crouch in the driver's seat and restores dynamics from a snapshot", () => {
    const base = new ControllerSkinPhysicsProvider(spawnPosition());
    const frames: FlowFestCarDriveFrame[] = [];
    const drive = new FlowFestCarDrive(
      base,
      flowFestCarSpec("bokaroo-suv"),
      undefined,
      (frame) => frames.push(frame)
    );
    drive.replaceDynamics(
      { headingRadians: -2.1881, odometerMeters: 886.94 },
      true
    );
    expect(drive.isDriving()).toBe(true);
    expect(drive.snapshot()).toMatchObject({
      headingRadians: -2.1881,
      odometerMeters: 886.94,
      speedMetersPerSecond: 0,
    });
    expect(frames.at(-1)!.driving).toBe(true);

    expect(drive.toggleNoclip()).toBe(false);
    expect(base.toggleCalls).toBe(0);
    drive.setNoclip(true);
    drive.setCrouch(true);
    expect(base.noclipCalls).toEqual([false]);
    // The seat collider must never be resized by a crouch request.
    expect(base.crouchCalls).toEqual([]);

    drive.teleport({ x: 329.22, y: 7.1, z: -108.5 });
    expect(base.position).toEqual({ x: 329.22, y: 7.1, z: -108.5 });
    expect(drive.snapshot().headingRadians).toBe(-2.1881);

    expect(drive.exit()).toBe(true);
    expect(drive.toggleNoclip()).toBe(true);
    expect(base.toggleCalls).toBe(1);
    drive.setCrouch(true);
    expect(base.crouchCalls).toEqual([true]);
    expect(drive.getSpec().modelId).toBe("bokaroo-suv");
    drive.setSpec(flowFestCarSpec("t2-camper"));
    expect(drive.getSpec().massKilograms).toBeGreaterThan(
      flowFestCarSpec("ace-hatchback").massKilograms
    );
  });
});
