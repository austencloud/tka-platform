/**
 * LocomotionAnimator
 *
 * Full-body animation player using Three.js AnimationMixer.
 * Unlike LegAnimator which filtered to leg bones only, this plays
 * ALL bones so walk animations include natural arm swing, hip sway, etc.
 * IK post-processing in AvatarAnimator selectively overrides arm bones
 * when props are held.
 *
 * State machine: idle <-> walk with crossfade transitions.
 * Walk state uses 4-way directional blending (forward, backward, strafeLeft, strafeRight).
 */

import type { AnimationAction, Object3D, KeyframeTrack } from "three";
import {
  AnimationMixer,
  AnimationClip,
  LoopRepeat,
  AdditiveAnimationBlendMode,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type {
  ILocomotionAnimator,
  LocomotionInput,
  AnimationUrls,
  LocomotionConfig,
} from "../contracts/ILocomotionAnimator";

/**
 * Known bone name prefixes from various sources.
 * Longer prefixes must come first to avoid partial matches.
 */
const BONE_PREFIXES = [
  "mixamorig1",
  "mixamorig:",
  "mixamorig",
  "characters3dcom___",
  "",
];

/**
 * Full humanoid bone name mapping from various conventions to standard names.
 * Covers hips, spine, head, arms, and legs.
 */
const BONE_NAME_MAPPING: Record<string, string> = {
  // === Hips/Pelvis ===
  Pelvis: "Hips",
  pelvis: "Hips",
  Hips: "Hips",

  // === Spine ===
  Spine: "Spine",
  Spine1: "Spine1",
  Spine2: "Spine2",
  Chest: "Spine1",
  UpperChest: "Spine2",
  Upper_Chest: "Spine2",

  // === Head ===
  Neck: "Neck",
  Head: "Head",

  // === Left Shoulder/Arm ===
  LeftShoulder: "LeftShoulder",
  L_Shoulder: "LeftShoulder",
  Left_Shoulder: "LeftShoulder",
  LeftArm: "LeftArm",
  L_Arm: "LeftArm",
  Left_Arm: "LeftArm",
  LeftUpperArm: "LeftArm",
  LeftForeArm: "LeftForeArm",
  L_ForeArm: "LeftForeArm",
  Left_ForeArm: "LeftForeArm",
  LeftHand: "LeftHand",
  L_Hand: "LeftHand",
  Left_Hand: "LeftHand",

  // === Right Shoulder/Arm ===
  RightShoulder: "RightShoulder",
  R_Shoulder: "RightShoulder",
  Right_Shoulder: "RightShoulder",
  RightArm: "RightArm",
  R_Arm: "RightArm",
  Right_Arm: "RightArm",
  RightUpperArm: "RightArm",
  RightForeArm: "RightForeArm",
  R_ForeArm: "RightForeArm",
  Right_ForeArm: "RightForeArm",
  RightHand: "RightHand",
  R_Hand: "RightHand",
  Right_Hand: "RightHand",

  // === Left Leg ===
  LeftUpLeg: "LeftUpLeg",
  L_Thigh: "LeftUpLeg",
  LeftThigh: "LeftUpLeg",
  Left_Thigh: "LeftUpLeg",
  LeftLeg: "LeftLeg",
  L_Calf: "LeftLeg",
  LeftCalf: "LeftLeg",
  Left_Calf: "LeftLeg",
  LeftFoot: "LeftFoot",
  L_Foot: "LeftFoot",
  Left_Foot: "LeftFoot",
  LeftToeBase: "LeftToeBase",
  L_Toe: "LeftToeBase",
  L_ToeBase: "LeftToeBase",
  Left_Toe: "LeftToeBase",

  // === Right Leg ===
  RightUpLeg: "RightUpLeg",
  R_Thigh: "RightUpLeg",
  RightThigh: "RightUpLeg",
  Right_Thigh: "RightUpLeg",
  RightLeg: "RightLeg",
  R_Calf: "RightLeg",
  RightCalf: "RightLeg",
  Right_Calf: "RightLeg",
  RightFoot: "RightFoot",
  R_Foot: "RightFoot",
  Right_Foot: "RightFoot",
  RightToeBase: "RightToeBase",
  R_Toe: "RightToeBase",
  R_ToeBase: "RightToeBase",
  Right_Toe: "RightToeBase",
};

/**
 * Extract the core bone name by stripping known prefixes
 * and mapping to standard humanoid names.
 * e.g., "characters3dcom___L_Thigh" -> "LeftUpLeg"
 *       "mixamorigLeftArm" -> "LeftArm"
 */
export function extractCoreBoneName(boneName: string): string {
  let stripped = boneName;
  for (const prefix of BONE_PREFIXES) {
    if (prefix && boneName.startsWith(prefix)) {
      stripped = boneName.slice(prefix.length);
      break;
    }
  }

  const mapped = BONE_NAME_MAPPING[stripped];
  return mapped ?? stripped;
}

/**
 * Retarget animation track name to match target skeleton's naming convention.
 * e.g., "characters3dcom___Hips.quaternion" -> "mixamorigHips.quaternion"
 */
export function retargetTrackName(
  trackName: string,
  targetPrefix: string
): string {
  const [boneName, ...rest] = trackName.split(".");
  if (!boneName) return trackName;

  const coreName = extractCoreBoneName(boneName);
  const property = rest.join(".");

  return `${targetPrefix}${coreName}.${property}`;
}

/**
 * Result of retargeting: the main clip (quaternion tracks, normal blend)
 * and an optional additive clip for Hips position deltas.
 */
export interface RetargetResult {
  /** Main clip with all quaternion tracks (normal blending) */
  main: AnimationClip;
  /** Hips position delta clip (additive blending) — null if no Hips position in source */
  hipsPosition: AnimationClip | null;
}

/**
 * Retarget animation clip to play on ALL bones (full body).
 *
 * Returns two clips:
 * 1. Main clip: all .quaternion tracks (normal blend mode)
 * 2. Hips position clip: delta offsets from first frame (additive blend mode)
 *
 * The Hips position is separated because it needs additive blending —
 * the absolute values from Mixamo would teleport the skeleton, but the
 * relative deltas provide weight-shift compensation that keeps the avatar
 * balanced during idle sway.
 */
/**
 * Bones to exclude from idle animation to prevent foot-lift lean.
 * The idle animation's weight-shift rotates these bones but without
 * Hips position compensation, the feet lift off the ground.
 * Upper body (spine, arms, head) still gets the breathing motion.
 */
export const IDLE_EXCLUDE_BONES = new Set([
  // Legs — rotation without Hips position compensation lifts feet
  "LeftUpLeg", "RightUpLeg",
  "LeftLeg", "RightLeg",
  "LeftFoot", "RightFoot",
  "LeftToeBase", "RightToeBase",
  // Lower spine — rotation tilts the whole torso sideways.
  // Spine2/Neck/Head still animate for subtle breathing.
  "Spine",
  "Spine1",
]);

export function retargetFullBody(
  clip: AnimationClip,
  targetPrefix: string,
  /** Optional set of core bone names to skip */
  excludeBones?: Set<string>
): RetargetResult {
  const mainTracks: KeyframeTrack[] = [];
  let hipsPositionTrack: KeyframeTrack | null = null;

  for (const track of clip.tracks) {
    const boneName = track.name.split(".")[0] ?? "";
    const coreName = extractCoreBoneName(boneName);
    const property = track.name.split(".").slice(1).join(".");

    // Skip bones in the exclusion set (e.g. leg bones for idle animation)
    if (excludeBones?.has(coreName)) {
      continue;
    }

    // Exclude Hips quaternion — the locomotion system controls avatar
    // orientation via the group's rotation.y (facingAngle). The animation's
    // Hips rotation compounds with this and causes sideways tilt.
    if (coreName === "Hips" && property === "quaternion") {
      continue;
    }

    // Capture Hips position as delta from first frame for additive blending.
    // The absolute values are in Mixamo's coordinate space — subtracting
    // the first keyframe gives us pure weight-shift offsets.
    if (coreName === "Hips" && property === "position") {
      const newTrackName = retargetTrackName(track.name, targetPrefix);
      const clonedTrack = track.clone();
      clonedTrack.name = newTrackName;

      const values = clonedTrack.values;
      if (values.length >= 3) {
        const baseY = values[1]!;
        for (let i = 0; i < values.length; i += 3) {
          // Zero out X and Z — only keep Y (vertical bob).
          // Horizontal drift makes the avatar slide around;
          // vertical movement keeps feet planted during weight shifts.
          values[i] = 0;       // X = 0 (no horizontal drift)
          values[i + 1] = values[i + 1]! - baseY;  // Y = delta from rest
          values[i + 2] = 0;   // Z = 0 (no forward/back drift)
        }
      }

      hipsPositionTrack = clonedTrack;
      continue;
    }

    // Skip bones that don't exist on our avatar model:
    // - Finger tip segments (LeftHandThumb4, LeftHandIndex4, etc.)
    // - End/terminal bones (HeadTop_End, LeftToe_End, RightToe_End)
    if (coreName.match(/\d$/) && coreName.match(/Hand/)) {
      const digit = parseInt(coreName.slice(-1));
      if (digit >= 4) continue;
    }
    if (coreName.endsWith("_End")) {
      continue;
    }

    // Keep only quaternion tracks — position tracks cause root motion
    // displacement, scale tracks can cause meshes to disappear.
    if (!track.name.includes(".quaternion")) {
      continue;
    }

    const newTrackName = retargetTrackName(track.name, targetPrefix);
    const clonedTrack = track.clone();
    clonedTrack.name = newTrackName;
    mainTracks.push(clonedTrack);
  }

  const main = new AnimationClip(
    clip.name + "_fullBody",
    clip.duration,
    mainTracks
  );

  const hipsPosition = hipsPositionTrack
    ? new AnimationClip(
        clip.name + "_hipsPos",
        clip.duration,
        [hipsPositionTrack]
      )
    : null;

  return { main, hipsPosition };
}

/**
 * Direction keys for the 4-way walk blend
 */
type DirectionKey = "forward" | "backward" | "strafeLeft" | "strafeRight";

export class LocomotionAnimator implements ILocomotionAnimator {
  private mixer: AnimationMixer | null = null;
  private root: Object3D | null = null;
  private loader: GLTFLoader;
  private targetBonePrefix: string = "mixamorig";

  // Idle animation
  private idleClipRaw: AnimationClip | null = null;
  private idleClip: AnimationClip | null = null;
  private idleAction: AnimationAction | null = null;
  // Additive Hips position actions (weight-shift compensation)
  private idleHipsPosAction: AnimationAction | null = null;

  // Directional walk animations
  private walkClipsRaw: Record<DirectionKey, AnimationClip | null> = {
    forward: null,
    backward: null,
    strafeLeft: null,
    strafeRight: null,
  };
  private walkActions: Record<DirectionKey, AnimationAction | null> = {
    forward: null,
    backward: null,
    strafeLeft: null,
    strafeRight: null,
  };

  private config: Required<LocomotionConfig> = {
    baseSpeed: 1,
    blendTime: 0.3,
    animationWalkSpeed: 1.57,
  };

  private currentLocomotion: LocomotionInput = {
    isMoving: false,
    speed: 0,
  };

  private initialized = false;
  private idleLoaded = false;
  private walkLoaded = false;

  // Idle weight (managed by same lerp system as walk directions)
  private currentIdleWeight = 1; // Start at 1 (idle by default)
  private targetIdleWeight = 1;

  // Directional blend weights (smoothed via exponential lerp)
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
   * Detect the bone naming prefix used by the target skeleton.
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

    // Fallback: traverse and find any bone containing "Hips"
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
    this.processLoadedClips();
  }

  async loadAnimations(urls: AnimationUrls): Promise<void> {
    const entries: Array<{ key: "idle" | DirectionKey; url: string }> = [
      { key: "idle", url: urls.idle },
      { key: "forward", url: urls.forward },
      { key: "backward", url: urls.backward },
      { key: "strafeLeft", url: urls.strafeLeft },
      { key: "strafeRight", url: urls.strafeRight },
    ];

    const results = await Promise.allSettled(
      entries.map(async (entry) => {
        const clip = await this.loadAnimationClip(entry.url);
        return { key: entry.key, clip };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { key, clip } = result.value;
        if (key === "idle") {
          this.idleClipRaw = clip;
          this.idleLoaded = true;
        } else {
          this.walkClipsRaw[key] = clip;
          this.walkLoaded = true;
        }
      } else {
        console.warn(
          `[LocomotionAnimator] Failed to load animation clip:`,
          result.reason
        );
      }
    }

    if (this.initialized && this.mixer) {
      this.processLoadedClips();
    }
  }

  /**
   * Load a single animation clip from a GLTF/GLB URL.
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
          console.error(
            `[LocomotionAnimator] Failed to load ${url}:`,
            error
          );
          reject(error);
        }
      );
    });
  }

  /**
   * Retarget and create actions for all loaded clips.
   * Called after both initialize() and loadAnimations() have completed.
   */
  private processLoadedClips(): void {
    if (!this.mixer) return;

    // Process idle clip — exclude legs and lower spine so feet stay
    // perfectly planted. Without Hips position compensation (which we
    // can't get working without floating), any leg rotation slides feet.
    // Spine2/Neck/Head/Arms still animate for subtle breathing.
    if (this.idleClipRaw && !this.idleAction) {
      const { main, hipsPosition } = retargetFullBody(
        this.idleClipRaw,
        this.targetBonePrefix,
        IDLE_EXCLUDE_BONES
      );
      this.idleClip = main;
      this.idleAction = this.mixer.clipAction(main);
      this.idleAction.setLoop(LoopRepeat, Infinity);
      this.idleAction.enabled = true;
      this.idleAction.setEffectiveWeight(1);
      this.idleAction.play();

      // Hips position additive track is available but causes floating —
      // the cm-space deltas don't translate correctly to our scaled skeleton.
      // Future: implement foot IK for proper grounding instead.
    }

    // Process walk clips
    for (const key of Object.keys(this.walkClipsRaw) as DirectionKey[]) {
      const raw = this.walkClipsRaw[key];
      if (!raw || this.walkActions[key]) continue;

      const { main } = retargetFullBody(raw, this.targetBonePrefix);
      const action = this.mixer.clipAction(main);
      action.setLoop(LoopRepeat, Infinity);
      action.enabled = true;
      action.setEffectiveWeight(0);
      action.play();
      this.walkActions[key] = action;
    }
  }

  setLocomotion(input: LocomotionInput): void {
    this.currentLocomotion = { ...input };

    if (input.isMoving) {
      // Walking: idle weight → 0, walk directions get their computed weights
      this.targetIdleWeight = 0;
      this.updateDirectionalTargets(input);
      this.updatePlaybackSpeed(input.speed);
    } else {
      // Stopped: idle weight → 1, all walk directions → 0
      this.targetIdleWeight = 1;
      this.targetDirWeights.forward = 0;
      this.targetDirWeights.backward = 0;
      this.targetDirWeights.strafeLeft = 0;
      this.targetDirWeights.strafeRight = 0;
    }
  }

  /**
   * Determine which walk direction should be dominant based on current target weights.
   * Falls back to forward if no direction has weight yet.
   */
  /**
   * Find the walk direction with the highest current (smoothed) weight.
   */
  /**
   * Compute normalized directional weights from a movement direction vector.
   */
  private computeDirectionalWeights(
    dir: { x: number; z: number }
  ): Record<DirectionKey, number> {
    const forwardWeight = Math.max(0, dir.z);
    const backwardWeight = Math.max(0, -dir.z);
    const strafeLeftWeight = Math.max(0, -dir.x);
    const strafeRightWeight = Math.max(0, dir.x);

    const total =
      forwardWeight + backwardWeight + strafeLeftWeight + strafeRightWeight;
    const normalize = total > 0 ? 1 / total : 0;

    return {
      forward: forwardWeight * normalize,
      backward: backwardWeight * normalize,
      strafeLeft: strafeLeftWeight * normalize,
      strafeRight: strafeRightWeight * normalize,
    };
  }

  /**
   * Set target directional weights based on movement input.
   */
  private updateDirectionalTargets(input: LocomotionInput): void {
    const dir = input.moveDirection ?? { x: 0, z: 1 };
    const weights = this.computeDirectionalWeights(dir);

    this.targetDirWeights.forward = weights.forward;
    this.targetDirWeights.backward = weights.backward;
    this.targetDirWeights.strafeLeft = weights.strafeLeft;
    this.targetDirWeights.strafeRight = weights.strafeRight;
  }

  /**
   * Sync walk animation playback rate with actual movement speed.
   * timeScale = actualSpeed / animationWalkSpeed so feet plant
   * at the same rate the character moves across the ground.
   * @param speed Actual movement speed in scene units/sec
   */
  private updatePlaybackSpeed(speed: number): void {
    const timeScale =
      this.config.baseSpeed *
      Math.max(0.3, speed / this.config.animationWalkSpeed);
    for (const key of Object.keys(this.walkActions) as DirectionKey[]) {
      this.walkActions[key]?.setEffectiveTimeScale(timeScale);
    }
  }

  update(delta: number): void {
    if (!this.mixer) return;

    // Exponential smoothing for framerate-independent blending
    const blendSpeed = 1 / Math.max(0.01, this.config.blendTime);
    const blendFactor = 1 - Math.exp(-blendSpeed * delta);

    // Smoothly blend idle weight (both main quaternion and additive hips position)
    this.currentIdleWeight += (this.targetIdleWeight - this.currentIdleWeight) * blendFactor;
    if (this.idleAction) {
      this.idleAction.setEffectiveWeight(this.currentIdleWeight);
    }
    if (this.idleHipsPosAction) {
      this.idleHipsPosAction.setEffectiveWeight(this.currentIdleWeight);
    }

    // Smoothly blend directional walk weights each frame
    for (const key of Object.keys(this.walkActions) as DirectionKey[]) {
      const target = this.targetDirWeights[key];
      const current = this.currentDirWeights[key];
      const newWeight = current + (target - current) * blendFactor;
      this.currentDirWeights[key] = newWeight;

      const action = this.walkActions[key];
      if (action) {
        action.setEffectiveWeight(newWeight);
      }
    }

    this.mixer.update(delta);
  }

  isReady(): boolean {
    return (
      this.initialized && (this.idleLoaded || this.walkLoaded)
    );
  }

  configure(config: LocomotionConfig): void {
    this.config = { ...this.config, ...config };
  }

  dispose(): void {
    // Stop all walk actions
    for (const key of Object.keys(this.walkActions) as DirectionKey[]) {
      const action = this.walkActions[key];
      if (action) {
        action.stop();
      }
      this.walkActions[key] = null;
      this.walkClipsRaw[key] = null;
    }

    // Stop idle actions
    if (this.idleAction) {
      this.idleAction.stop();
      this.idleAction = null;
    }
    if (this.idleHipsPosAction) {
      this.idleHipsPosAction.stop();
      this.idleHipsPosAction = null;
    }

    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    this.idleClipRaw = null;
    this.idleClip = null;
    this.root = null;
    this.initialized = false;
    this.idleLoaded = false;
    this.walkLoaded = false;
    this.currentIdleWeight = 1;
    this.targetIdleWeight = 1;

    // Reset weights
    for (const key of Object.keys(this.currentDirWeights) as DirectionKey[]) {
      this.currentDirWeights[key] = 0;
      this.targetDirWeights[key] = 0;
    }
  }
}
