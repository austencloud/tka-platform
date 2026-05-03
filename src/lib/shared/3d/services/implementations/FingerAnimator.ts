import { Quaternion } from "three";
import type { Bone } from "three";
import {
  GripType,
  FINGER_BONES,
  type FingerBoneName,
  type FingerChains,
} from "../../domain/models/GripPose";
import { STAFF_GRIP_POSES } from "../../data/grip-poses/staff-grip-poses";

interface HandState {
  targetGrip: GripType;
  currentRotations: Quaternion[];
  bones: Bone[];
}

export class FingerAnimator {
  private leftHand: HandState | null = null;
  private rightHand: HandState | null = null;
  private blendSpeed = 6.0;
  private ready = false;
  private readonly scratchQuat = new Quaternion();

  initialize(fingerChains: FingerChains): void {
    this.leftHand = this.createHandState(fingerChains.left);
    this.rightHand = this.createHandState(fingerChains.right);
    this.ready = true;

    this.applyPoseImmediate(this.leftHand, GripType.IDLE, "left");
    this.applyPoseImmediate(this.rightHand, GripType.IDLE, "right");
  }

  isReady(): boolean {
    return this.ready;
  }

  setGrip(hand: "left" | "right", type: GripType): void {
    const state = hand === "left" ? this.leftHand : this.rightHand;
    if (state) {
      state.targetGrip = type;
    }
  }

  setGrips(leftGrip: GripType, rightGrip: GripType): void {
    this.setGrip("left", leftGrip);
    this.setGrip("right", rightGrip);
  }

  update(deltaTime: number): void {
    if (!this.ready || !this.leftHand || !this.rightHand) return;

    this.updateHand(this.leftHand, "left", deltaTime);
    this.updateHand(this.rightHand, "right", deltaTime);
  }

  setBlendSpeed(speed: number): void {
    this.blendSpeed = speed;
  }

  getCurrentGrip(hand: "left" | "right"): GripType {
    const state = hand === "left" ? this.leftHand : this.rightHand;
    return state?.targetGrip ?? GripType.IDLE;
  }

  dispose(): void {
    this.leftHand = null;
    this.rightHand = null;
    this.ready = false;
  }

  private createHandState(boneMap: Map<FingerBoneName, Bone>): HandState {
    const bones: Bone[] = [];
    const currentRotations: Quaternion[] = [];

    for (const boneName of FINGER_BONES) {
      const bone = boneMap.get(boneName);
      if (!bone) {
        throw new Error(`Missing finger bone: ${boneName}`);
      }
      bones.push(bone);
      currentRotations.push(new Quaternion(0, 0, 0, 1));
    }

    return {
      targetGrip: GripType.IDLE,
      currentRotations,
      bones,
    };
  }

  // Writes the target rotation for boneIndex into scratchQuat, mirroring for right hand.
  // Right-hand mirror negates Y and Z to reflect across the YZ plane.
  private writeTargetRotation(
    gripType: GripType,
    boneIndex: number,
    hand: "left" | "right"
  ): void {
    const pose = STAFF_GRIP_POSES[gripType];
    // boneIndex is always within [0, FINGER_BONES.length), guaranteed by callers.
    const raw = pose.rotations[boneIndex]!;
    if (hand === "right") {
      this.scratchQuat.set(raw[0], -raw[1], -raw[2], raw[3]);
    } else {
      this.scratchQuat.set(raw[0], raw[1], raw[2], raw[3]);
    }
  }

  private updateHand(
    state: HandState,
    hand: "left" | "right",
    deltaTime: number
  ): void {
    // Clamp alpha to [0, 1] so large delta times don't overshoot.
    const alpha = Math.min(1, this.blendSpeed * deltaTime);

    for (let i = 0; i < FINGER_BONES.length; i++) {
      this.writeTargetRotation(state.targetGrip, i, hand);
      // Arrays are sized to FINGER_BONES.length in createHandState - index is always valid.
      state.currentRotations[i]!.slerp(this.scratchQuat, alpha);
      state.bones[i]!.quaternion.copy(state.currentRotations[i]!);
    }
  }

  private applyPoseImmediate(
    state: HandState,
    gripType: GripType,
    hand: "left" | "right"
  ): void {
    state.targetGrip = gripType;
    for (let i = 0; i < FINGER_BONES.length; i++) {
      this.writeTargetRotation(gripType, i, hand);
      // Arrays are sized to FINGER_BONES.length in createHandState - index is always valid.
      state.currentRotations[i]!.copy(this.scratchQuat);
      state.bones[i]!.quaternion.copy(this.scratchQuat);
    }
  }
}
