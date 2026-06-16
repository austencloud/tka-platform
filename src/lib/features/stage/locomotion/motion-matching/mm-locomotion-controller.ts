// src/lib/features/stage/locomotion/motion-matching/mm-locomotion-controller.ts

import { Quaternion } from "three";
import type { Bone } from "three";
import { Vector3 } from "three";
import { startInertialize, applyInertialize, type Inertializer } from "./inertialization";
import type { RigBinding } from "./rig-binding";

/**
 * Drop-in shape mirroring locomotion-controller.ts:9-14 so call sites that read
 * the legacy controller's `state` work unchanged against this controller.
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

const INERTIALIZE_SEC = 0.25; // pose blend duration on a clip switch
/** Body turn rate (rad/s) while reorienting — ~90° in ~0.8s. Facing is driven
 *  deterministically toward the target (capped per frame so it can NEVER
 *  overshoot), which is what kills the oscillation the noisy root-motion yaw
 *  caused. The turn clip supplies the stepping look, not the rotation. */
const TURN_RATE = 2.0;
/** Settle tolerance (rad, ~1.7°). Within this of target → snap exactly + stop. */
const STOP_TOL = 0.03;
/** Minimum time (sec) to commit to a clip before allowing a switch — prevents
 *  flip-flop snapping between clips. */
const MIN_DWELL_SEC = 0.3;

/** Turn clips are one-shot pivots (play once, hold at end); idle loops. Looping
 *  a turn snaps the legs back to the step start — the "twitch". */
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
 * Reorient-in-place locomotion controller. Facing is driven deterministically
 * toward the target (capped rate, no overshoot, settles in a deadzone); a turn
 * clip is selected by intent (left/right while turning, idle when settled) and
 * supplies the visible stepping pose, smoothed across switches by
 * inertialization. The accumulated facing is written to the rig root.
 *
 * For this discrete clip set, intent-gated selection is the correct regime (the
 * turn-in-place design notes MM search is overkill here); the feature DB /
 * search modules remain for the future richer-clip phase.
 *
 * Depends ONLY on the {@link RigBinding} interface and the inertialization unit
 * — no package imports — so it can be driven by any rig provider.
 */
export class MmLocomotionController {
  private current: { clipId: string; time: number } | null = null;
  private idleClipId = "idle";
  private readonly bones = new Map<string, Bone>();
  private readonly inert = new Map<string, Inertializer>();
  private readonly durations = new Map<string, number>();
  /** Seconds played on the current clip since the last clip switch. */
  private timeSinceSwitch = 0;
  /** True once a one-shot clip (a turn) has reached its end and is held. */
  private clipDone = false;

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
   * Cache clip durations + tracked bones, resolve the idle/settle clip, seed
   * playback, and record the spawn origin for {@link stepBackToOrigin}.
   */
  async initialize(): Promise<void> {
    const specs = this.rig.clipSpecs();

    for (const s of specs) this.durations.set(s.clipId, s.durationSec);

    // Resolve the idle/rest clip (the settle target); fall back to the first.
    const idle = specs.find((s) => s.clipId.includes("idle"));
    this.idleClipId = idle?.clipId ?? specs[0]?.clipId ?? "idle";

    for (const name of TRACKED_BONES) {
      const b = this.rig.getBone(name);
      if (b) this.bones.set(name, b);
    }

    // Seed on idle so update() has a playing frame from the start.
    this.current = { clipId: this.idleClipId, time: 0 };

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
    if (!this.current) return;

    // Remaining shortest-arc angle to the target facing.
    const remaining = angleDelta(this.targetFacing, this._state.facing);
    const turning = Math.abs(remaining) > STOP_TOL;

    // Desired clip family by INTENT — deterministic, so it can never oscillate:
    // turn toward the target while outside the deadzone, idle once settled.
    const desired = turning
      ? remaining > 0
        ? "turn-left"
        : "turn-right"
      : this.idleClipId;

    // Advance the current clip's playhead. One-shot turns hold at their end;
    // looping clips (idle) wrap.
    const dur = this.durations.get(this.current.clipId) ?? 1;
    const oneShot = isOneShot(this.current.clipId);
    this.current.time += dt;
    if (this.current.time >= dur) {
      if (oneShot) {
        this.current.time = dur; // hold last frame — one pivot, no replay
        this.clipDone = true;
      } else {
        this.current.time -= dur; // looping clip (idle)
      }
    }
    this.timeSinceSwitch += dt;

    // Switch when the desired family changes, or re-trigger a finished pivot
    // while still turning. Exactly one applyClip runs per frame.
    const needSwitch =
      desired !== this.current.clipId || (this.clipDone && oneShot && turning);

    if (needSwitch && this.timeSinceSwitch >= MIN_DWELL_SEC) {
      // Capture where each bone WAS, pose the new clip at frame 0, then
      // inertialize from the old pose into the new so the swap eases (no pop).
      const oldQuats = new Map<string, Quaternion>();
      for (const [name, bone] of this.bones) oldQuats.set(name, bone.quaternion.clone());

      this.current = { clipId: desired, time: 0 };
      this.clipDone = false;
      this.timeSinceSwitch = 0;
      this.rig.applyClip(desired, 0);

      for (const [name, bone] of this.bones) {
        const oldQ = oldQuats.get(name)!; // populated in the loop directly above
        this.inert.set(name, startInertialize(oldQ, bone.quaternion, INERTIALIZE_SEC));
      }
    } else {
      this.rig.applyClip(this.current.clipId, this.current.time);
    }

    // Apply the decaying inertialization offset on top of the posed clip.
    for (const [name, bone] of this.bones) {
      const it = this.inert.get(name);
      if (it) {
        bone.quaternion.copy(applyInertialize(it, bone.quaternion, dt));
        if (it.remaining <= 0) this.inert.delete(name);
      }
    }

    // Drive facing toward the target — capped per frame so it never overshoots;
    // snap + stop inside the deadzone. This is the deterministic control that
    // replaced the noisy root-motion yaw integration (the oscillation source).
    if (turning) {
      this._state.facing +=
        Math.sign(remaining) * Math.min(Math.abs(remaining), TURN_RATE * dt);
    } else {
      this._state.facing = this.targetFacing;
    }
    this._state.speed = turning ? TURN_RATE : 0;
    this._state.isMoving = turning;

    // The accumulated facing IS the visible body rotation: the rig root carries
    // it while the clip animates the legs in local space. Position is held in
    // place for this reorient-in-place slice.
    const root = this.rig.root;
    root.position.x = this._state.position.x;
    root.position.z = this._state.position.z;
    root.rotation.y = this._state.facing;
  }
}
