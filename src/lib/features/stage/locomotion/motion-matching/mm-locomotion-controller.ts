// src/lib/features/stage/locomotion/motion-matching/mm-locomotion-controller.ts

import { Quaternion } from "three";
import type { Bone } from "three";
import { Vector3 } from "three";
import { startInertialize, applyInertialize, type Inertializer } from "./inertialization";
import type { RigBinding } from "./rig-binding";

/**
 * Drop-in shape mirroring locomotion-controller.ts so call sites that read the
 * legacy controller's `state` work unchanged against this controller.
 */
export interface LocomotionState {
  position: Vector3;
  facing: number;
  speed: number;
  isMoving: boolean;
}

/**
 * Bones smoothed across a clip switch by inertialization: legs (the visible
 * stepping) plus the spine (upper-body coherence). The HIPS bone is
 * deliberately EXCLUDED — its authored yaw is transferred into the rig root by
 * the seam bank (see {@link update}); inertializing the hips would blend that
 * ~90° yaw delta and re-create the snap-back this controller exists to remove.
 */
const INERTIALIZED_BONES = [
  "Spine", "Spine1", "Spine2",
  "LeftUpLeg", "LeftLeg", "LeftFoot",
  "RightUpLeg", "RightLeg", "RightFoot",
] as const;

/** Leg/spine pose blend duration on a clip switch. */
const INERTIALIZE_SEC = 0.2;
/** Settle deadzone (rad, ~2.9°). Sits above idle breathing sway (~1°) so the
 *  controller does not hunt between turn and idle at rest. */
const STOP_TOL = 0.05;
/** Minimum commit time (sec) before re-triggering the SAME one-shot turn clip,
 *  so a finished pivot does not re-fire every frame. Family changes (including
 *  the settle to idle) are not gated, so stopping is prompt. */
const MIN_DWELL_SEC = 0.12;

/** Turn clips are one-shot pivots (play once, hold at end); idle/walk loop. */
function isOneShot(clipId: string): boolean {
  return clipId.startsWith("turn");
}

