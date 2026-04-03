/**
 * AvatarAnimator
 *
 * Manages avatar pose states and smooth animation blending.
 * Bridges TKA prop states to skeleton IK targets.
 */

import { Vector3, Quaternion } from "three";
import type {
  IAvatarAnimator,
  HandPose,
  BodyPose,
  AnimationLayer,
  TransitionConfig,
  PositionOffset,
} from "../contracts/IAvatarAnimator";
import type { IIKSolver, IKTarget } from "../contracts/IIKSolver";
import type { IAvatarSkeletonBuilder, BoneName } from "../contracts/IAvatarSkeletonBuilder";
import type { PropState3D } from "../../domain/models/PropState3D";
import type { IElbowPoleComputer } from "../contracts/IElbowPoleComputer";
import type { IClavicleRaiser } from "../contracts/IClavicleRaiser";
import type { ISpineTwister, SpineTwistResult } from "../contracts/ISpineTwister";

export class AvatarAnimator implements IAvatarAnimator {
  private currentPose: BodyPose;
  private targetPose: BodyPose;
  private layers: Map<string, AnimationLayer> = new Map();

  // Per-arm IK blend weights: 0 = animation drives the arm, 1 = IK drives the arm
  private leftArmIK = { weight: 0, targetWeight: 0 };
  private rightArmIK = { weight: 0, targetWeight: 0 };
  private ikBlendSpeed = 1 / 0.3; // ~0.3s ramp time
  private smoothBlending = true;
  private smoothingFactor = 0.15; // 0-1, higher = smoother but laggier
  private transitioning = false;
  private transitionStart: BodyPose | null = null;
  private transitionEnd: BodyPose | null = null;
  private transitionProgress = 0;
  private transitionConfig: TransitionConfig | null = null;
  private poleComputer: IElbowPoleComputer | null;
  private leftPoleVector = new Vector3(0, 0, 1);
  private rightPoleVector = new Vector3(0, 0, 1);
  private _poleVectorsEnabled = true;

  private clavicleRaiser: IClavicleRaiser | null;
  private leftClavicleQuat = new Quaternion();
  private rightClavicleQuat = new Quaternion();
  // The bone's original rest quaternion — we COMPOSE with this, never replace it
  private leftClavicleRestQuat = new Quaternion();
  private rightClavicleRestQuat = new Quaternion();
  private _clavicleRaiseEnabled = true;
  // Cached shoulder rest Y positions — captured once when skeleton loads.
  // Must NOT be read per-frame after clavicle rotation, or the elevated
  // position feeds back into the next frame and causes oscillation.
  private leftShoulderRestY = 0;
  private rightShoulderRestY = 0;
  private shoulderRestCached = false;
  private spineTwister: ISpineTwister | null;
  private spineTwistQuats = {
    spine1: new Quaternion(),
    spine2: new Quaternion(),
    neck: new Quaternion(),
    head: new Quaternion(),
    hips: new Quaternion(),
  };
  private spineTwistRestQuats = {
    spine1: new Quaternion(),
    spine2: new Quaternion(),
    neck: new Quaternion(),
    head: new Quaternion(),
    hips: new Quaternion(),
    leftUpLeg: new Quaternion(),
    rightUpLeg: new Quaternion(),
  };
  private _spineTwistEnabled = true;
  private spineRestCached = false;
  /** Which spine/head bones the model actually has — used for weight redistribution */
  private availableSpineBones = new Set<string>();

  constructor(
    private ikSolver: IIKSolver,
    private skeleton: IAvatarSkeletonBuilder,
    poleComputer?: IElbowPoleComputer,
    clavicleRaiser?: IClavicleRaiser,
    spineTwister?: ISpineTwister
  ) {
    this.poleComputer = poleComputer ?? null;
    this.clavicleRaiser = clavicleRaiser ?? null;
    this.spineTwister = spineTwister ?? null;

    const defaultPose: BodyPose = {
      leftHand: {
        targetPosition: new Vector3(-0.25, 0.5, 0),
        weight: 1,
      },
      rightHand: {
        targetPosition: new Vector3(0.25, 0.5, 0),
        weight: 1,
      },
      timestamp: Date.now(),
    };
    this.currentPose = { ...defaultPose };
    this.targetPose = { ...defaultPose };
  }

