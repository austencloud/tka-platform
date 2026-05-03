/**
 * LegAnimator
 *
 * Controls leg animations independently from upper body IK.
 * Uses Three.js AnimationMixer with track filtering to only
 * animate leg bones while arms remain controlled by prop IK.
 *
 * Supports 4-way directional blending:
 * - Forward walk
 * - Backward walk
 * - Strafe left
 * - Strafe right
 */

import type { AnimationAction, Object3D, KeyframeTrack } from "three";
import { AnimationMixer, AnimationClip, LoopRepeat } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface LocomotionInput {
  isMoving: boolean;
  speed: number;
  facingAngle?: number;
  moveDirection?: { x: number; z: number };
}

export interface DirectionalAnimationUrls {
  forward: string;
  backward: string;
  strafeLeft: string;
  strafeRight: string;
}

export interface LegAnimatorConfig {
  baseSpeed?: number;
  blendTime?: number;
  useRootMotion?: boolean;
}

/**
 * Core bone names for leg animation (standard humanoid names).
 * These are the target bone names we want in the final animation.
 *
 * NOTE: We intentionally EXCLUDE "Hips" because:
 * - Hips rotation affects the whole body orientation
 * - The facing direction is controlled by the locomotion system
 * - Including Hips causes the avatar to "lie down" during walk
 */
const LEG_BONE_CORE_NAMES = [
  // "Hips" - excluded, controlled by locomotion facing angle
  "LeftUpLeg",
  "LeftLeg",
  "LeftFoot",
  "LeftToeBase",
  "RightUpLeg",
  "RightLeg",
  "RightFoot",
  "RightToeBase",
];

/**
 * Known bone name prefixes from various sources.
 * We strip these to get the core bone name.
 * IMPORTANT: Longer prefixes must come first to avoid partial matches.
 */
const BONE_PREFIXES = [
  "mixamorig1", // Mixamo variant (must come before "mixamorig")
  "mixamorig:", // Some exports use colon
  "mixamorig", // Mixamo standard
  "characters3dcom___", // characters3d.com
  "", // No prefix (standard names)
];

/**
 * Bone name mapping from characters3d.com convention to standard humanoid names.
 * characters3d.com uses different names entirely, not just different prefixes.
 */
const BONE_NAME_MAPPING: Record<string, string> = {
  // Hips/Pelvis
  Pelvis: "Hips",
  pelvis: "Hips",

  // Left leg
  L_Thigh: "LeftUpLeg",
  L_Calf: "LeftLeg",
  L_Foot: "LeftFoot",
  L_Toe: "LeftToeBase",
  L_ToeBase: "LeftToeBase",
  LeftThigh: "LeftUpLeg",
  LeftCalf: "LeftLeg",
  Left_Thigh: "LeftUpLeg",
  Left_Calf: "LeftLeg",
  Left_Foot: "LeftFoot",
  Left_Toe: "LeftToeBase",

  // Right leg
  R_Thigh: "RightUpLeg",
  R_Calf: "RightLeg",
  R_Foot: "RightFoot",
  R_Toe: "RightToeBase",
  R_ToeBase: "RightToeBase",
  RightThigh: "RightUpLeg",
  RightCalf: "RightLeg",
  Right_Thigh: "RightUpLeg",
  Right_Calf: "RightLeg",
  Right_Foot: "RightFoot",
  Right_Toe: "RightToeBase",

  // Already standard names (identity mapping)
  Hips: "Hips",
  LeftUpLeg: "LeftUpLeg",
  LeftLeg: "LeftLeg",
  LeftFoot: "LeftFoot",
  LeftToeBase: "LeftToeBase",
  RightUpLeg: "RightUpLeg",
  RightLeg: "RightLeg",
  RightFoot: "RightFoot",
  RightToeBase: "RightToeBase",
};

/**
 * Extract the core bone name by stripping known prefixes
 * and mapping to standard humanoid names.
 * e.g., "characters3dcom___L_Thigh" -> "LeftUpLeg"
 *       "mixamorigLeftUpLeg" -> "LeftUpLeg"
 */
function extractCoreBoneName(boneName: string): string {
  // First strip any known prefix
  let stripped = boneName;
  for (const prefix of BONE_PREFIXES) {
    if (prefix && boneName.startsWith(prefix)) {
      stripped = boneName.slice(prefix.length);
      break;
    }
  }

  // Then map to standard name if needed
  const mapped = BONE_NAME_MAPPING[stripped];
  if (mapped) {
    return mapped;
  }

  // Return stripped name as-is if no mapping found
  return stripped;
}

