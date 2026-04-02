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

/**
 * Default idle pose - arms relaxed at sides
 * Positions in meters: 0.25m to the side, 0.5m up (waist height)
 */
function createIdlePose(): BodyPose {
  return {
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
}

export class AvatarAnimator implements IAvatarAnimator {
  private currentPose: BodyPose;
  private targetPose: BodyPose;
  private idlePose: BodyPose;
  private layers: Map<string, AnimationLayer> = new Map();
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
  private _spineDiagCounter = 0;
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
    this.idlePose = createIdlePose();
    this.currentPose = { ...this.idlePose };
    this.targetPose = { ...this.idlePose };
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
    } else {
      this.targetPose.leftHand = { ...this.idlePose.leftHand };
    }

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
    } else {
      this.targetPose.rightHand = { ...this.idlePose.rightHand };
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

    // Spine twist: rotate torso and head toward cross-body hand positions
    // --- DIAGNOSTIC: log every 120 frames (~2s at 60fps) ---
    this._spineDiagCounter++;
    if (this._spineDiagCounter % 120 === 0) {
      const hasTwister = !!this.spineTwister;
      const enabled = this._spineTwistEnabled;
      const cached = this.spineRestCached;
      const lx = pose.leftHand.targetPosition.x.toFixed(3);
      const ly = pose.leftHand.targetPosition.y.toFixed(3);
      const rx = pose.rightHand.targetPosition.x.toFixed(3);
      const ry = pose.rightHand.targetPosition.y.toFixed(3);
      const cx = bodyCenter.x.toFixed(3);
      console.log(
        `[SpineTwist DIAG] enabled=${enabled} hasTwister=${hasTwister} restCached=${cached} ` +
        `leftHand=(${lx},${ly}) rightHand=(${rx},${ry}) bodyCenter.x=${cx}`
      );
      if (!cached) {
        const checkNames: BoneName[] = ["Spine1", "Spine2", "Neck", "Head"];
        const boneCheck = checkNames.map(
          (n) => `${n}=${state.bones.has(n) ? "found" : "MISSING"}`
        );
        console.log(`[SpineTwist DIAG] Bone check: ${boneCheck.join(", ")}`);
      }
    }

    if (this._spineTwistEnabled && this.spineTwister && this.spineRestCached) {
      const twistResult = this.spineTwister.computeSpineTwist(
        pose.leftHand.targetPosition,
        pose.rightHand.targetPosition,
        bodyCenter,
        this.availableSpineBones
      );

      // --- DIAGNOSTIC: log computed twist angles ---
      if (this._spineDiagCounter % 120 === 0) {
        const toDeg = (q: Quaternion) => {
          const angle = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
          return ((angle * 180) / Math.PI).toFixed(1);
        };
        console.log(
          `[SpineTwist DIAG] twist angles: Spine1=${toDeg(twistResult.spine1)}° ` +
          `Spine2=${toDeg(twistResult.spine2)}° Neck=${toDeg(twistResult.neck)}° ` +
          `Head=${toDeg(twistResult.head)}° Hips=${toDeg(twistResult.hips)}°`
        );
      }

      // Apply twist to Spine1 only. Neck and Head inherit through the
      // skeleton hierarchy, so they follow naturally without needing
      // their own rotation (which was causing cascading artifacts).
      // No hip counter-rotation — feet stay planted because we only
      // rotate above the waist.
      const spine1Bone = state.bones.get("Spine1");
      if (spine1Bone) {
        // Use the FULL twist (all weights combined) on Spine1 since it's
        // the only bone we're directly rotating
        const fullTwist = this.makeFullSpineTwist(twistResult);
        this.spineTwistQuats.spine1.slerp(fullTwist, this.smoothingFactor);
        spine1Bone.quaternion
          .copy(this.spineTwistRestQuats.spine1)
          .multiply(this.spineTwistQuats.spine1);
        spine1Bone.updateMatrixWorld(true);
      }
    }

    const leftTarget = pose.leftHand.targetPosition;
    const rightTarget = pose.rightHand.targetPosition;

    if (leftChain) {
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

      this.ikSolver.solveAndApply(leftChain, target);
    }

    if (rightChain) {
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

      this.ikSolver.solveAndApply(rightChain, target);
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

  setIdlePose(pose: BodyPose): void {
    this.idlePose = { ...pose };
  }

  resetToIdle(): void {
    this.targetPose = { ...this.idlePose };
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