  setHandTargetsFromProps(
    blueProp: PropState3D | null,
    redProp: PropState3D | null,
    offset?: PositionOffset
  ): void {
    // Hand mapping:
    // - Blue prop = performer's LEFT hand = skeleton's LeftHand bone
    // - Red prop = performer's RIGHT hand = skeleton's RightHand bone
    //
    // From viewer's perspective (looking at performer facing us):
    // - Skeleton's LeftHand appears on screen RIGHT (+X)
    // - Skeleton's RightHand appears on screen LEFT (-X)
    //
    // offset converts world positions to local (skeleton) coordinates
    const ox = offset?.x ?? 0;
    const oy = offset?.y ?? 0;
    const oz = offset?.z ?? 0;

    if (blueProp) {
      // Blue prop → performer's left hand → skeleton's LeftHand
      this.targetPose.leftHand = {
        targetPosition: new Vector3(
          blueProp.worldPosition.x - ox,
          blueProp.worldPosition.y - oy,
          blueProp.worldPosition.z - oz
        ),
        plane: blueProp.plane,
        weight: 1,
      };
    }
    // else: no prop — animation drives the arm, don't update target

    if (redProp) {
      // Red prop → performer's right hand → skeleton's RightHand
      this.targetPose.rightHand = {
        targetPosition: new Vector3(
          redProp.worldPosition.x - ox,
          redProp.worldPosition.y - oy,
          redProp.worldPosition.z - oz
        ),
        plane: redProp.plane,
        weight: 1,
      };
    }
    // else: no prop — animation drives the arm, don't update target

    this.targetPose.timestamp = Date.now();
  }

  setPropsAndBlend(
    blueProp: PropState3D | null,
    redProp: PropState3D | null,
    offset?: PositionOffset
  ): void {
    this.leftArmIK.targetWeight = blueProp ? 1 : 0;
    this.rightArmIK.targetWeight = redProp ? 1 : 0;

    const ox = offset?.x ?? 0;
    const oy = offset?.y ?? 0;
    const oz = offset?.z ?? 0;

    if (blueProp) {
      this.targetPose.leftHand = {
        targetPosition: new Vector3(
          blueProp.worldPosition.x - ox,
          blueProp.worldPosition.y - oy,
          blueProp.worldPosition.z - oz
        ),
        plane: blueProp.plane,
        weight: 1,
      };
    }

    if (redProp) {
      this.targetPose.rightHand = {
        targetPosition: new Vector3(
          redProp.worldPosition.x - ox,
          redProp.worldPosition.y - oy,
          redProp.worldPosition.z - oz
        ),
        plane: redProp.plane,
        weight: 1,
      };
    }

    this.targetPose.timestamp = Date.now();
  }

  setLeftHandTarget(target: HandPose): void {
    this.targetPose.leftHand = { ...target };
    this.targetPose.timestamp = Date.now();
  }

  setRightHandTarget(target: HandPose): void {
    this.targetPose.rightHand = { ...target };
    this.targetPose.timestamp = Date.now();
  }

  getCurrentPose(): BodyPose {
    return this.currentPose;
  }

  update(deltaTime: number): void {
    // Ramp per-arm IK blend weights (framerate-independent exponential lerp)
    const blendFactor = 1 - Math.exp(-this.ikBlendSpeed * deltaTime);
    this.leftArmIK.weight += (this.leftArmIK.targetWeight - this.leftArmIK.weight) * blendFactor;
    this.rightArmIK.weight += (this.rightArmIK.targetWeight - this.rightArmIK.weight) * blendFactor;

    if (this.transitioning) {
      this.updateTransition(deltaTime);
    } else if (this.smoothBlending) {
      this.blendToTarget(deltaTime);
    } else {
      this.currentPose = { ...this.targetPose };
    }

    // Apply combined layers
    const finalPose = this.computeFinalPose();

    // Solve IK for arms
    this.applyIKToSkeleton(finalPose);
  }

  private blendToTarget(_deltaTime: number): void {
    // Lerp positions
    this.currentPose.leftHand.targetPosition.lerp(
      this.targetPose.leftHand.targetPosition,
      this.smoothingFactor
    );
    this.currentPose.rightHand.targetPosition.lerp(
      this.targetPose.rightHand.targetPosition,
      this.smoothingFactor
    );

    // Lerp weights
    this.currentPose.leftHand.weight +=
      (this.targetPose.leftHand.weight - this.currentPose.leftHand.weight) *
      this.smoothingFactor;
    this.currentPose.rightHand.weight +=
      (this.targetPose.rightHand.weight - this.currentPose.rightHand.weight) *
      this.smoothingFactor;

    // Plane is discrete — always take the latest target's plane
    this.currentPose.leftHand.plane = this.targetPose.leftHand.plane;
    this.currentPose.rightHand.plane = this.targetPose.rightHand.plane;

    this.currentPose.timestamp = Date.now();
  }