/**
 * Check if a bone name (after extraction/mapping) is a leg bone.
 */
function isLegBone(coreName: string): boolean {
  return LEG_BONE_CORE_NAMES.includes(coreName);
}

/**
 * Retarget animation track name to match target skeleton's naming convention.
 * e.g., "characters3dcom___Hips.quaternion" -> "mixamorigHips.quaternion"
 */
function retargetTrackName(trackName: string, targetPrefix: string): string {
  const [boneName, ...rest] = trackName.split(".");
  if (!boneName) return trackName;

  const coreName = extractCoreBoneName(boneName);
  const property = rest.join(".");

  return `${targetPrefix}${coreName}.${property}`;
}

/**
 * Filter and retarget animation clip to only include leg bone ROTATION tracks,
 * remapping bone names to match the target skeleton.
 *
 * IMPORTANT: We only include .quaternion tracks, NOT .position or .scale:
 * - .position tracks have "root motion" that moves the avatar to wrong locations
 * - .scale tracks can cause the avatar to disappear
 * - .quaternion tracks are the actual joint rotations we want
 */
function filterAndRetargetToLegBones(
  clip: AnimationClip,
  targetPrefix: string
): AnimationClip {
  const legTracks: KeyframeTrack[] = [];

  for (const track of clip.tracks) {
    // Only include quaternion (rotation) tracks, not position or scale
    if (!track.name.includes(".quaternion")) {
      continue;
    }

    const boneName = track.name.split(".")[0] ?? "";
    const coreName = extractCoreBoneName(boneName);

    if (isLegBone(coreName)) {
      // Clone the track with retargeted name
      const newTrackName = retargetTrackName(track.name, targetPrefix);
      const clonedTrack = track.clone();
      clonedTrack.name = newTrackName;
      legTracks.push(clonedTrack);
    }
  }

  return new AnimationClip(clip.name + "_legs", clip.duration, legTracks);
}

/**
 * Direction keys for the 4-way blend
 */
type DirectionKey = "forward" | "backward" | "strafeLeft" | "strafeRight";

/**
 * Stores raw and processed clips for a direction
 */
interface DirectionalClip {
  raw: AnimationClip | null;
  processed: AnimationClip | null;
  action: AnimationAction | null;
}

export class LegAnimator {
  private mixer: AnimationMixer | null = null;
  private root: Object3D | null = null;
  private loader: GLTFLoader;
  private targetBonePrefix: string = "mixamorig";

  // Directional animations
  private directions: Record<DirectionKey, DirectionalClip> = {
    forward: { raw: null, processed: null, action: null },
    backward: { raw: null, processed: null, action: null },
    strafeLeft: { raw: null, processed: null, action: null },
    strafeRight: { raw: null, processed: null, action: null },
  };

  // Legacy single animation (for backward compatibility)
  private walkAction: AnimationAction | null = null;
  private walkClip: AnimationClip | null = null;
  private rawWalkClip: AnimationClip | null = null;

  private config: Required<LegAnimatorConfig> = {
    baseSpeed: 1,
    blendTime: 0.2,
    useRootMotion: false,
  };

  private currentLocomotion: LocomotionInput = {
    isMoving: false,
    speed: 0,
  };

  private initialized = false;
  private animationLoaded = false;
  private directionalMode = false;

  // Smooth weight blending for walk/idle transitions.
  // Instead of hard-switching between 0 and 1, we lerp to avoid jerky starts/stops.
  private currentWalkWeight = 0;
  private targetWalkWeight = 0;

  // Directional blend weights (smoothed)
  private currentDirWeights: Record<DirectionKey, number> = {
    forward: 0,
    backward: 0,
    strafeLeft: 0,
    strafeRight: 0,
  };
  private targetDirWeights: Record<DirectionKey, number> = {
    forward: 0,
    backward: 0,
    strafeLeft: 0,
    strafeRight: 0,
  };

  constructor() {
    this.loader = new GLTFLoader();
  }

