/**
 * AvatarSkeletonBuilder
 *
 * Loads and manages GLTF rigged humanoid models.
 * Provides access to bones for IK solving and animation.
 */

import type { Object3D, Bone, SkinnedMesh, Skeleton} from "three";
import { Vector3, Box3 } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import type {
  IAvatarSkeletonBuilder,
  BoneName,
  BoneChain,
  SkeletonState,
} from "../contracts/IAvatarSkeletonBuilder";
import {
  FINGER_BONES,
  type FingerBoneName,
  type FingerChains,
} from "../../domain/models/GripPose";

/**
 * Mapping of standard bone names to common variations
 * GLTF models from different sources use different naming conventions
 */
const BONE_NAME_ALIASES: Record<BoneName, string[]> = {
  Hips: ["Hips", "pelvis", "hip", "root"],
  Spine: ["Spine", "spine", "spine1"],
  Spine1: ["Spine1", "spine2", "chest"],
  Spine2: ["Spine2", "spine3", "upper_chest"],
  Neck: ["Neck", "neck"],
  Head: ["Head", "head"],
  LeftShoulder: ["LeftShoulder", "l_shoulder", "shoulder.L", "clavicle_l"],
  LeftArm: ["LeftArm", "l_arm", "arm.L", "upperarm_l", "LeftUpperArm"],
  LeftForeArm: [
    "LeftForeArm",
    "l_forearm",
    "forearm.L",
    "lowerarm_l",
    "LeftLowerArm",
  ],
  LeftHand: ["LeftHand", "l_hand", "hand.L", "hand_l"],
  RightShoulder: ["RightShoulder", "r_shoulder", "shoulder.R", "clavicle_r"],
  RightArm: ["RightArm", "r_arm", "arm.R", "upperarm_r", "RightUpperArm"],
  RightForeArm: [
    "RightForeArm",
    "r_forearm",
    "forearm.R",
    "lowerarm_r",
    "RightLowerArm",
  ],
  RightHand: ["RightHand", "r_hand", "hand.R", "hand_r"],
  LeftUpLeg: ["LeftUpLeg", "l_thigh", "thigh.L", "upperleg_l", "LeftUpperLeg"],
  LeftLeg: ["LeftLeg", "l_shin", "shin.L", "lowerleg_l", "LeftLowerLeg"],
  LeftFoot: ["LeftFoot", "l_foot", "foot.L", "foot_l"],
  RightUpLeg: [
    "RightUpLeg",
    "r_thigh",
    "thigh.R",
    "upperleg_r",
    "RightUpperLeg",
  ],
  RightLeg: ["RightLeg", "r_shin", "shin.R", "lowerleg_r", "RightLowerLeg"],
  RightFoot: ["RightFoot", "r_foot", "foot.R", "foot_r"],
};

/**
 * Mapping of canonical finger bone names to common GLTF naming conventions.
 * Built at module load time - one entry per hand × 15 bones.
 *
 * Supported conventions:
 *   Mixamo:          LeftHandThumb1
 *   characters3d.com: L_Thumb1
 *   Unreal Engine:   thumb1_l
 */
const FINGER_BONE_ALIASES: Record<string, string[]> = {};

for (const side of ["Left", "Right"] as const) {
  const prefix = side === "Left" ? "L" : "R";
  for (const bone of FINGER_BONES) {
    const key = `${side}${bone}`;
    FINGER_BONE_ALIASES[key] = [
      `${side}Hand${bone}`,                        // Mixamo: LeftHandThumb1
      `${prefix}_${bone}`,                          // characters3d.com: L_Thumb1
      `${bone.toLowerCase()}_${prefix.toLowerCase()}`, // Unreal: thumb1_l
    ];
  }
}

export class AvatarSkeletonBuilder {
  private state: SkeletonState = {
    isLoaded: false,
    root: null,
    meshes: [],
    bones: new Map(),
    leftArmChain: null,
    rightArmChain: null,
    leftLegChain: null,
    rightLegChain: null,
    fingerChains: null,
  };

  private loader = new GLTFLoader();
  private originalHeight: number = 0;
  private skeleton: Skeleton | null = null;

  /** Offset from model origin to feet (negative value - feet are below origin) */
  private feetOffset: number = 0;

  /** Original bounding box min Y (in unscaled model space) - computed once at load time */
  private originalMinY: number = 0;