  private updateTransition(deltaTime: number): void {
    if (
      !this.transitionConfig ||
      !this.transitionStart ||
      !this.transitionEnd
    ) {
      return;
    }

    this.transitionProgress += deltaTime / this.transitionConfig.duration;

    if (this.transitionProgress >= 1) {
      this.transitionProgress = 1;
      this.transitioning = false;
      this.currentPose = { ...this.transitionEnd };
      return;
    }

    // Apply easing
    const t = this.applyEasing(
      this.transitionProgress,
      this.transitionConfig.easing
    );

    // Interpolate poses
    this.currentPose.leftHand.targetPosition.lerpVectors(
      this.transitionStart.leftHand.targetPosition,
      this.transitionEnd.leftHand.targetPosition,
      t
    );
    this.currentPose.rightHand.targetPosition.lerpVectors(
      this.transitionStart.rightHand.targetPosition,
      this.transitionEnd.rightHand.targetPosition,
      t
    );

    this.currentPose.timestamp = Date.now();
  }

  private applyEasing(t: number, easing: TransitionConfig["easing"]): number {
    switch (easing) {
      case "easeIn":
        return t * t;
      case "easeOut":
        return 1 - (1 - t) * (1 - t);
      case "easeInOut":
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      default:
        return t;
    }
  }

  private computeFinalPose(): BodyPose {
    // Start with current pose
    const result: BodyPose = {
      leftHand: {
        targetPosition: this.currentPose.leftHand.targetPosition.clone(),
        plane: this.currentPose.leftHand.plane,
        weight: this.currentPose.leftHand.weight,
      },
      rightHand: {
        targetPosition: this.currentPose.rightHand.targetPosition.clone(),
        plane: this.currentPose.rightHand.plane,
        weight: this.currentPose.rightHand.weight,
      },
      timestamp: this.currentPose.timestamp,
    };

    // Apply layers
    for (const layer of this.layers.values()) {
      if (layer.weight <= 0) continue;

      result.leftHand.targetPosition.lerp(
        layer.pose.leftHand.targetPosition,
        layer.weight
      );
      result.rightHand.targetPosition.lerp(
        layer.pose.rightHand.targetPosition,
        layer.weight
      );
    }

    return result;
  }