  /**
   * Detect the bone naming prefix used by the skeleton.
   */
  private detectBonePrefix(root: Object3D): string {
    const prefixesToCheck = ["mixamorig", ""];

    for (const prefix of prefixesToCheck) {
      const testBoneName = `${prefix}Hips`;
      const bone = root.getObjectByName(testBoneName);
      if (bone) {
        return prefix;
      }
    }

    // Fallback: search for any bone containing "Hips"
    let foundPrefix = "mixamorig";
    root.traverse((obj) => {
      if (obj.name.includes("Hips")) {
        const idx = obj.name.indexOf("Hips");
        foundPrefix = obj.name.slice(0, idx);
      }
    });

    return foundPrefix;
  }

  initialize(root: Object3D): void {
    this.root = root;
    this.mixer = new AnimationMixer(root);
    this.targetBonePrefix = this.detectBonePrefix(root);
    this.initialized = true;

    // Process any pre-loaded animations
    if (this.directionalMode) {
      this.processDirectionalAnimations();
    } else if (this.rawWalkClip) {
      this.processAndCreateAction();
    }
  }

  /**
   * Load a single walk animation (legacy mode)
   */
  async loadWalkAnimation(url: string): Promise<void> {
    const clip = await this.loadAnimationClip(url);
    this.rawWalkClip = clip;
    this.animationLoaded = true;
    this.directionalMode = false;

    if (this.initialized && this.mixer) {
      this.processAndCreateAction();
    }
  }

  /**
   * Load all 4 directional animations for blending
   */
  async loadDirectionalAnimations(
    urls: DirectionalAnimationUrls
  ): Promise<void> {
    this.directionalMode = true;

    // Load all 4 in parallel
    const [forward, backward, strafeLeft, strafeRight] = await Promise.all([
      this.loadAnimationClip(urls.forward),
      this.loadAnimationClip(urls.backward),
      this.loadAnimationClip(urls.strafeLeft),
      this.loadAnimationClip(urls.strafeRight),
    ]);

    this.directions.forward.raw = forward;
    this.directions.backward.raw = backward;
    this.directions.strafeLeft.raw = strafeLeft;
    this.directions.strafeRight.raw = strafeRight;

    this.animationLoaded = true;

    if (this.initialized && this.mixer) {
      this.processDirectionalAnimations();
    }
  }

