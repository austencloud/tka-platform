/**
 * RootMotionExtractor
 *
 * After the AnimationMixer writes bone transforms each frame, this
 * reads the Hips bone's XZ position delta (how far the animation
 * moved the character) and zeros it out so the mesh stays centered.
 *
 * The delta is in the Hips bone's local space. The caller rotates
 * it by the character's facing direction and applies it to the
 * group position with collision checks.
 *
 * Why only XZ: Y (vertical) is handled by physics gravity for
 * ground movement. Jump animations use phase clips where Y isn't
 * meaningful (physics owns the arc). If we later want animation-
 * driven Y (e.g., for a vault), we can add extractY mode.
 */

import type { Bone } from "three";
import type {
  IRootMotionExtractor,
  RootMotionDelta,
} from "../contracts/IRootMotionExtractor";

const ZERO_DELTA: RootMotionDelta = { x: 0, forward: 0 };

export class RootMotionExtractor implements IRootMotionExtractor {
  private hipsBone: Bone | null = null;

  // Previous frame's Hips position (local space).
  // X = lateral, Y = forward (Mixamo FBX→GLB coordinate mapping).
  private prevX = 0;
  private prevY = 0;
  private hasPrevious = false;

  // Rest-pose Hips position — captured before any animation plays.
  // After extracting the delta each frame, we restore to this so the
  // skeleton doesn't collapse (Hips Y = hip height above feet).
  private restX = 0;
  private restY = 0;
  private restZ = 0;

  initialize(hipsBone: Bone): void {
    this.hipsBone = hipsBone;
    this.hasPrevious = false;
    // Capture rest position before animations overwrite it
    this.restX = hipsBone.position.x;
    this.restY = hipsBone.position.y;
    this.restZ = hipsBone.position.z;
  }

  extract(): RootMotionDelta {
    if (!this.hipsBone) return ZERO_DELTA;

    // Mixamo FBX→GLB coordinate mapping (after Blender conversion):
    //   position.x = lateral (left/right)
    //   position.y = forward/backward (root motion axis!)
    //   position.z = absolute hip height (~-100cm in Mixamo units)
    const currentX = this.hipsBone.position.x;
    const currentY = this.hipsBone.position.y;

    let delta: RootMotionDelta;

    if (!this.hasPrevious) {
      delta = ZERO_DELTA;
      this.hasPrevious = true;
    } else {
      delta = {
        x: currentX - this.prevX,
        forward: currentY - this.prevY,
      };

      // Clamp absurd deltas — loop boundary where Hips jumps from
      // end position back to start. A walk at 1.4m/s at 60fps moves
      // ~2.3cm/frame in Mixamo units. 15cm is generous headroom.
      const MAX_FRAME_DELTA = 15;
      if (Math.abs(delta.x) > MAX_FRAME_DELTA || Math.abs(delta.forward) > MAX_FRAME_DELTA) {
        delta = ZERO_DELTA;
      }
    }

    // Remember absolute position for next frame's delta calculation.
    this.prevX = currentX;
    this.prevY = currentY;

    // Restore Hips XY to rest position (zero out root motion displacement).
    // Keep Z untouched — the animation's relative Z contains the natural
    // vertical hip bob during walking (hips rise and fall ~2-3cm per step).
    this.hipsBone.position.x = this.restX;
    this.hipsBone.position.y = this.restY;

    return delta;
  }

  reset(): void {
    this.hasPrevious = false;
    this.prevX = 0;
    this.prevY = 0;
  }

  isReady(): boolean {
    return this.hipsBone !== null;
  }

  dispose(): void {
    this.hipsBone = null;
    this.hasPrevious = false;
  }
}
