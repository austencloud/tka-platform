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
 * Uses the same IKSolver.solveTwoBone() that arm IK uses - the math is
 * identical, just applied to leg chains with a forward pole hint (knees
 * bend forward, not backward like elbows).
 */

import { Vector3 } from "three";
import type {
  IFootPlanter,
  FootPlanterInput,
  FootPlanterConfig,
} from "../contracts/IFootPlanter";
import type { IAvatarSkeletonBuilder, BoneChain } from "../contracts/IAvatarSkeletonBuilder";
import type { ILegIKSolver, LegIKInput } from "../contracts/ILegIKSolver";
import type { IContactCurveCache } from "../contracts/IContactCurveCache";
import { LocomotionState } from "../contracts/IAnimationStateMachine";
import { KneeHingeAxisCalibrator } from "./KneeHingeAxisCalibrator";

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
  private legIKSolver: ILegIKSolver | null = null;
  private contactCurveCache: IContactCurveCache | null = null;
  private config: Required<FootPlanterConfig> = { ...DEFAULT_CONFIG };

  private leftFoot: FootState = createFootState();
  private rightFoot: FootState = createFootState();

  private leftLegChain: BoneChain | null = null;
  private rightLegChain: BoneChain | null = null;

  // Per-leg hinge axes derived from bind-pose rest directions at init time.
  // These never change during playback - the knee is a hinge, not a ball joint.
  private leftKneeHingeAxis = new Vector3(1, 0, 0);
  private rightKneeHingeAxis = new Vector3(1, 0, 0);

  // Reusable vectors to avoid per-frame allocation
  private readonly tempFootWorld = new Vector3();
  private readonly tempHipsWorld = new Vector3();
  private readonly tempTarget = new Vector3();
  private readonly poleDirection = new Vector3(0, 0, 1);
  private readonly worldUp = new Vector3(0, 1, 0);

  private initialized = false;
  private firstFrame = true;

  initialize(
    skeleton: IAvatarSkeletonBuilder,
    legIKSolver: ILegIKSolver,
    contactCurveCache: IContactCurveCache
  ): void {
    this.skeleton = skeleton;
    this.legIKSolver = legIKSolver;
    this.contactCurveCache = contactCurveCache;
    this.leftLegChain = skeleton.getLeftLegChain();
    this.rightLegChain = skeleton.getRightLegChain();
    this.initialized = !!(this.leftLegChain && this.rightLegChain);

    if (!this.initialized) {
      console.warn("[FootPlanter] Leg chains not available - foot IK disabled");
      return;
    }

    // Derive per-leg hinge axes from bind-pose rest directions
    const calibrator = new KneeHingeAxisCalibrator();
    if (this.leftLegChain) {
      this.leftKneeHingeAxis.copy(
        calibrator.compute(this.leftLegChain.rootRestDir, this.leftLegChain.middleRestDir)
      );
    }
    if (this.rightLegChain) {
      this.rightKneeHingeAxis.copy(
        calibrator.compute(this.rightLegChain.rootRestDir, this.rightLegChain.middleRestDir)
      );
    }
  }

  update(delta: number, input: FootPlanterInput): void {
    if (!this.initialized || !this.skeleton || !this.legIKSolver) return;
    if (!this.leftLegChain || !this.rightLegChain) return;

    // Skip foot planting during airborne states - let the animation play freely
    if (
      input.locomotionState === LocomotionState.JUMPING ||
      input.locomotionState === LocomotionState.FALLING
    ) {
      // Fade out any existing locks smoothly
      this.fadeOutFoot(this.leftFoot, delta);
      this.fadeOutFoot(this.rightFoot, delta);
      return;
    }

    // Skip foot planting during idle when no turn clip is active.
    // The idle animation already places feet correctly on the ground.
    // Running IK over the idle pose replaces the mixer's knee rotations
    // with hinge-only rotations, producing mangled poses ("pretzel bug").
    // Foot planting only helps during walking (prevents foot sliding) and
    // turns (plants the pivot foot via authored contact curves).
    if (
      input.locomotionState === LocomotionState.IDLE &&
      !input.isMoving &&
      !input.currentClipName
    ) {
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
    this.updateContactPhase(this.leftFoot, leftFootPos, input, this.leftLegChain, true);
    this.updateContactPhase(this.rightFoot, rightFootPos, input, this.rightLegChain, false);

    // 4. Blend IK weights (smooth ramp in/out)
    this.updateIKWeight(this.leftFoot, delta);
    this.updateIKWeight(this.rightFoot, delta);

    // 5. Adjust pelvis height so planted feet reach the ground
    this.adjustPelvisHeight(input.groundY);

    // 6. Solve and apply leg IK for each foot
    this.applyFootIK(this.leftLegChain, this.leftFoot, input.groundY, this.leftKneeHingeAxis);
    this.applyFootIK(this.rightLegChain, this.rightFoot, input.groundY, this.rightKneeHingeAxis);

  }

  configure(config: FootPlanterConfig): void {
    this.config = { ...this.config, ...config };
  }

  isReady(): boolean {
    return this.initialized;
  }

  dispose(): void {
    this.skeleton = null;
    this.legIKSolver = null;
    this.contactCurveCache = null;
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

    // Exponential smoothing - 0.3 gives quick response while filtering spikes
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
    legChain: BoneChain,
    isLeftFoot: boolean
  ): void {
    // Contact curve path: if the current clip has authored curves, use them
    // instead of velocity detection. Curves are authoritative because turn
    // clips have pivot feet with zero velocity for their entire stance phase -
    // the velocity heuristic would either lock too aggressively or miss the
    // planting entirely depending on how the threshold is tuned.
    if (
      this.contactCurveCache &&
      input.currentClipName &&
      input.currentClipPhase !== undefined &&
      this.contactCurveCache.has(input.currentClipName)
    ) {
      const sample = this.contactCurveCache.getContactAt(
        input.currentClipName,
        input.currentClipPhase
      );
      const contactValue = isLeftFoot ? sample.leftFoot : sample.rightFoot;
      const shouldLock = contactValue > 0.5;

      if (shouldLock && !foot.isLocked) {
        foot.lockTarget.set(
          currentPos.x,
          input.groundY + this.config.footHeightOffset,
          currentPos.z
        );
        foot.isLocked = true;
      } else if (!shouldLock) {
        foot.isLocked = false;
      }
      return;
    }

    // Velocity fallback (existing behavior - preserved exactly)
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
        // Already locked - check if the target has drifted too far from the hip.
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
      // Foot is moving - release the lock
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
   * Solve two-bone IK for one leg using the hinge-constrained leg solver.
   * The solver handles weight blending internally, so no slerp is needed here.
   */
  private applyFootIK(
    chain: BoneChain,
    foot: FootState,
    groundY: number,
    hingeAxis: Vector3
  ): void {
    if (foot.ikWeight < 0.001 || !this.legIKSolver) return;

    // Build IK target: the locked ground position, snapped to ground Y
    this.tempTarget.copy(foot.lockTarget);
    this.tempTarget.y = groundY + this.config.footHeightOffset;

    const input: LegIKInput = {
      chain,
      footTarget: this.tempTarget,
      groundNormal: this.worldUp,
      footForward: this.poleDirection,
      kneeHingeAxis: hingeAxis,
      poleDirection: this.poleDirection,
      weight: foot.ikWeight,
    };

    this.legIKSolver.solve(input);

    // ILegIKSolver does its own weight blending, so no slerp here.
    // Update matrices from hip down so foot world position reflects the solve.
    chain.root.updateMatrixWorld(true);
  }
}