  private applyIKToSkeleton(pose: BodyPose): void {
    const state = this.skeleton.getState();
    if (!state.isLoaded) return;

    const leftChain = this.skeleton.getLeftArmChain();
    const rightChain = this.skeleton.getRightArmChain();

    // Compute body center from Hips bone (or default to origin)
    const bodyCenter = new Vector3(0, 0, 0);
    const hipsBone = state.bones.get("Hips");
    if (hipsBone) {
      hipsBone.getWorldPosition(bodyCenter);
    }

    // Cache shoulder rest Y positions once (before any clavicle rotation has been applied).
    // CRITICAL: Do NOT read these per-frame after clavicle is rotated — the elevated
    // position feeds back and causes oscillation.
    if (!this.shoulderRestCached && leftChain && rightChain) {
      const leftRoot = new Vector3();
      const rightRoot = new Vector3();
      leftChain.root.getWorldPosition(leftRoot);
      rightChain.root.getWorldPosition(rightRoot);
      this.leftShoulderRestY = leftRoot.y;
      this.rightShoulderRestY = rightRoot.y;
      // Cache the bone's original rest quaternions so we can compose with them
      // instead of overwriting them (which would destroy the shoulder's outward position)
      const leftClav = state.bones.get("LeftShoulder");
      const rightClav = state.bones.get("RightShoulder");
      if (leftClav) this.leftClavicleRestQuat.copy(leftClav.quaternion);
      if (rightClav) this.rightClavicleRestQuat.copy(rightClav.quaternion);
      this.shoulderRestCached = true;
    }

    // Cache spine bone rest quaternions once — COMPOSE with these, never replace.
    // Works with whatever bones are available (some models lack Spine2/upper_chest).
    if (!this.spineRestCached) {
      let anyFound = false;
      const cacheSpineBone = (boneName: BoneName, key: "spine1" | "spine2" | "neck" | "head") => {
        const bone = state.bones.get(boneName);
        if (bone) {
          this.spineTwistRestQuats[key].copy(bone.quaternion);
          this.availableSpineBones.add(boneName);
          anyFound = true;
        }
      };
      cacheSpineBone("Spine1", "spine1");
      cacheSpineBone("Spine2", "spine2");
      cacheSpineBone("Neck", "neck");
      cacheSpineBone("Head", "head");
      if (anyFound) this.spineRestCached = true;
    }

    // Spine twist: rotate torso toward cross-body hand positions.
    // Scale twist by max IK weight so it fades out when both arms are in animation mode.
    const maxIKWeight = Math.max(this.leftArmIK.weight, this.rightArmIK.weight);

    if (this._spineTwistEnabled && this.spineTwister && this.spineRestCached && maxIKWeight > 0.001) {
      const twistResult = this.spineTwister.computeSpineTwist(
        pose.leftHand.targetPosition,
        pose.rightHand.targetPosition,
        bodyCenter,
        this.availableSpineBones
      );

      const spine1Bone = state.bones.get("Spine1");
      if (spine1Bone) {
        const fullTwist = this.makeFullSpineTwist(twistResult);
        // Scale from identity toward full twist based on max IK weight
        const scaledTwist = new Quaternion().slerp(fullTwist, maxIKWeight);
        this.spineTwistQuats.spine1.slerp(scaledTwist, this.smoothingFactor);
        spine1Bone.quaternion
          .copy(this.spineTwistRestQuats.spine1)
          .multiply(this.spineTwistQuats.spine1);
        spine1Bone.updateMatrixWorld(true);
      }
    }

    const leftTarget = pose.leftHand.targetPosition;
    const rightTarget = pose.rightHand.targetPosition;

    if (leftChain) {
      if (this.leftArmIK.weight > 0.001) {
        // Save what the locomotion animation wrote to bone quaternions
        const animRootQuat = leftChain.root.quaternion.clone();
        const animMiddleQuat = leftChain.middle.quaternion.clone();
        const animEffectorQuat = leftChain.effector.quaternion.clone();

        // Clavicle raise: elevate shoulder bone before IK solve
        if (this._clavicleRaiseEnabled && this.clavicleRaiser && this.shoulderRestCached) {
          const leftShoulder = state.bones.get("LeftShoulder");
          if (leftShoulder) {
            const targetQuat = this.clavicleRaiser.computeClavicleRotation(
              leftTarget,
              "left",
              this.leftShoulderRestY,
              leftChain.totalLength
            );
            this.leftClavicleQuat.slerp(targetQuat, this.smoothingFactor);
            leftShoulder.quaternion
              .copy(this.leftClavicleRestQuat)
              .multiply(this.leftClavicleQuat);
            leftShoulder.updateMatrixWorld(true);
          }
        }

        // Build IK target with optional pole vector
        const target: IKTarget = {
          position: leftTarget,
          weight: pose.leftHand.weight,
        };

        if (this._poleVectorsEnabled && this.poleComputer && pose.leftHand.plane) {
          const idealPole = this.poleComputer.computePoleVector(
            leftTarget,
            pose.leftHand.plane,
            "left",
            bodyCenter
          );
          this.leftPoleVector.lerp(idealPole, this.smoothingFactor);
          this.leftPoleVector.normalize();
          target.poleHint = this.leftPoleVector.clone();
        }

        // Solve IK (overwrites bone quaternions)
        this.ikSolver.solveAndApply(leftChain, target);

        // Save IK results BEFORE blending — .copy() would overwrite them
        const ikRootQuat = leftChain.root.quaternion.clone();
        const ikMiddleQuat = leftChain.middle.quaternion.clone();
        const ikEffectorQuat = leftChain.effector.quaternion.clone();

        // Blend: slerp each bone from animation pose toward IK solution
        const w = this.leftArmIK.weight;
        leftChain.root.quaternion.copy(animRootQuat).slerp(ikRootQuat, w);
        leftChain.middle.quaternion.copy(animMiddleQuat).slerp(ikMiddleQuat, w);
        leftChain.effector.quaternion.copy(animEffectorQuat).slerp(ikEffectorQuat, w);
      }
      // else: weight ~0, skip IK entirely — animation drives the arm
    }

    if (rightChain) {
      if (this.rightArmIK.weight > 0.001) {
        // Save what the locomotion animation wrote to bone quaternions
        const animRootQuat = rightChain.root.quaternion.clone();
        const animMiddleQuat = rightChain.middle.quaternion.clone();
        const animEffectorQuat = rightChain.effector.quaternion.clone();

        // Clavicle raise: elevate shoulder bone before IK solve
        if (this._clavicleRaiseEnabled && this.clavicleRaiser && this.shoulderRestCached) {
          const rightShoulder = state.bones.get("RightShoulder");
          if (rightShoulder) {
            const targetQuat = this.clavicleRaiser.computeClavicleRotation(
              rightTarget,
              "right",
              this.rightShoulderRestY,
              rightChain.totalLength
            );
            this.rightClavicleQuat.slerp(targetQuat, this.smoothingFactor);
            rightShoulder.quaternion
              .copy(this.rightClavicleRestQuat)
              .multiply(this.rightClavicleQuat);
            rightShoulder.updateMatrixWorld(true);
          }
        }

        // Build IK target with optional pole vector
        const target: IKTarget = {
          position: rightTarget,
          weight: pose.rightHand.weight,
        };

        if (this._poleVectorsEnabled && this.poleComputer && pose.rightHand.plane) {
          const idealPole = this.poleComputer.computePoleVector(
            rightTarget,
            pose.rightHand.plane,
            "right",
            bodyCenter
          );
          this.rightPoleVector.lerp(idealPole, this.smoothingFactor);
          this.rightPoleVector.normalize();
          target.poleHint = this.rightPoleVector.clone();
        }

        // Solve IK (overwrites bone quaternions)
        this.ikSolver.solveAndApply(rightChain, target);

        // Save IK results BEFORE blending — .copy() would overwrite them
        const ikRootQuat = rightChain.root.quaternion.clone();
        const ikMiddleQuat = rightChain.middle.quaternion.clone();
        const ikEffectorQuat = rightChain.effector.quaternion.clone();

        // Blend: slerp each bone from animation pose toward IK solution
        const w = this.rightArmIK.weight;
        rightChain.root.quaternion.copy(animRootQuat).slerp(ikRootQuat, w);
        rightChain.middle.quaternion.copy(animMiddleQuat).slerp(ikMiddleQuat, w);
        rightChain.effector.quaternion.copy(animEffectorQuat).slerp(ikEffectorQuat, w);
      }
      // else: weight ~0, skip IK entirely — animation drives the arm
    }

    this.skeleton.updateMatrices();
  }

