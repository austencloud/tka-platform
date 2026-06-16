// src/lib/features/stage/locomotion/motion-matching/mm-locomotion-controller.ts

import { Quaternion } from "three";
import type { Bone } from "three";
import { Vector3 } from "three";
import {
  DEFAULT_WEIGHTS,
  FEATURE_STRIDE,
  type MotionDatabase,
  type MotionFrame,
} from "./feature-types";
import { buildMotionDatabase } from "./feature-extractor";
import { searchNearest } from "./search";
import { buildTrajectoryQuery, type LocomotionPose, type TrajectoryQuery } from "./trajectory";
import { startInertialize, applyInertialize, type Inertializer } from "./inertialization";
import type { RigBinding } from "./rig-binding";

/**
 * Drop-in shape mirroring locomotion-controller.ts:9-14 so call sites that read
 * the legacy controller's `state` work unchanged against the MM controller.
 */
export interface LocomotionState {
  position: Vector3;
  facing: number;
  speed: number;
  isMoving: boolean;
}

/**
 * The skeleton bones we drive through inertialization. Foot/leg bones carry the
 * locomotion pose; spine bones keep the upper body coherent across clip swaps.
 */
const TRACKED_BONES = [
  "Hips", "Spine", "Spine1", "Spine2",
  "LeftUpLeg", "LeftLeg", "LeftFoot",
  "RightUpLeg", "RightLeg", "RightFoot",
] as const;

const DB_FPS = 30;            // database sampling rate
const SEARCH_EVERY = 3;       // frames between searches (~10Hz @30fps)
const INERTIALIZE_SEC = 0.25; // blend duration on a clip switch
const REACH_SEC = 1.0;        // trajectory horizon used to reach the target
/** Min separation (sec, same clip) before a search result counts as a real jump. */
const REPLAN_TIME_EPS = 0.2;

/**
 * Motion-matching locomotion controller. Per frame it builds a trajectory query
 * from the live target, finds the nearest database frame, inertializes the
 * skeleton toward that frame's pose, advances the clip, and integrates root
 * motion into a world-space {@link LocomotionState}.
 *
 * Depends ONLY on the {@link RigBinding} interface and the Phase-1 pure units —
 * no package imports — so it can be driven by any rig provider.
 */
export class MmLocomotionController {
  private db: MotionDatabase | null = null;
  private current: { clipId: string; time: number } | null = null;
  private frameCounter = 0;
  private readonly bones = new Map<string, Bone>();
  private readonly inert = new Map<string, Inertializer>();

  private readonly _state: LocomotionState = {
    position: new Vector3(),
    facing: 0,
    speed: 0,
    isMoving: false,
  };
  private targetPos = { x: 0, z: 0 };
  private targetFacing = 0;
  private origin = { x: 0, z: 0, facing: 0 };

  constructor(private readonly rig: RigBinding) {}

  get state(): LocomotionState {
    return this._state;
  }

  /**
   * Build the motion database from the rig's clip specs and cache the tracked
   * bones. Seeds playback on the first clip and records the spawn origin so
   * {@link stepBackToOrigin} can return there.
   */
  async initialize(): Promise<void> {
    const specs = this.rig.clipSpecs();
    this.db = buildMotionDatabase(
      specs,
      (clipId, time) => this.rig.samplePose(clipId, time),
      DB_FPS,
      DEFAULT_WEIGHTS,
    );

    for (const name of TRACKED_BONES) {
      const b = this.rig.getBone(name);
      if (b) this.bones.set(name, b);
    }

    // Seed on the first clip so update() has a playing frame from the start.
    const first = specs[0];
    if (first) this.current = { clipId: first.clipId, time: 0 };

    this.origin = {
      x: this._state.position.x,
      z: this._state.position.z,
      facing: this._state.facing,
    };
  }

  setTargetFacing(rad: number): void {
    this.targetFacing = rad;
  }

  setTargetPosition(x: number, z: number): void {
    this.targetPos = { x, z };
  }

  /** Re-aim the controller back at its recorded spawn origin. */
  stepBackToOrigin(): void {
    this.targetPos = { x: this.origin.x, z: this.origin.z };
    this.targetFacing = this.origin.facing;
  }

