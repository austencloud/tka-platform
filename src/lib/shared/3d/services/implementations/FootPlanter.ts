/**
 * FootPlanter
 *
 * Post-process foot IK that pins feet to the ground during contact phases.
 * Runs each frame after LocomotionAnimator writes bone quaternions from
 * animation clips, and before AvatarAnimator applies arm IK for props.
 *
 * Algorithm per frame:
 * 1. Read each foot bone's world position (written by animation mixer)
 * 2. Track foot velocity to detect contact phase (velocity near zero = planted)
 * 3. When foot is planted, lock its world XZ position and set Y to ground
 * 4. Solve two-bone IK (UpLeg -> Leg -> Foot) to reach the locked target
 * 5. Adjust Hips Y so the lowest planted foot doesn't over-extend the chain
 * 6. Blend between animation pose and IK solution based on contact weight
 *
 * Uses the same IKSolver.solveTwoBone() that arm IK uses — the math is
 * identical, just applied to leg chains with a forward pole hint (knees
 * bend forward, not backward like elbows).
 */

import { Vector3, Quaternion } from "three";
import type {
  IFootPlanter,
  FootPlanterInput,
  FootPlanterConfig,
} from "../contracts/IFootPlanter";
import type { IAvatarSkeletonBuilder, BoneChain } from "../contracts/IAvatarSkeletonBuilder";
import type { IIKSolver, IKTarget } from "../contracts/IIKSolver";
import { LocomotionState } from "../contracts/IAnimationStateMachine";

// ── Defaults ──

const DEFAULT_CONFIG: Required<FootPlanterConfig> = {
  contactVelocityThreshold: 0.15,
  lockBlendInTime: 0.08,
  lockBlendOutTime: 0.15,
  maxPelvisAdjust: 0.1,
  // Distance from Mixamo ankle bone to bottom of foot sole.
  // Measured from typical Mixamo humanoid: ankle joint sits ~7cm above ground.
  // Too small = feet clip into floor. Too large = feet hover.
  footHeightOffset: 0.07,
};

/**
 * Per-foot tracking state.
 * Tracks position history for velocity computation and IK blend weight.
 */
interface FootState {
  /** Previous frame's world position (for velocity computation) */
  prevWorldPos: Vector3;
  /** Smoothed velocity magnitude (units/sec) */
  smoothedVelocity: number;
  /** Current IK blend weight: 0 = animation drives, 1 = IK drives */
  ikWeight: number;
  /** The world-space XZ position where this foot is locked */
  lockTarget: Vector3;
  /** Whether the foot is currently locked (in contact phase) */
  isLocked: boolean;
}

function createFootState(): FootState {
  return {
    prevWorldPos: new Vector3(),
    smoothedVelocity: 1, // Start high so feet don't lock on first frame
    ikWeight: 0,
    lockTarget: new Vector3(),
    isLocked: false,
  };
}

export class FootPlanter implements IFootPlanter {
  private skeleton: IAvatarSkeletonBuilder | null = null;
  private ikSolver: IIKSolver | null = null;
  private config: Required<FootPlanterConfig> = { ...DEFAULT_CONFIG };

  private leftFoot: FootState = createFootState();
  private rightFoot: FootState = createFootState();

  private leftLegChain: BoneChain | null = null;
  private rightLegChain: BoneChain | null = null;

  // Knees bend forward — the pole hint tells the IK solver which
  // direction the "elbow" (knee) should point.
  private readonly kneePoleHint = new Vector3(0, 0, 1);

  // Reusable vectors to avoid per-frame allocation
  private readonly tempFootWorld = new Vector3();
  private readonly tempHipsWorld = new Vector3();
  private readonly tempTarget = new Vector3();

  private initialized = false;
  private firstFrame = true;

  initialize(skeleton: IAvatarSkeletonBuilder, ikSolver: IIKSolver): void {
    this.skeleton = skeleton;
    this.ikSolver = ikSolver;
    this.leftLegChain = skeleton.getLeftLegChain();
    this.rightLegChain = skeleton.getRightLegChain();
    this.initialized = !!(this.leftLegChain && this.rightLegChain);

    if (!this.initialized) {
      console.warn("[FootPlanter] Leg chains not available — foot IK disabled");
    }
  }