  addLayer(layer: AnimationLayer): void {
    this.layers.set(layer.id, layer);
  }

  removeLayer(layerId: string): void {
    this.layers.delete(layerId);
  }

  setLayerWeight(layerId: string, weight: number): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.weight = Math.max(0, Math.min(1, weight));
    }
  }

  async transitionTo(pose: BodyPose, config: TransitionConfig): Promise<void> {
    return new Promise((resolve) => {
      this.transitionStart = { ...this.currentPose };
      this.transitionEnd = pose;
      this.transitionConfig = config;
      this.transitionProgress = 0;
      this.transitioning = true;

      // Wait for transition to complete
      const checkComplete = () => {
        if (!this.transitioning) {
          resolve();
        } else {
          requestAnimationFrame(checkComplete);
        }
      };
      requestAnimationFrame(checkComplete);
    });
  }

  setSmoothBlending(enabled: boolean): void {
    this.smoothBlending = enabled;
  }

  setSmoothingFactor(factor: number): void {
    this.smoothingFactor = Math.max(0, Math.min(1, factor));
  }

  /**
   * Combine all spine twist weights into a single quaternion.
   * Since we only apply twist to Spine1 (children inherit naturally),
   * we sum all the individual bone rotations into one.
   */
  private makeFullSpineTwist(result: SpineTwistResult): Quaternion {
    const combined = new Quaternion();
    combined.multiply(result.spine1);
    combined.multiply(result.spine2);
    combined.multiply(result.neck);
    combined.multiply(result.head);
    return combined;
  }

  /** Debug toggle: disable pole vectors to compare old vs new elbow behavior */
  togglePoleVectors(): boolean {
    this._poleVectorsEnabled = !this._poleVectorsEnabled;
    if (!this._poleVectorsEnabled) {
      // Reset to default backward poles so difference is visible immediately
      this.leftPoleVector.set(0, 0, -1);
      this.rightPoleVector.set(0, 0, -1);
    }
    return this._poleVectorsEnabled;
  }

  /** Debug toggle: disable clavicle raise to compare old vs new shoulder behavior */
  toggleClavicleRaise(): boolean {
    this._clavicleRaiseEnabled = !this._clavicleRaiseEnabled;
    if (!this._clavicleRaiseEnabled) {
      this.leftClavicleQuat.identity();
      this.rightClavicleQuat.identity();
    }
    return this._clavicleRaiseEnabled;
  }

  /** Debug toggle: disable spine twist to compare old vs new torso behavior */
  toggleSpineTwist(): boolean {
    this._spineTwistEnabled = !this._spineTwistEnabled;
    if (!this._spineTwistEnabled) {
      this.spineTwistQuats.spine1.identity();
      this.spineTwistQuats.spine2.identity();
      this.spineTwistQuats.neck.identity();
      this.spineTwistQuats.head.identity();
    }
    return this._spineTwistEnabled;
  }
}
