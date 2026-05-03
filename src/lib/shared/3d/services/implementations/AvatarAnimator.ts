/**
 * AvatarAnimator
 *
 * Manages avatar pose states and smooth animation blending.
 * Bridges TKA prop states to skeleton IK targets.
 */

import { Vector3, Quaternion } from "three";
import type {
  HandPose,
  BodyPose,
  AnimationLayer,
  TransitionConfig,
  PositionOffset,
  IKTarget,
  BoneName,
} from "../contracts/types";
import type { IKSolver } from "./IKSolver";
import type { AvatarSkeletonBuilder } from "./AvatarSkeletonBuilder";
import type { PropState3D } from "../../domain/models/PropState3D";
import type { ElbowPoleComputer } from "./ElbowPoleComputer";
import type { ClavicleRaiser } from "./ClavicleRaiser";
import type { SpineTwister } from "./SpineTwister";

export class AvatarAnimator {
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
  private poleComputer: ElbowPoleComputer | null;
  private leftPoleVector = new Vector3(0, 0, 1);
  private rightPoleVector = new Vector3(0, 0, 1);
  private _poleVectorsEnabled = true;

  private clavicleRaiser: ClavicleRaiser | null;
  private leftClavicleQuat = new Quaternion();
  private rightClavicleQuat = new Quaternion();
  // The bone's original rest quaternion - we COMPOSE with this, never replace it
  private leftClavicleRestQuat = new Quaternion();
  private rightClavicleRestQuat = new Quaternion();
  private _clavicleRaiseEnabled = true;
  // Cached shoulder rest Y positions - captured once when skeleton loads.
  // Must NOT be read per-frame after clavicle rotation, or the elevated
  // position feeds back into the next frame and causes oscillation.
  private leftShoulderRestY = 0;
  private rightShoulderRestY = 0;
  private shoulderRestCached = false;
  private spineTwister: SpineTwister | null;
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
  /** When true, skip SpineTwister's Hips counter-rotation so planted legs don't slide. */
  private _skipHipsTwist = false;
  private spineRestCached = false;
  /** Which spine/head bones the model actually has - used for weight redistribution */
  private availableSpineBones = new Set<string>();

  /**
   * Extra forward pitch (radians) applied to Spine1 each frame. Composed
   * on top of the twist rest pose before arm IK runs. 0 = disabled.
   */
  private externalSpinePitchRad = 0;

  constructor(
    private ikSolver: IKSolver,
    private skeleton: AvatarSkeletonBuilder,
    poleComputer?: ElbowPoleComputer,
    clavicleRaiser?: ClavicleRaiser,
    spineTwister?: SpineTwister
  ) {
    this.poleComputer = poleComputer ?? null;
    this.clavicleRaiser = clavicleRaiser ?? null;
    this.spineTwister = spineTwister ?? null;

    // Default pose: no props in either hand. Hands become non-null once
    // setPropsAndBlend / setHandTargetsFromProps is called with a prop.
    this.currentPose = {
      leftHand: null,
      rightHand: null,
      timestamp: Date.now(),
    };
    this.targetPose = {
      leftHand: null,
      rightHand: null,
      timestamp: Date.now(),
    };
  }

  /** Deep-clone a HandPose, preserving null. */
  private static cloneHandPose(p: HandPose | null): HandPose | null {
    if (!p) return null;
    return {
      targetPosition: p.targetPosition.clone(),
      wristRotation: p.wristRotation?.clone(),
      staffAngle: p.staffAngle,
      gripType: p.gripType,
      plane: p.plane,
      weight: p.weight,
    };
  }