  async loadModel(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf: GLTF) => {
          this.processGLTF(gltf);
          resolve();
        },
        undefined,
        (error) => {
          console.error("Failed to load avatar model:", error);
          reject(error);
        }
      );
    });
  }

  private processGLTF(gltf: GLTF): void {
    // Hot-swap: keep old arm chains valid until new ones are ready
    // This ensures animation continues smoothly during the swap
    const oldRoot = this.state.root;

    // Build new state in temporary variables first
    const newMeshes: SkinnedMesh[] = [];
    const newBones = new Map<BoneName, Bone>();
    let newSkeleton: Skeleton | null = null;

    // Find all skinned meshes and bones in the new model
    gltf.scene.traverse((child) => {
      if ((child as SkinnedMesh).isSkinnedMesh) {
        const skinnedMesh = child as SkinnedMesh;
        newMeshes.push(skinnedMesh);
        newSkeleton = skinnedMesh.skeleton;

        // Map bones from the skeleton directly (more reliable than checking isBone)
        if (skinnedMesh.skeleton) {
          for (const bone of skinnedMesh.skeleton.bones) {
            this.mapBoneToMap(bone, newBones);
          }
        }
      }

      if ((child as Bone).isBone) {
        this.mapBoneToMap(child as Bone, newBones);
      }
    });

    // Compute original bounding box of new model (before any transforms)
    // This is done ONCE at load time, before the model is added to the scene
    const box = new Box3().setFromObject(gltf.scene);
    this.originalHeight = box.max.y - box.min.y;
    this.originalMinY = box.min.y; // Store original feet position for scaling

    // Now atomically swap everything at once
    this.state.root = gltf.scene;
    this.state.meshes = newMeshes;
    this.state.bones = newBones;
    this.skeleton = newSkeleton;

    // Build IK chains (uses the new bones map)
    this.buildArmChains();
    this.buildLegChains();
    this.state.fingerChains = this.buildFingerChains(gltf.scene);

    this.state.isLoaded = true;

    // Dispose old model resources after swap is complete
    if (oldRoot) {
      queueMicrotask(() => {
        oldRoot.traverse((child) => {
          const mesh = child as SkinnedMesh;
          if (mesh.geometry) {
            mesh.geometry.dispose();
          }
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => m.dispose());
            } else {
              mesh.material.dispose();
            }
          }
        });
      });
    }
  }

  /**
   * Map a bone to a bones map (used during hot-swap)
   */
  private mapBoneToMap(bone: Bone, bonesMap: Map<BoneName, Bone>): void {
    const boneName = bone.name.toLowerCase();

    for (const [standardName, aliases] of Object.entries(BONE_NAME_ALIASES)) {
      for (const alias of aliases) {
        if (boneName === alias.toLowerCase()) {
          bonesMap.set(standardName as BoneName, bone);
          return;
        }
      }
    }

    // Fallback: check contains
    for (const [standardName, aliases] of Object.entries(BONE_NAME_ALIASES)) {
      if (bonesMap.has(standardName as BoneName)) continue;
      for (const alias of aliases) {
        if (boneName.includes(alias.toLowerCase())) {
          bonesMap.set(standardName as BoneName, bone);
          return;
        }
      }
    }
  }

  private mapBone(bone: Bone): void {
    const boneName = bone.name.toLowerCase();

    for (const [standardName, aliases] of Object.entries(BONE_NAME_ALIASES)) {
      for (const alias of aliases) {
        // Use exact match first, then contains as fallback
        if (boneName === alias.toLowerCase()) {
          this.state.bones.set(standardName as BoneName, bone);
          return;
        }
      }
    }

    // Fallback: check contains (but only if not already mapped)
    for (const [standardName, aliases] of Object.entries(BONE_NAME_ALIASES)) {
      if (this.state.bones.has(standardName as BoneName)) continue; // Skip if already mapped
      for (const alias of aliases) {
        if (boneName.includes(alias.toLowerCase())) {
          this.state.bones.set(standardName as BoneName, bone);
          return;
        }
      }
    }
  }

  private buildArmChains(): void {
    // Left arm
    const leftShoulder = this.state.bones.get("LeftArm");
    const leftElbow = this.state.bones.get("LeftForeArm");
    const leftHand = this.state.bones.get("LeftHand");

    if (leftShoulder && leftElbow && leftHand) {
      const upperLen = this.getBoneLength(leftShoulder, leftElbow);
      const lowerLen = this.getBoneLength(leftElbow, leftHand);

      // Compute rest directions in local space (direction bone points in T-pose)
      const rootRestDir = this.computeRestDirection(leftShoulder, leftElbow);
      const middleRestDir = this.computeRestDirection(leftElbow, leftHand);

      this.state.leftArmChain = {
        root: leftShoulder,
        middle: leftElbow,
        effector: leftHand,
        totalLength: upperLen + lowerLen,
        upperLength: upperLen,
        lowerLength: lowerLen,
        rootRestDir,
        middleRestDir,
      };
    }

    // Right arm
    const rightShoulder = this.state.bones.get("RightArm");
    const rightElbow = this.state.bones.get("RightForeArm");
    const rightHand = this.state.bones.get("RightHand");

    if (rightShoulder && rightElbow && rightHand) {
      const upperLen = this.getBoneLength(rightShoulder, rightElbow);
      const lowerLen = this.getBoneLength(rightElbow, rightHand);

      // Compute rest directions in local space
      const rootRestDir = this.computeRestDirection(rightShoulder, rightElbow);
      const middleRestDir = this.computeRestDirection(rightElbow, rightHand);

      this.state.rightArmChain = {
        root: rightShoulder,
        middle: rightElbow,
        effector: rightHand,
        totalLength: upperLen + lowerLen,
        upperLength: upperLen,
        lowerLength: lowerLen,
        rootRestDir,
        middleRestDir,
      };
    }
  }

  /**
   * Build leg IK chains (UpLeg -> Leg -> Foot) for foot planting.
   * Same pattern as arm chains - two-bone IK with rest directions.
   */
  private buildLegChains(): void {
    // Left leg
    const leftUpLeg = this.state.bones.get("LeftUpLeg");
    const leftLeg = this.state.bones.get("LeftLeg");
    const leftFoot = this.state.bones.get("LeftFoot");

    if (leftUpLeg && leftLeg && leftFoot) {
      const upperLen = this.getBoneLength(leftUpLeg, leftLeg);
      const lowerLen = this.getBoneLength(leftLeg, leftFoot);
      const rootRestDir = this.computeRestDirection(leftUpLeg, leftLeg);
      const middleRestDir = this.computeRestDirection(leftLeg, leftFoot);

      this.state.leftLegChain = {
        root: leftUpLeg,
        middle: leftLeg,
        effector: leftFoot,
        totalLength: upperLen + lowerLen,
        upperLength: upperLen,
        lowerLength: lowerLen,
        rootRestDir,
        middleRestDir,
      };
    }

    // Right leg
    const rightUpLeg = this.state.bones.get("RightUpLeg");
    const rightLeg = this.state.bones.get("RightLeg");
    const rightFoot = this.state.bones.get("RightFoot");

    if (rightUpLeg && rightLeg && rightFoot) {
      const upperLen = this.getBoneLength(rightUpLeg, rightLeg);
      const lowerLen = this.getBoneLength(rightLeg, rightFoot);
      const rootRestDir = this.computeRestDirection(rightUpLeg, rightLeg);
      const middleRestDir = this.computeRestDirection(rightLeg, rightFoot);

      this.state.rightLegChain = {
        root: rightUpLeg,
        middle: rightLeg,
        effector: rightFoot,
        totalLength: upperLen + lowerLen,
        upperLength: upperLen,
        lowerLength: lowerLen,
        rootRestDir,
        middleRestDir,
      };
    }
  }

  /**
   * Build finger bone chains for both hands.
   *
   * Uses the skeleton's own bone array (same objects the GPU skinning references)
   * rather than scene-graph lookup, which can return different object instances.
   *
   * Returns null if ANY of the 30 bones cannot be found - graceful degradation
   * for low-poly models that omit finger rigs entirely.
   */
  private buildFingerChains(_root: Object3D): FingerChains | null {
    if (!this.skeleton) return null;

    const left = new Map<FingerBoneName, Bone>();
    const right = new Map<FingerBoneName, Bone>();

    // Build a lookup from lowercase bone name → Bone reference
    // using the skeleton's actual bone array (the GPU-bound instances)
    const bonesByName = new Map<string, Bone>();
    for (const bone of this.skeleton.bones) {
      bonesByName.set(bone.name.toLowerCase(), bone);
    }

    for (const boneName of FINGER_BONES) {
      // --- Left hand ---
      const leftKey = `Left${boneName}`;
      const leftAliases = FINGER_BONE_ALIASES[leftKey] ?? [];
      let leftBone: Bone | null = null;

      for (const alias of leftAliases) {
        const found = bonesByName.get(alias.toLowerCase());
        if (found) {
          leftBone = found;
          break;
        }
      }

      // --- Right hand ---
      const rightKey = `Right${boneName}`;
      const rightAliases = FINGER_BONE_ALIASES[rightKey] ?? [];
      let rightBone: Bone | null = null;

      for (const alias of rightAliases) {
        const found = bonesByName.get(alias.toLowerCase());
        if (found) {
          rightBone = found;
          break;
        }
      }

      if (!leftBone || !rightBone) {
        return null;
      }

      left.set(boneName, leftBone);
      right.set(boneName, rightBone);
    }

    return { left, right };
  }

  /**
   * Compute the rest direction of a bone (direction to child in bind pose)
   * Returns the direction in the bone's LOCAL space
   */
  private computeRestDirection(parent: Bone, child: Bone): Vector3 {
    // Get world positions
    const parentWorld = new Vector3();
    const childWorld = new Vector3();
    parent.getWorldPosition(parentWorld);
    child.getWorldPosition(childWorld);

    // Direction in world space
    const worldDir = childWorld.clone().sub(parentWorld).normalize();

    // Transform to parent's local space
    // Get the parent's world matrix inverse to transform world to local
    const parentMatrixInverse = parent.matrixWorld.clone().invert();

    // Transform direction (not point) - use transformDirection
    const localDir = worldDir.clone().transformDirection(parentMatrixInverse);

    return localDir.normalize();
  }

  private getBoneLength(parent: Bone, child: Bone): number {
    const parentWorld = new Vector3();
    const childWorld = new Vector3();
    parent.getWorldPosition(parentWorld);
    child.getWorldPosition(childWorld);
    return parentWorld.distanceTo(childWorld);
  }

  getState(): SkeletonState {
    return this.state;
  }

  getBone(name: BoneName): Bone | null {
    return this.state.bones.get(name) ?? null;
  }

  getLeftArmChain(): BoneChain | null {
    return this.state.leftArmChain;
  }

  getRightArmChain(): BoneChain | null {
    return this.state.rightArmChain;
  }

  getLeftLegChain(): BoneChain | null {
    return this.state.leftLegChain;
  }

  getRightLegChain(): BoneChain | null {
    return this.state.rightLegChain;
  }

  getRoot(): Object3D | null {
    return this.state.root;
  }

  updateMatrices(): void {
    if (this.skeleton) {
      this.skeleton.update();
    }
    if (this.state.root) {
      this.state.root.updateMatrixWorld(true);
    }
  }

  /**
   * Set avatar scale directly (relative to base model)
   * @param scale - Scale factor (1.0 = base model size, 1.1 = 10% larger)
   */
  setScale(scale: number): void {
    if (!this.state.root) return;

    // Reset transforms and apply new scale
    // IMPORTANT: We only set scale here, NOT position.
    // Position is handled by the parent component using getFeetOffset()
    this.state.root.position.set(0, 0, 0);
    this.state.root.rotation.set(0, 0, 0);
    this.state.root.scale.setScalar(scale);

    // Calculate feet offset from ORIGINAL bounds (computed once at load time)
    // This avoids the infinite loop caused by recomputing bounding box
    // when the model is already in the scene with a parent transform
    this.feetOffset = this.originalMinY * scale; // Scale the original feet position

    // Update matrices after scaling
    this.state.root.updateMatrixWorld(true);

    // Rebuild IK chains with new scale
    this.buildArmChains();
    this.buildLegChains();
  }

  /**
   * Get the Y offset from model origin to feet (negative value)
   * Parent component should position at: groundY - feetOffset
   * This ensures feet end up at world Y = groundY
   */
  getFeetOffset(): number {
    return this.feetOffset;
  }

  /**
   * @deprecated Use setScale() instead - height units were ambiguous
   */
  setHeight(height: number): void {
    if (!this.state.root || this.originalHeight === 0) return;

    // Legacy behavior - calculate scale from height
    const scale = height / this.originalHeight;
    this.setScale(scale);
  }

  getGroundOffset(): number {
    // Ground offset is now handled internally by setHeight
    // The model is already positioned with feet at Y=0
    return 0;
  }

  dispose(): void {
    if (this.state.root) {
      this.state.root.traverse((child) => {
        const mesh = child as SkinnedMesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      });
    }

    this.state = {
      isLoaded: false,
      root: null,
      meshes: [],
      bones: new Map(),
      leftArmChain: null,
      rightArmChain: null,
      leftLegChain: null,
      rightLegChain: null,
      fingerChains: null,
    };
    this.skeleton = null;
  }
}