  update(delta: number, input: FootPlanterInput): void {
    if (!this.initialized || !this.skeleton || !this.ikSolver) return;
    if (!this.leftLegChain || !this.rightLegChain) return;

    // Skip foot planting during airborne states — let the animation play freely
    if (
      input.locomotionState === LocomotionState.JUMPING ||
      input.locomotionState === LocomotionState.FALLING
    ) {
      // Fade out any existing locks smoothly
      this.fadeOutFoot(this.leftFoot, delta);
      this.fadeOutFoot(this.rightFoot, delta);
      return;
    }

    // 1. Read current foot positions from animation
    this.leftLegChain.effector.getWorldPosition(this.tempFootWorld);
    const leftFootPos = this.tempFootWorld.clone();

    this.rightLegChain.effector.getWorldPosition(this.tempFootWorld);
    const rightFootPos = this.tempFootWorld.clone();

    // First frame: seed previous positions (no velocity data yet)
    if (this.firstFrame) {
      this.leftFoot.prevWorldPos.copy(leftFootPos);
      this.rightFoot.prevWorldPos.copy(rightFootPos);
      this.firstFrame = false;
      return;
    }

    // 2. Compute foot velocities from ANIMATION-DRIVEN positions (pre-IK).
    // CRITICAL: We must compare animation→animation positions, NOT animation→post-IK.
    // If we stored post-IK positions last frame, the velocity would spike every frame:
    //   Frame N: mixer=0.08 → IK pins to 0.001 → store 0.001
    //   Frame N+1: mixer=0.08 → prev=0.001 → velocity=HUGE → contact flickers
    // By storing pre-IK positions, velocity reflects actual animation movement.
    const dt = Math.max(delta, 1 / 120); // Guard against zero delta
    this.updateFootVelocity(this.leftFoot, leftFootPos, dt);
    this.updateFootVelocity(this.rightFoot, rightFootPos, dt);

    // Store PRE-IK positions for next frame's velocity computation
    this.leftFoot.prevWorldPos.copy(leftFootPos);
    this.rightFoot.prevWorldPos.copy(rightFootPos);

    // 3. Detect contact phase and manage lock targets
    this.updateContactPhase(this.leftFoot, leftFootPos, input, this.leftLegChain);
    this.updateContactPhase(this.rightFoot, rightFootPos, input, this.rightLegChain);

    // 4. Blend IK weights (smooth ramp in/out)
    this.updateIKWeight(this.leftFoot, delta);
    this.updateIKWeight(this.rightFoot, delta);

    // 5. Adjust pelvis height so planted feet reach the ground
    this.adjustPelvisHeight(input.groundY);

    // 6. Solve and apply leg IK for each foot
    this.applyFootIK(this.leftLegChain, this.leftFoot, input.groundY);
    this.applyFootIK(this.rightLegChain, this.rightFoot, input.groundY);

  }

  configure(config: FootPlanterConfig): void {
    this.config = { ...this.config, ...config };
  }

  isReady(): boolean {
    return this.initialized;
  }

  dispose(): void {
    this.skeleton = null;
    this.ikSolver = null;
    this.leftLegChain = null;
    this.rightLegChain = null;
    this.initialized = false;
    this.firstFrame = true;
    this.leftFoot = createFootState();
    this.rightFoot = createFootState();
  }

  // ── Velocity tracking ──

  /**
   * Compute smoothed velocity from position delta.
   * Uses exponential smoothing to filter jitter from animation sampling.
   */
  private updateFootVelocity(foot: FootState, currentPos: Vector3, dt: number): void {
    const dx = currentPos.x - foot.prevWorldPos.x;
    const dy = currentPos.y - foot.prevWorldPos.y;
    const dz = currentPos.z - foot.prevWorldPos.z;
    const rawVelocity = Math.sqrt(dx * dx + dy * dy + dz * dz) / dt;

    // Exponential smoothing — 0.3 gives quick response while filtering spikes
    const smoothFactor = 0.3;
    foot.smoothedVelocity += (rawVelocity - foot.smoothedVelocity) * smoothFactor;
    // NOTE: prevWorldPos is updated in the main update() method AFTER velocity
    // computation, using pre-IK positions. Do NOT update it here.
  }

  // ── Contact phase detection ──

  /**
   * Determine if a foot is in contact phase (should be locked to ground).
   * When foot velocity drops below threshold, lock it at its current XZ
   * and the ground Y.
   */
  private updateContactPhase(
    foot: FootState,
    currentPos: Vector3,
    input: FootPlanterInput,
    legChain: BoneChain
  ): void {
    const threshold = this.config.contactVelocityThreshold;

    if (foot.smoothedVelocity < threshold) {
      // Foot is slow enough to be in stance phase
      if (!foot.isLocked) {
        // Lock the foot at its current XZ, snapped to ground Y
        foot.lockTarget.set(
          currentPos.x,
          input.groundY + this.config.footHeightOffset,
          currentPos.z
        );
        foot.isLocked = true;
      } else {
        // Already locked — check if the target has drifted too far from the hip.
        // If the character has moved but the foot is still locked at its old position,
        // the leg would stretch impossibly. Unlock when target exceeds chain reach.
        legChain.root.getWorldPosition(this.tempFootWorld);
        const dx = foot.lockTarget.x - this.tempFootWorld.x;
        const dy = foot.lockTarget.y - this.tempFootWorld.y;
        const dz = foot.lockTarget.z - this.tempFootWorld.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        const maxReach = legChain.totalLength * 0.95; // 95% to avoid hyper-extension
        if (distSq > maxReach * maxReach) {
          foot.isLocked = false;
        }
      }
    } else {
      // Foot is moving — release the lock
      foot.isLocked = false;
    }
  }