  /** Deep-clone a BodyPose (nullable hands, cloned Vector3s). */
  private static cloneBodyPose(p: BodyPose): BodyPose {
    return {
      leftHand: AvatarAnimator.cloneHandPose(p.leftHand),
      rightHand: AvatarAnimator.cloneHandPose(p.rightHand),
      headLookAt: p.headLookAt?.clone(),
      rootOffset: p.rootOffset?.clone(),
      timestamp: p.timestamp,
    };
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

    // Blue prop → performer's left hand → skeleton's LeftHand
    // Red prop → performer's right hand → skeleton's RightHand
    // When a prop is absent, the hand becomes null so body systems know
    // not to read a stale position.
    this.targetPose.leftHand = blueProp
      ? {
          targetPosition: new Vector3(
            blueProp.worldPosition.x - ox,
            blueProp.worldPosition.y - oy,
            blueProp.worldPosition.z - oz
          ),
          plane: blueProp.plane,
          weight: 1,
        }
      : null;

    this.targetPose.rightHand = redProp
      ? {
          targetPosition: new Vector3(
            redProp.worldPosition.x - ox,
            redProp.worldPosition.y - oy,
            redProp.worldPosition.z - oz
          ),
          plane: redProp.plane,
          weight: 1,
        }
      : null;

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

    // When a prop is absent, the hand becomes null so downstream systems
    // (spine twist, clavicle, pole vectors, IK) skip the side uniformly
    // instead of reading stale positions from a prior frame.
    this.targetPose.leftHand = blueProp
      ? {
          targetPosition: new Vector3(
            blueProp.worldPosition.x - ox,
            blueProp.worldPosition.y - oy,
            blueProp.worldPosition.z - oz
          ),
          staffAngle: blueProp.staffRotationAngle,
          plane: blueProp.plane,
          weight: 1,
        }
      : null;

    this.targetPose.rightHand = redProp
      ? {
          targetPosition: new Vector3(
            redProp.worldPosition.x - ox,
            redProp.worldPosition.y - oy,
            redProp.worldPosition.z - oz
          ),
          staffAngle: redProp.staffRotationAngle,
          plane: redProp.plane,
          weight: 1,
        }
      : null;

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
    // Hands snap directly to prop positions - no lerp.
    // This keeps the wrist bones strictly locked to the grid prop location
    // so they never visually detach. Body systems (clavicle, spine twist,
    // pole vectors) still use smoothingFactor for natural motion.
    this.currentPose.leftHand = AvatarAnimator.cloneHandPose(
      this.targetPose.leftHand
    );
    this.currentPose.rightHand = AvatarAnimator.cloneHandPose(
      this.targetPose.rightHand
    );
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
      this.currentPose = AvatarAnimator.cloneBodyPose(this.transitionEnd);
      return;
    }

    // Apply easing
    const t = this.applyEasing(
      this.transitionProgress,
      this.transitionConfig.easing
    );

    // Interpolate pose hands per side. When either endpoint is null on a
    // side we cannot lerp, so snap to the end's nullability - a hand that
    // appears mid-transition pops in at t=0 and one that vanishes drops
    // out at t=0. In practice transition targets come from set-piece
    // authoring where both hands are consistently present or absent.
    this.currentPose.leftHand = this.lerpHand(
      this.transitionStart.leftHand,
      this.transitionEnd.leftHand,
      t
    );
    this.currentPose.rightHand = this.lerpHand(
      this.transitionStart.rightHand,
      this.transitionEnd.rightHand,
      t
    );

