/**
 * AvatarAnimator
 *
 * Manages avatar pose states and smooth animation blending.
 * Bridges TKA prop states to skeleton IK targets.
 */

import { Vector3 } from "three";
import type {
  IAvatarAnimator,
  HandPose,
  BodyPose,
  AnimationLayer,
  TransitionConfig,
  PositionOffset,
} from "../contracts/IAvatarAnimator";
import type { IIKSolver, IKTarget } from "../contracts/IIKSolver";
import type { IAvatarSkeletonBuilder } from "../contracts/IAvatarSkeletonBuilder";
import type { PropState3D } from "../../domain/models/PropState3D";
import type { IElbowPoleComputer } from "../contracts/IElbowPoleComputer";

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

  constructor(
    private ikSolver: IIKSolver,
    private skeleton: IAvatarSkeletonBuilder,
    poleComputer?: IElbowPoleComputer
  ) {
    this.poleComputer = poleComputer ?? null;
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

    if (leftChain) {
      const target: IKTarget = {
        position: pose.leftHand.targetPosition,
        weight: pose.leftHand.weight,
      };

      if (this.poleComputer && pose.leftHand.plane) {
        const idealPole = this.poleComputer.computePoleVector(
          pose.leftHand.targetPosition,
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
      const target: IKTarget = {
        position: pose.rightHand.targetPosition,
        weight: pose.rightHand.weight,
      };

      if (this.poleComputer && pose.rightHand.plane) {
        const idealPole = this.poleComputer.computePoleVector(
          pose.rightHand.targetPosition,
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
}