/** Shortest-arc signed difference a-b, wrapped to [-PI, PI]. */
function angleDelta(a: number, b: number): number {
  let d = ((a - b + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Reorient-in-place locomotion controller — seam-matched root motion.
 *
 * The visible turn is produced by the authored turn clip (the hips bone carries
 * the body rotation; the legs step). The rig root stays CONSTANT during a clip;
 * at every clip switch the root yaw is adjusted by
 * `(visibleYaw_before - visibleYaw_after)` so the body's world yaw is continuous
 * across the seam. This banks each clip's authored rotation into the root, so
 * when the turn clip hands off to idle (whose hips return to neutral) there is
 * no discontinuity — the rotation already lives in the root.
 *
 * Visible facing is read from the HIPS bone's WORLD matrix (atan2 of the world
 * Z basis), which is robust; the package RootMotionExtractor derives yaw from a
 * single Euler component and is unreliable for large turn clips (measured 24°
 * for a 90° clip), so it is not used for rotation here.
 *
 * Arbitrary angles fall out for free: a partial target consumes only part of a
 * turn clip then settles; a target beyond one clip re-triggers the turn clip
 * (seam-matched, no pop) until the target is reached. The settle switch lands
 * the body EXACTLY on the requested facing.
 *
 * Depends only on the {@link RigBinding} interface plus the inertialization
 * unit, so any rig provider can drive it.
 */
export class MmLocomotionController {
  private current: { clipId: string; time: number } | null = null;
  private idleClipId = "idle";
  private leftClipId = "turn-left";
  private rightClipId = "turn-right";
  private hips: Bone | null = null;
  private readonly inertBones = new Map<string, Bone>();
  private readonly inert = new Map<string, Inertializer>();
  private readonly durations = new Map<string, number>();
  /** Seconds played on the current clip since the last clip switch. */
  private timeSinceSwitch = 0;
  /** Hips world yaw at rest (the idle frame-0 facing); the relative target zero. */
  private restVis = 0;

  private readonly _state: LocomotionState = {
    position: new Vector3(),
    facing: 0,
    speed: 0,
    isMoving: false,
  };
  /** Absolute world yaw to reach, in the same metric as {@link visYaw}. */
  private targetFacing = 0;
  private origin = { facing: 0 };

  constructor(private readonly rig: RigBinding) {}

  get state(): LocomotionState {
    return this._state;
  }

  /** Pose a clip; applyClip updates the rig's world matrices internally. */
  private pose(clipId: string, time: number): void {
    this.rig.applyClip(clipId, time);
  }

  /** The body's VISIBLE facing = hips world yaw, from the world Z basis vector.
   *  Robust under the rig's bone rest orientations (unlike Euler decomposition). */
  private visYaw(): number {
    const h = this.hips;
    if (!h) return this._state.facing;
    const e = h.matrixWorld.elements;
    return Math.atan2(e[8]!, e[10]!);
  }

  /**
   * Cache clip durations + bones, resolve idle/turn clips, seed playback on
   * idle, and record the rest facing (the relative-target zero + step-back
   * origin).
   */
  async initialize(): Promise<void> {
    const specs = this.rig.clipSpecs();
    for (const s of specs) this.durations.set(s.clipId, s.durationSec);

    this.idleClipId = specs.find((s) => s.clipId.includes("idle"))?.clipId ?? specs[0]?.clipId ?? "idle";
    this.leftClipId = specs.find((s) => s.clipId.includes("left"))?.clipId ?? "turn-left";
    this.rightClipId = specs.find((s) => s.clipId.includes("right"))?.clipId ?? "turn-right";

    this.hips = this.rig.getBone("Hips");
    for (const name of INERTIALIZED_BONES) {
      const b = this.rig.getBone(name);
      if (b) this.inertBones.set(name, b);
    }

    // Seed on idle frame 0 and capture the rest facing.
    this.rig.root.rotation.y = 0;
    this.pose(this.idleClipId, 0);
    this.rig.root.updateMatrixWorld(true);
    this.restVis = this.visYaw();

    this._state.facing = this.restVis;
    this.targetFacing = this.restVis;
    this.current = { clipId: this.idleClipId, time: 0 };
    this.origin = { facing: this.restVis };
  }

  /** Request a turn of `rad` relative to rest-forward (0 = face forward). */
  setTargetFacing(rad: number): void {
    this.targetFacing = this.restVis + rad;
  }

  /** Reorient-in-place slice: no translation target yet (kept for API parity). */
  setTargetPosition(_x: number, _z: number): void {}

  /** Re-aim back at the recorded spawn facing. */
  stepBackToOrigin(): void {
    this.targetFacing = this.origin.facing;
  }

  update(dt: number): void {
    if (!this.current || !this.hips) return;
    const root = this.rig.root;

    // Advance the current clip's playhead. One-shot turns hold at their end;
    // looping clips (idle/walk) wrap.
    const dur = this.durations.get(this.current.clipId) ?? 1;
    const oneShot = isOneShot(this.current.clipId);
    this.current.time += dt;
    let finished = false;
    if (this.current.time >= dur) {
      if (oneShot) {
        this.current.time = dur;
        finished = true;
      } else {
        this.current.time -= dur;
      }
    }
    this.timeSinceSwitch += dt;

    // Pose the current clip and read the body's visible facing from it.
    this.pose(this.current.clipId, this.current.time);
    const vis = this.visYaw();
    const remaining = angleDelta(this.targetFacing, vis);
    const turning = Math.abs(remaining) > STOP_TOL;

    // Desired clip by INTENT: turn toward the target while outside the deadzone,
    // idle once settled.
    const desired = turning
      ? remaining > 0
        ? this.leftClipId
        : this.rightClipId
      : this.idleClipId;

    // Switch on a family change (prompt — not dwell-gated, so settling is
    // immediate and exact), or re-trigger a finished pivot that still needs to
    // turn further (dwell-gated so it cannot re-fire every frame).
    const familyChange = desired !== this.current.clipId;
    const retrigger = finished && oneShot && turning && this.timeSinceSwitch >= MIN_DWELL_SEC;

    if (familyChange || retrigger) {
      // Capture leg/spine pose for inertialization (NOT hips — see header).
      const oldQ = new Map<string, Quaternion>();
      for (const [name, bone] of this.inertBones) oldQ.set(name, bone.quaternion.clone());

      const visBefore = vis;
      this.pose(desired, 0);
      const visAfter = this.visYaw();

      // Settling to idle lands EXACTLY on the requested facing; a turn->turn or
      // idle->turn switch preserves the current visible facing (continuity).
      const landYaw = desired === this.idleClipId ? this.targetFacing : visBefore;
      root.rotation.y += angleDelta(landYaw, visAfter);
      root.updateMatrixWorld(true);

      for (const [name, bone] of this.inertBones) {
        const q = oldQ.get(name)!; // populated in the loop directly above
        this.inert.set(name, startInertialize(q, bone.quaternion, INERTIALIZE_SEC));
      }

      this.current = { clipId: desired, time: 0 };
      this.timeSinceSwitch = 0;
    }

    // Apply the decaying inertialization offset on the legs/spine.
    for (const [name, bone] of this.inertBones) {
      const it = this.inert.get(name);
      if (it) {
        bone.quaternion.copy(applyInertialize(it, bone.quaternion, dt));
        if (it.remaining <= 0) this.inert.delete(name);
      }
    }

    root.updateMatrixWorld(true);
    this._state.facing = this.visYaw();
    this._state.speed = turning ? 1 : 0;
    this._state.isMoving = turning;
  }
}
