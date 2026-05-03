/**
 * IAvatarSkeletonBuilder
 *
 * Manages the skeletal structure of the 3D avatar.
 * Responsible for loading rigged models, bone manipulation,
 * and providing access to the skeleton hierarchy.
 */

import type { Bone, SkinnedMesh, Object3D, Vector3 } from "three";
import type { FingerChains } from "../../domain/models/GripPose";

/**
 * Standard bone names following Mixamo/humanoid conventions
 */
export type BoneName =
  | "Hips"
  | "Spine"
  | "Spine1"
  | "Spine2"
  | "Neck"
  | "Head"
  | "LeftShoulder"
  | "LeftArm"
  | "LeftForeArm"
  | "LeftHand"
  | "RightShoulder"
  | "RightArm"
  | "RightForeArm"
  | "RightHand"
  | "LeftUpLeg"
  | "LeftLeg"
  | "LeftFoot"
  | "RightUpLeg"
  | "RightLeg"
  | "RightFoot";

/**
 * Bone chain for IK solving
 */
export interface BoneChain {
  /** Root bone of the chain (e.g., shoulder) */
  root: Bone;
  /** Middle bone (e.g., elbow) */
  middle: Bone;
  /** End effector (e.g., hand) */
  effector: Bone;
  /** Total length of the chain */
  totalLength: number;
  /** Length of first segment */
  upperLength: number;
  /** Length of second segment */
  lowerLength: number;
  /** Rest direction of root bone (local space, normalized) */
  rootRestDir: Vector3;
  /** Rest direction of middle bone (local space, normalized) */
  middleRestDir: Vector3;
}

/**
 * Avatar skeleton state
 */
export interface SkeletonState {
  /** Whether the skeleton is loaded and ready */
  isLoaded: boolean;
  /** The root object containing the skeleton */
  root: Object3D | null;
  /** All skinned meshes in the model */
  meshes: SkinnedMesh[];
  /** Map of bone names to bone objects */
  bones: Map<BoneName, Bone>;
  /** Pre-computed arm chains for IK */
  leftArmChain: BoneChain | null;
  rightArmChain: BoneChain | null;
  /** Pre-computed leg chains for foot IK (UpLeg -> Leg -> Foot) */
  leftLegChain: BoneChain | null;
  rightLegChain: BoneChain | null;
  /** Mapped finger bone chains. Null if model lacks finger bones. */
  fingerChains: FingerChains | null;
}

// IAvatarSkeletonBuilder interface retired — AvatarSkeletonBuilder class is the contract now.