  update(dt: number): void {
    if (!this.db || !this.current) return;

    // 1. Advance the playhead within the current clip and pose the LIVE rig to
    //    it. This must happen before readLivePose() so the query reflects the
    //    current frame, and before rootMotionDelta() so the extractor reads the
    //    legitimately-advanced hip (not a search-scrubbed one).
    this.current.time += dt;
    this.rig.applyClip(this.current.clipId, this.current.time);

    // 2. Build the trajectory + query from the LIVE pose (no scrub).
    const cur: LocomotionPose = {
      position: { x: this._state.position.x, z: this._state.position.z },
      facing: this._state.facing,
    };
    const target: LocomotionPose = { position: this.targetPos, facing: this.targetFacing };
    const traj = buildTrajectoryQuery(cur, target, REACH_SEC);

    // 3. Search at a reduced cadence (clips stay continuous between searches).
    if (this.frameCounter % SEARCH_EVERY === 0) {
      const query = this.buildQuery(traj);
      const idx = searchNearest(this.db, query);
      const frame: MotionFrame | undefined = idx >= 0 ? this.db.frames[idx] : undefined;
      const jumped =
        frame !== undefined &&
        (frame.clipId !== this.current.clipId ||
          Math.abs(frame.time - this.current.time) > REPLAN_TIME_EPS);

      if (frame && jumped) {
        // Capture where each bone WAS, switch to the matched clip frame, then
        // start an inertializer from the old pose into the new clip pose so the
        // visible transition eases instead of popping.
        const oldQuats = new Map<string, Quaternion>();
        for (const [name, bone] of this.bones) oldQuats.set(name, bone.quaternion.clone());

        this.rig.applyClip(frame.clipId, frame.time);

        for (const [name, bone] of this.bones) {
          const oldQ = oldQuats.get(name)!; // populated in the loop directly above
          this.inert.set(name, startInertialize(oldQ, bone.quaternion, INERTIALIZE_SEC));
        }

        this.current = { clipId: frame.clipId, time: frame.time };

        // The applyClip above teleported the hip to an arbitrary clip/time.
        // Reset root-motion accumulation so the next rootMotionDelta() does NOT
        // count that discontinuity as a (huge, bogus) movement delta.
        this.rig.resetRootMotion();
      }
    }

    // 4. Apply the decaying inertialization offset ON TOP of the posed clip.
    // applyClip set each bone to the clip pose; applyInertialize blends from the
    // captured old pose toward that clip pose, decaying to identity over the
    // blend duration. Dropping a finished inertializer keeps the map small.
    for (const [name, bone] of this.bones) {
      const it = this.inert.get(name);
      if (it) {
        bone.quaternion.copy(applyInertialize(it, bone.quaternion, dt));
        if (it.remaining <= 0) this.inert.delete(name);
      }
    }

    // 5. Integrate clip-driven root motion into world-space state. The delta is
    // in the character's local frame (x = lateral, forward = facing axis);
    // rotate it by the current world facing before accumulating. Thanks to the
    // resetRootMotion() in step 3, the first extract() after a switch returns
    // ~0 (the teleport is not counted).
    const rm = this.rig.rootMotionDelta();
    const cosF = Math.cos(this._state.facing);
    const sinF = Math.sin(this._state.facing);
    this._state.position.x += rm.x * cosF + rm.forward * sinF;
    this._state.position.z += -rm.x * sinF + rm.forward * cosF;
    this._state.facing += rm.yawDelta;
    this._state.speed = Math.hypot(rm.x, rm.forward) / Math.max(dt, 1e-4);
    this._state.isMoving = this._state.speed > 0.01;

    // 6. Advance the frame counter.
    this.frameCounter++;
  }

  /**
   * Assemble the live feature query. Pose position cols [0..5] come from the
   * LIVE rig pose (read without re-posing — see {@link RigBinding.readLivePose})
   * so building the query never scrambles the visible pose or pollutes the
   * root-motion extractor. Velocity cols [6..14] are left at 0 because analytic
   * live velocities aren't computed per frame — DEFAULT_WEIGHTS already
   * down-weights footVel (0.3) and hipVel (0.5), so matching leans on the
   * position and trajectory columns. Trajectory cols [15..23] come from
   * {@link buildTrajectoryQuery}.
   */
  private buildQuery(traj: TrajectoryQuery): Float32Array {
    const q = new Float32Array(FEATURE_STRIDE);

    const pose = this.rig.readLivePose();
    q[0] = pose.leftFoot[0];
    q[1] = pose.leftFoot[1];
    q[2] = pose.leftFoot[2];
    q[3] = pose.rightFoot[0];
    q[4] = pose.rightFoot[1];
    q[5] = pose.rightFoot[2];
    // Velocity cols [6..14] intentionally left at 0 — see method doc.

    // Trajectory position cols [15..20] (3 horizons x x,z).
    for (let i = 0; i < 6; i++) q[15 + i] = traj.posXZ[i] ?? 0;
    // Trajectory facing-delta cols [21..23] (3 horizons).
    for (let i = 0; i < 3; i++) q[21 + i] = traj.facing[i] ?? 0;

    return q;
  }
}