    this.currentPose.timestamp = Date.now();
  }

  private lerpHand(
    start: HandPose | null,
    end: HandPose | null,
    t: number
  ): HandPose | null {
    if (!start || !end) return AvatarAnimator.cloneHandPose(end);
    return {
      targetPosition: new Vector3().lerpVectors(
        start.targetPosition,
        end.targetPosition,
        t
      ),
      wristRotation: end.wristRotation?.clone(),
      staffAngle: end.staffAngle,
      gripType: end.gripType,
      plane: end.plane,
      weight: start.weight + (end.weight - start.weight) * t,
    };
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
    const result = AvatarAnimator.cloneBodyPose(this.currentPose);

    // Apply layers. A layer can only influence a hand that's present in
    // both the current pose and the layer's pose - there's nothing to
    // lerp toward or from when one side is null.
    for (const layer of this.layers.values()) {
      if (layer.weight <= 0) continue;

      if (result.leftHand && layer.pose.leftHand) {
        result.leftHand.targetPosition.lerp(
          layer.pose.leftHand.targetPosition,
          layer.weight
        );
      }
      if (result.rightHand && layer.pose.rightHand) {
        result.rightHand.targetPosition.lerp(
          layer.pose.rightHand.targetPosition,
          layer.weight
        );
      }
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
    // CRITICAL: Do NOT read these per-frame after clavicle is rotated - the elevated
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

    // Cache spine bone rest quaternions once - COMPOSE with these, never replace.
    // Works with whatever bones are available (some models lack Spine2/upper_chest).
    if (!this.spineRestCached) {
      let anyFound = false;
      const cacheSpineBone = (boneName: BoneName, key: "spine1" | "spine2" | "neck" | "head" | "hips") => {
        const bone = state.bones.get(boneName);
        if (bone) {
          this.spineTwistRestQuats[key].copy(bone.quaternion);
          if (key !== "hips") this.availableSpineBones.add(boneName);
          anyFound = true;
        }
      };
      cacheSpineBone("Spine1", "spine1");
      cacheSpineBone("Spine2", "spine2");
      cacheSpineBone("Neck", "neck");
      cacheSpineBone("Head", "head");
      cacheSpineBone("Hips", "hips");
      if (anyFound) this.spineRestCached = true;
    }

    // Spine twist: rotate torso toward cross-body hand positions.
    // Each bone gets its own weighted fraction of the twist, distributed
    // anatomically up the chain. Hips counter-rotate for grounding.
    // Scale twist by max IK weight so it fades out when both arms are in animation mode.
    const maxIKWeight = Math.max(this.leftArmIK.weight, this.rightArmIK.weight);

    if (this._spineTwistEnabled && this.spineTwister && this.spineRestCached && maxIKWeight > 0.001) {
      // Nullable hands are first-class: SpineTwister handles the
      // single-hand-gaze branch and the no-hand identity branch
      // internally, so we pass pose hands through as-is.
      const twistResult = this.spineTwister.computeSpineTwist(
        pose.leftHand?.targetPosition ?? null,
        pose.rightHand?.targetPosition ?? null,
        bodyCenter,
        this.availableSpineBones
      );

      // Apply twist to each bone individually for a natural spinal curve.
      // Each bone gets its own weighted quaternion from SpineTwister.
      const applySpineTwist = (
        boneName: BoneName,
        key: "spine1" | "spine2" | "neck" | "head" | "hips",
        twistQuat: Quaternion
      ) => {
        const bone = state.bones.get(boneName);
        if (!bone) return;

        // Scale from identity toward full twist based on max IK weight
        const scaledTwist = new Quaternion().slerp(twistQuat, maxIKWeight);
        this.spineTwistQuats[key].slerp(scaledTwist, this.smoothingFactor);
        bone.quaternion
          .copy(this.spineTwistRestQuats[key])
          .multiply(this.spineTwistQuats[key]);
      };

      applySpineTwist("Spine1", "spine1", twistResult.spine1);
      applySpineTwist("Spine2", "spine2", twistResult.spine2);
      applySpineTwist("Neck", "neck", twistResult.neck);
      applySpineTwist("Head", "head", twistResult.head);
      // Skip Hips counter-rotation for exhibit performers - when leg bones
      // are stripped for foot planting, hip yaw cascades to the feet and
      // makes them slide on the ground.
      if (!this._skipHipsTwist) {
        applySpineTwist("Hips", "hips", twistResult.hips);
      }

      // Update world matrices after all spine bones are adjusted,
      // so IK solves against the twisted skeleton
      const hipsBoneForUpdate = state.bones.get("Hips");
      if (hipsBoneForUpdate) hipsBoneForUpdate.updateMatrixWorld(true);
    }

    // External spine pitch: optional extra forward lean applied to Spine1.
    // Runs whether or not spine twist is enabled so lean-forward stances
    // work in both modes. Composed ON TOP of whatever the twist block set
    // (or the rest pose, if twist didn't run). Applied BEFORE arm IK so
    // the arms solve against the leaned-forward shoulders.
    if (Math.abs(this.externalSpinePitchRad) > 0.0001 && this.spineRestCached) {
      const spine1Bone = state.bones.get("Spine1");
      if (spine1Bone) {
        // If the twist block didn't run this frame, reset spine1 to its
        // cached rest quat before applying pitch so we don't accumulate
        // from the previous frame's rotation.
        const twistRan =
          this._spineTwistEnabled &&
          this.spineTwister !== null &&
          maxIKWeight > 0.001;
        if (!twistRan) {
          spine1Bone.quaternion.copy(this.spineTwistRestQuats.spine1);
        }
        const pitchQuat = new Quaternion().setFromAxisAngle(
          new Vector3(1, 0, 0),
          this.externalSpinePitchRad
        );
        spine1Bone.quaternion.multiply(pitchQuat);
        const hipsBoneForUpdate = state.bones.get("Hips");
        if (hipsBoneForUpdate) hipsBoneForUpdate.updateMatrixWorld(true);
      }
    }

    const leftHand = pose.leftHand;
    const rightHand = pose.rightHand;

    if (leftChain && leftHand) {
      if (this.leftArmIK.weight > 0.001) {
        const leftTarget = leftHand.targetPosition;
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
          weight: leftHand.weight,
        };

        if (this._poleVectorsEnabled && this.poleComputer && leftHand.plane) {
          const idealPole = this.poleComputer.computePoleVector(
            leftTarget,
            leftHand.plane,
            "left",
            bodyCenter
          );
          this.leftPoleVector.lerp(idealPole, this.smoothingFactor);
          this.leftPoleVector.normalize();
          target.poleHint = this.leftPoleVector.clone();
        }

        // Solve IK (overwrites bone quaternions)
        this.ikSolver.solveAndApply(leftChain, target);

        // Save IK results BEFORE blending - .copy() would overwrite them
        const ikRootQuat = leftChain.root.quaternion.clone();
        const ikMiddleQuat = leftChain.middle.quaternion.clone();
        const ikEffectorQuat = leftChain.effector.quaternion.clone();

        // Blend: slerp each bone from animation pose toward IK solution
        const w = this.leftArmIK.weight;
        leftChain.root.quaternion.copy(animRootQuat).slerp(ikRootQuat, w);
        leftChain.middle.quaternion.copy(animMiddleQuat).slerp(ikMiddleQuat, w);
        leftChain.effector.quaternion.copy(animEffectorQuat).slerp(ikEffectorQuat, w);

      }
      // else: weight ~0, skip IK entirely - animation drives the arm
    }

    if (rightChain && rightHand) {
      if (this.rightArmIK.weight > 0.001) {
        const rightTarget = rightHand.targetPosition;
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
          weight: rightHand.weight,
        };

        if (this._poleVectorsEnabled && this.poleComputer && rightHand.plane) {
          const idealPole = this.poleComputer.computePoleVector(
            rightTarget,
            rightHand.plane,
            "right",
            bodyCenter
          );
          this.rightPoleVector.lerp(idealPole, this.smoothingFactor);
          this.rightPoleVector.normalize();
          target.poleHint = this.rightPoleVector.clone();
        }

        // Solve IK (overwrites bone quaternions)
        this.ikSolver.solveAndApply(rightChain, target);

        // Save IK results BEFORE blending - .copy() would overwrite them
        const ikRootQuat = rightChain.root.quaternion.clone();
        const ikMiddleQuat = rightChain.middle.quaternion.clone();
        const ikEffectorQuat = rightChain.effector.quaternion.clone();

        // Blend: slerp each bone from animation pose toward IK solution
        const w = this.rightArmIK.weight;
        rightChain.root.quaternion.copy(animRootQuat).slerp(ikRootQuat, w);
        rightChain.middle.quaternion.copy(animMiddleQuat).slerp(ikMiddleQuat, w);
        rightChain.effector.quaternion.copy(animEffectorQuat).slerp(ikEffectorQuat, w);

      }
      // else: weight ~0, skip IK entirely - animation drives the arm
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
      this.transitionStart = AvatarAnimator.cloneBodyPose(this.currentPose);
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

  setExternalSpinePitch(radians: number): void {
    this.externalSpinePitchRad = radians;
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

  /** Skip Hips counter-rotation (exhibit performers with planted feet) */
  setSkipHipsTwist(skip: boolean): void {
    this._skipHipsTwist = skip;
  }

  /** Set spine twist enabled/disabled */
  setSpineTwistEnabled(enabled: boolean): void {
    this._spineTwistEnabled = enabled;
    if (!enabled) {
      this.spineTwistQuats.spine1.identity();
      this.spineTwistQuats.spine2.identity();
      this.spineTwistQuats.neck.identity();
      this.spineTwistQuats.head.identity();
    }
  }

  /** Debug toggle: disable spine twist to compare old vs new torso behavior */
  toggleSpineTwist(): boolean {
    this.setSpineTwistEnabled(!this._spineTwistEnabled);
    return this._spineTwistEnabled;
  }
}