  /**
   * Load a single animation clip from URL
   */
  private loadAnimationClip(url: string): Promise<AnimationClip> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          if (gltf.animations.length === 0) {
            reject(new Error(`No animations found in ${url}`));
            return;
          }
          const clip = gltf.animations[0];
          if (!clip) {
            reject(new Error(`Animation clip is undefined in ${url}`));
            return;
          }
          resolve(clip);
        },
        undefined,
        (error) => {
          console.error(`[LegAnimator] Failed to load ${url}:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Process legacy single animation
   */
  private processAndCreateAction(): void {
    if (!this.rawWalkClip || !this.mixer) return;

    this.walkClip = filterAndRetargetToLegBones(
      this.rawWalkClip,
      this.targetBonePrefix
    );
    this.walkAction = this.mixer.clipAction(this.walkClip);
    this.walkAction.setLoop(LoopRepeat, Infinity);
    this.walkAction.enabled = true;
    this.walkAction.setEffectiveWeight(0);
    this.walkAction.play();
  }

  /**
   * Process all directional animations and create actions
   */
  private processDirectionalAnimations(): void {
    if (!this.mixer) return;

    for (const key of Object.keys(this.directions) as DirectionKey[]) {
      const dir = this.directions[key];
      if (!dir.raw) continue;

      dir.processed = filterAndRetargetToLegBones(
        dir.raw,
        this.targetBonePrefix
      );
      dir.action = this.mixer.clipAction(dir.processed);
      dir.action.setLoop(LoopRepeat, Infinity);
      dir.action.enabled = true;
      dir.action.setEffectiveWeight(0);
      dir.action.play();
    }
  }

  setWalkClip(clip: AnimationClip): void {
    this.rawWalkClip = clip;
    this.animationLoaded = true;
    this.directionalMode = false;

    if (this.initialized && this.mixer) {
      this.processAndCreateAction();
    }
  }

  setLocomotion(input: LocomotionInput): void {
    const wasMoving = this.currentLocomotion.isMoving;
    this.currentLocomotion = { ...input };

    if (this.directionalMode) {
      this.updateDirectionalBlend(input, wasMoving);
    } else {
      this.updateSingleAnimation(input, wasMoving);
    }
  }

  /**
   * Update single animation mode (legacy).
   * Sets TARGET weight - actual blending happens in update() via lerpWeights().
   */
  private updateSingleAnimation(
    input: LocomotionInput,
    _wasMoving: boolean
  ): void {
    if (!this.walkAction) return;

    this.targetWalkWeight = input.isMoving ? 1 : 0;

    if (input.isMoving) {
      const playbackSpeed = this.config.baseSpeed * Math.max(0.5, input.speed);
      this.walkAction.setEffectiveTimeScale(playbackSpeed);
    }
  }

  /**
   * Update directional blend based on movement direction.
   * Sets TARGET weights - actual blending happens in update() via lerpWeights().
   */
  private updateDirectionalBlend(
    input: LocomotionInput,
    _wasMoving: boolean
  ): void {
    const dir = input.moveDirection ?? { x: 0, z: 1 };

    // Calculate target weights for each direction
    const forwardWeight = Math.max(0, dir.z);
    const backwardWeight = Math.max(0, -dir.z);
    const strafeLeftWeight = Math.max(0, -dir.x);
    const strafeRightWeight = Math.max(0, dir.x);

    // Normalize so weights sum to 1 when moving
    const totalWeight =
      forwardWeight + backwardWeight + strafeLeftWeight + strafeRightWeight;
    const normalize = totalWeight > 0 ? 1 / totalWeight : 0;

    const movingMultiplier = input.isMoving ? 1 : 0;

    this.targetDirWeights.forward =
      forwardWeight * normalize * movingMultiplier;
    this.targetDirWeights.backward =
      backwardWeight * normalize * movingMultiplier;
    this.targetDirWeights.strafeLeft =
      strafeLeftWeight * normalize * movingMultiplier;
    this.targetDirWeights.strafeRight =
      strafeRightWeight * normalize * movingMultiplier;

    // Adjust playback speed
    if (input.isMoving) {
      const playbackSpeed = this.config.baseSpeed * Math.max(0.5, input.speed);
      for (const key of Object.keys(this.directions) as DirectionKey[]) {
        this.directions[key].action?.setEffectiveTimeScale(playbackSpeed);
      }
    }
  }

  /**
   * Set weight for a directional action
   */
  private setActionWeight(key: DirectionKey, weight: number): void {
    const action = this.directions[key].action;
    if (action) {
      action.setEffectiveWeight(weight);
    }
  }

  update(delta: number): void {
    if (!this.mixer) return;

    // Smooth weight blending each frame.
    // blendTime from config controls how fast we transition (0.2s default).
    // A higher lerp factor = faster blend. We use an exponential approach
    // that's framerate-independent: weight += (target - current) * (1 - e^(-speed * dt))
    const blendSpeed = 1 / Math.max(0.01, this.config.blendTime);
    const blendFactor = 1 - Math.exp(-blendSpeed * delta);

    if (this.directionalMode) {
      // Lerp each directional weight toward its target
      for (const key of Object.keys(this.directions) as DirectionKey[]) {
        const target = this.targetDirWeights[key];
        const current = this.currentDirWeights[key];
        const newWeight = current + (target - current) * blendFactor;
        this.currentDirWeights[key] = newWeight;
        this.setActionWeight(key, newWeight);
      }
    } else if (this.walkAction) {
      // Lerp single walk weight
      this.currentWalkWeight +=
        (this.targetWalkWeight - this.currentWalkWeight) * blendFactor;
      this.walkAction.setEffectiveWeight(this.currentWalkWeight);
    }

    this.mixer.update(delta);
  }

  isReady(): boolean {
    if (this.directionalMode) {
      return (
        this.initialized &&
        this.animationLoaded &&
        this.directions.forward.action !== null
      );
    }
    return this.initialized && this.animationLoaded && this.walkAction !== null;
  }

  configure(config: LegAnimatorConfig): void {
    this.config = { ...this.config, ...config };
  }

  dispose(): void {
    // Dispose directional actions
    for (const key of Object.keys(this.directions) as DirectionKey[]) {
      const action = this.directions[key].action;
      if (action) {
        action.stop();
      }
      this.directions[key] = { raw: null, processed: null, action: null };
    }

    // Dispose legacy action
    if (this.walkAction) {
      this.walkAction.stop();
      this.walkAction = null;
    }

    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    this.walkClip = null;
    this.rawWalkClip = null;
    this.root = null;
    this.initialized = false;
    this.animationLoaded = false;
    this.directionalMode = false;
  }
}