  // ── IK weight management ──

  /**
   * Smoothly ramp IK weight toward target (1 when locked, 0 when free).
   * Uses exponential lerp for framerate-independent blending.
   */
  private updateIKWeight(foot: FootState, delta: number): void {
    const targetWeight = foot.isLocked ? 1 : 0;
    const rampTime = foot.isLocked
      ? this.config.lockBlendInTime
      : this.config.lockBlendOutTime;

    if (rampTime <= 0) {
      foot.ikWeight = targetWeight;
    } else {
      const factor = 1 - Math.exp(-delta / rampTime);
      foot.ikWeight += (targetWeight - foot.ikWeight) * factor;
    }

    // Snap to 0 or 1 when very close
    if (foot.ikWeight < 0.005) foot.ikWeight = 0;
    if (foot.ikWeight > 0.995) foot.ikWeight = 1;
  }

  /**
   * Fade out a foot's IK weight (used when entering airborne states).
   */
  private fadeOutFoot(foot: FootState, delta: number): void {
    foot.isLocked = false;
    const factor = 1 - Math.exp(-delta / this.config.lockBlendOutTime);
    foot.ikWeight += (0 - foot.ikWeight) * factor;
    if (foot.ikWeight < 0.005) foot.ikWeight = 0;
  }

  // ── Pelvis height adjustment ──

  /**
   * Lower the Hips bone so the lowest planted foot can reach the ground
   * without over-extending the leg chain.
   *
   * Without this, a planted foot on one side can pull the leg straight
   * while the other foot floats above ground.
   */
  private adjustPelvisHeight(groundY: number): void {
    if (!this.skeleton) return;

    const hipsBone = this.skeleton.getBone("Hips");
    if (!hipsBone) return;

    // Only adjust if at least one foot is significantly locked
    const maxWeight = Math.max(this.leftFoot.ikWeight, this.rightFoot.ikWeight);
    if (maxWeight < 0.01) return;

    // Compute how far each foot needs to move down to reach ground
    let leftDrop = 0;
    let rightDrop = 0;

    if (this.leftFoot.ikWeight > 0.01 && this.leftLegChain) {
      this.leftLegChain.effector.getWorldPosition(this.tempFootWorld);
      const footY = this.tempFootWorld.y;
      const targetY = groundY + this.config.footHeightOffset;
      leftDrop = footY - targetY; // Positive when foot is above ground
    }

    if (this.rightFoot.ikWeight > 0.01 && this.rightLegChain) {
      this.rightLegChain.effector.getWorldPosition(this.tempFootWorld);
      const footY = this.tempFootWorld.y;
      const targetY = groundY + this.config.footHeightOffset;
      rightDrop = footY - targetY;
    }

    // Use the larger drop (the foot that's furthest from ground)
    const drop = Math.max(leftDrop, rightDrop);
    if (drop <= 0) return; // Feet are already at or below ground

    // Clamp to prevent extreme corrections
    const clampedDrop = Math.min(drop, this.config.maxPelvisAdjust);

    // Scale by max IK weight so the adjustment fades with the IK blend
    const adjustedDrop = clampedDrop * maxWeight;

    // Apply: lower Hips in local space (Y is up for Mixamo skeletons)
    hipsBone.position.y -= adjustedDrop;
    hipsBone.updateMatrixWorld(true);
  }

  // ── Foot IK solve ──

  /**
   * Solve two-bone IK for one leg and blend with the animation pose.
   */
  private applyFootIK(
    chain: BoneChain,
    foot: FootState,
    groundY: number
  ): void {
    if (foot.ikWeight < 0.001 || !this.ikSolver) return;

    // Save animation-driven quaternions before IK overwrites them
    const animRootQuat = chain.root.quaternion.clone();
    const animMiddleQuat = chain.middle.quaternion.clone();

    // Build IK target: the locked ground position
    this.tempTarget.copy(foot.lockTarget);
    // Ensure target Y is at ground level
    this.tempTarget.y = groundY + this.config.footHeightOffset;

    const target: IKTarget = {
      position: this.tempTarget,
      weight: 1,
      poleHint: this.kneePoleHint,
    };

    // Solve IK — this overwrites chain.root and chain.middle quaternions
    this.ikSolver.solveAndApply(chain, target);

    // Read the IK result
    const ikRootQuat = chain.root.quaternion.clone();
    const ikMiddleQuat = chain.middle.quaternion.clone();

    // Blend: slerp from animation pose toward IK solution
    const w = foot.ikWeight;
    chain.root.quaternion.copy(animRootQuat).slerp(ikRootQuat, w);
    chain.middle.quaternion.copy(animMiddleQuat).slerp(ikMiddleQuat, w);

    // Update matrices from hip down so foot world position reflects the blend
    chain.root.updateMatrixWorld(true);
  }
}
