/**
 * LocomotionAnimator
 *
 * Plays raw Mixamo animation clips via Three.js AnimationMixer.
 * Modeled after the canonical Three.js skinning-blending example:
 * https://threejs.org/examples/webgl_animation_skinning_blending.html
 *
 * The principle: don't touch the clips. Load them, play them, blend by weight.
 * The mixer handles everything. Mixamo animations are authored to look correct
 * when played unmodified on a matching Mixamo skeleton.
 *
 * State machine: idle <-> walk (4-way directional) <-> jump/fall/land/crouch.
 */

import type { AnimationAction, Object3D, Bone } from "three";
import { AnimationMixer, AnimationClip, LoopRepeat, LoopOnce } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { LocomotionState } from "./AnimationStateMachine";

export interface LocomotionInput {
  /** Whether the avatar is currently moving */
  isMoving: boolean;
  /** Movement speed in scene units/sec (used to sync animation playback with actual movement) */
  speed: number;
  /** Optional: facing angle for root motion alignment */
  facingAngle?: number;
  /** Movement direction relative to facing: x (-1 left, +1 right), z (-1 back, +1 forward) */
  moveDirection?: { x: number; z: number };
}

export interface AnimationUrls {
  idle: string;
  forward: string;
  backward: string;
  strafeLeft: string;
  strafeRight: string;
  /** Jump ascent clip (optional - needed for jump/fall/land states) */
  jump?: string;
  /** Sustained fall loop (optional) */
  fall?: string;
  /** One-shot landing recovery (optional) */
  land?: string;
  /** Crouch idle loop (optional) */
  crouch?: string;
}

export interface LocomotionConfig {
  /** Base playback speed multiplier (default: 1) */
  baseSpeed?: number;
  /** Blend time when transitioning between states (seconds, default: 0.3) */
  blendTime?: number;
  /**
   * The walk animation's natural speed in scene units/sec.
   * Mixamo walk animations are typically ~1.4 m/s.
   * Animation timeScale = actualSpeed / animationWalkSpeed
   * so feet match actual ground movement. Default: 1.4
   */
  animationWalkSpeed?: number;
  /**
   * Enable root motion: keep Hips position track in animations so
   * RootMotionExtractor can read XZ displacement each frame.
   * When false (default), Hips position is filtered out as before.
   */
  enableRootMotion?: boolean;
  /**
   * Strip leg bone rotation tracks from the idle clip so feet stay
   * perfectly planted. Used for exhibit performers that stand in
   * place during sequence playback - upper body gets idle sway but
   * legs remain in bind pose. Default: false.
   */
  stripLegBones?: boolean;
}

type DirectionKey = "forward" | "backward" | "strafeLeft" | "strafeRight";

/**
 * Known Mixamo bone prefixes. Animation files may use a different
 * variant than the model (e.g., "mixamorig:" vs "mixamorig").
 * We detect the animation's prefix and remap to the model's prefix.
 */
const KNOWN_PREFIXES = ["mixamorig1", "mixamorig:", "mixamorig", ""];

/**
 * Detect which prefix an animation clip uses by checking its first track.
 */
function detectClipPrefix(clip: AnimationClip): string {
  if (clip.tracks.length === 0) return "";
  const boneName = clip.tracks[0]!.name.split(".")[0] ?? "";
  for (const prefix of KNOWN_PREFIXES) {
    if (prefix && boneName.startsWith(prefix)) return prefix;
  }
  return "";
}

/**
 * Remap track names to match the model's bone prefix, and keep only the
 * tracks that produce correct results:
 *
 * KEEP:
 * - All .quaternion tracks (bone rotations - the core of animation)
 * - Hips .position track when keepHipsPosition is true (for root motion)
 *
 * FILTER OUT:
 * - Hips .quaternion (Mixamo separate exports bake base orientation)
 * - .position tracks on non-Hips bones (cause limb displacement)
 * - .scale tracks on any bone (can make meshes disappear)
 * - Hips .position when keepHipsPosition is false (teleports avatar)
 *
 * keepHipsPosition = true: Root motion mode. The Hips position track
 * contains XZ displacement that RootMotionExtractor reads each frame.
 * The extractor zeros it out after reading so the mesh stays centered.
 *
 * keepHipsPosition = false: Legacy mode. All position tracks filtered
 * out. Code-driven movement only.
 */
/**
 * @param hipsMode - Controls Hips position track handling:
 *   "strip"    - Remove Hips position entirely (default for idle/jump/fall/land)
 *   "rootMotion" - Keep and make Z relative to first frame (for walk/run root motion)
 *   "pose"     - Keep as-is, no baseline subtraction (for crouch - absolute Y is the pose)
 */
/**
 * Leg bone names to strip when stripLegBones is true.
 * Exhibit performers don't need leg animation - feet stay planted.
 */
const LEG_BONE_NAMES = new Set([
  "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase",
  "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase",
]);

function remapClipToSkeleton(
  clip: AnimationClip,
  modelPrefix: string,
  hipsMode: "strip" | "rootMotion" | "pose" = "strip",
  stripLegBones = false
): AnimationClip {
  const clipPrefix = detectClipPrefix(clip);

  const tracks = clip.tracks
    .filter((track) => {
      const dotIdx = track.name.indexOf(".");
      if (dotIdx === -1) return false;

      const boneName = track.name.slice(0, dotIdx);
      const property = track.name.slice(dotIdx + 1);
      const coreName = clipPrefix ? boneName.slice(clipPrefix.length) : boneName;

      // Skip bones that don't exist on our models
      if (coreName.endsWith("_End")) return false;
      if (/Hand.*4$/.test(coreName)) return false;

      // Strip leg bones for exhibit performers - feet stay perfectly planted
      if (stripLegBones && LEG_BONE_NAMES.has(coreName)) return false;

      // Skip Hips quaternion - Mixamo separate exports bake the character's
      // base orientation into this track, which lays the avatar flat on its back.
      // The locomotion system controls facing via group rotation instead.
      if (coreName === "Hips" && property === "quaternion") return false;

      // Keep Hips position track when needed for root motion or crouch pose.
      if (coreName === "Hips" && property === "position" && hipsMode !== "strip") return true;

      // Keep all other quaternion tracks - bone rotations are the animation.
      // Filter out position/scale tracks (position teleports, scale vanishes).
      if (property === "quaternion") return true;

      return false;
    })
    .map((track) => {
      const dotIdx = track.name.indexOf(".");
      const boneName = track.name.slice(0, dotIdx);
      const property = track.name.slice(dotIdx);
      const coreName = clipPrefix ? boneName.slice(clipPrefix.length) : boneName;

      const cloned = track.clone();

      // Remap bone prefix if needed
      if (clipPrefix !== modelPrefix) {
        cloned.name = `${modelPrefix}${coreName}${property}`;
      }

      // Root motion: make Z (vertical in GLB coords) relative to first frame.
      // Mixamo FBX→GLB Z = absolute hip height (~-100cm). Subtracting the
      // first keyframe's Z preserves the natural vertical bob (hips go up
      // and down ~2-3cm per step) while removing the absolute offset that
      // would slam the avatar underground.
      if (coreName === "Hips" && property.includes("position") && hipsMode === "rootMotion") {
        const values = cloned.values as Float32Array;
        const baseZ = values[2] ?? 0; // First keyframe's Z = rest height
        for (let i = 2; i < values.length; i += 3) {
          values[i]! -= baseZ; // Relative offset preserves vertical bob
        }
      }

      // Pose mode (crouch): Mixamo FBX→GLB Hips position values are in
      // centimeters (~85cm) but the skeleton is in meters (~0.85m). Scale
      // by 0.01 to fix the unit mismatch. Then nudge Z (vertical in GLB)
      // up by 0.04m - measured via foot bone world-Y logging: the grounded
      // foot's toeBase averaged -0.005m (slightly below floor). The 0.04m
      // correction centers it at +0.035m (flush with floor surface).
      if (coreName === "Hips" && property.includes("position") && hipsMode === "pose") {
        const values = cloned.values as Float32Array;
        for (let i = 0; i < values.length; i++) {
          values[i]! *= 0.01;
        }
        // Z = vertical axis in GLB. Raise hips slightly so feet don't clip floor.
        for (let i = 2; i < values.length; i += 3) {
          values[i]! += 0.04;
        }
      }

      return cloned;
    });

  return new AnimationClip(clip.name, clip.duration, tracks);
}

export class LocomotionAnimator {
  private mixer: AnimationMixer | null = null;
  private root: Object3D | null = null;
  private loader = new GLTFLoader();
  private modelPrefix = "mixamorig";

  // Actions - created from raw clips, no processing
  private idleAction: AnimationAction | null = null;
  private walkActions: Record<DirectionKey, AnimationAction | null> = {
    forward: null,
    backward: null,
    strafeLeft: null,
    strafeRight: null,
  };
  private jumpAction: AnimationAction | null = null;
  private fallAction: AnimationAction | null = null;
  private landAction: AnimationAction | null = null;
  private crouchAction: AnimationAction | null = null;

  // Raw clips (stored between loadAnimations and initialize)
  private pendingClips: Map<string, AnimationClip> = new Map();

  // State
  private activeState: LocomotionState | null = null;
  private currentActiveState: LocomotionState | null = null;
  private initialized = false;
  private clipsLoaded = false;

  private config: Required<LocomotionConfig> = {
    baseSpeed: 1,
    blendTime: 0.15,
    animationWalkSpeed: 1.57,
    enableRootMotion: false,
    stripLegBones: false,
  };

  // Blend weights (smoothed each frame)
  private currentIdleWeight = 1;
  private targetIdleWeight = 1;
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

  initialize(root: Object3D): void {
    this.root = root;
    this.mixer = new AnimationMixer(root);
    this.modelPrefix = this.detectModelPrefix(root);
    this.initialized = true;

    if (this.clipsLoaded) {
      this.createActions();
    }
  }

  /**
   * Detect bone naming prefix on the loaded model.
   */
  private detectModelPrefix(root: Object3D): string {
    for (const prefix of KNOWN_PREFIXES) {
      if (root.getObjectByName(`${prefix}Hips`)) return prefix;
    }
    // Fallback: search for any bone containing "Hips"
    let found = "mixamorig";
    root.traverse((obj) => {
      if (obj.name.includes("Hips")) {
        found = obj.name.slice(0, obj.name.indexOf("Hips"));
      }
    });
    return found;
  }

  async loadAnimations(urls: AnimationUrls): Promise<void> {
    const entries: Array<{ key: string; url: string }> = [
      { key: "idle", url: urls.idle },
      { key: "forward", url: urls.forward },
      { key: "backward", url: urls.backward },
      { key: "strafeLeft", url: urls.strafeLeft },
      { key: "strafeRight", url: urls.strafeRight },
    ];
    if (urls.jump) entries.push({ key: "jump", url: urls.jump });
    if (urls.fall) entries.push({ key: "fall", url: urls.fall });
    if (urls.land) entries.push({ key: "land", url: urls.land });
    if (urls.crouch) entries.push({ key: "crouch", url: urls.crouch });

    const results = await Promise.allSettled(
      entries.map(async ({ key, url }) => {
        const gltf = await this.loadGltf(url);
        const clip = gltf.animations[0];
        if (!clip) throw new Error(`No animation in ${url}`);
        // Blender exports all Mixamo clips with the same name
        // ("Armature|mixamo.com|Layer0"). AnimationMixer caches actions
        // by clip name, so duplicate names cause all actions to share
        // the same clip. Give each a unique name.
        clip.name = key;
        return { key, clip };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        this.pendingClips.set(result.value.key, result.value.clip);
      }
    }

    this.clipsLoaded = true;
    if (this.initialized && this.mixer) {
      this.createActions();
    }
  }

  /**
   * Remap a pending clip's track names to match this model's bone prefix.
   * When root motion is enabled, keeps Hips position track for locomotion
   * clips (walk/run) so RootMotionExtractor can read XZ deltas.
   */
  private prepareClip(key: string): AnimationClip | null {
    const raw = this.pendingClips.get(key);
    if (!raw) return null;

    // Determine how to handle the Hips position track:
    // - Walk/run clips with root motion: keep Hips position, subtract Z baseline
    // - Crouch: keep Hips position as-is (absolute Y IS the crouched height)
    // - Everything else: strip Hips position (would teleport the avatar)
    const isLocomotionClip =
      key === "forward" ||
      key === "backward" ||
      key === "strafeLeft" ||
      key === "strafeRight";

    // Crouch uses "pose" mode - keeps Hips position track but scales cm→m
    // (Mixamo FBX→GLB values are in centimeters, skeleton is in meters).
    // This lets the Hips bone drop to the correct crouched height.
    let hipsMode: "strip" | "rootMotion" | "pose" = "strip";
    if (this.config.enableRootMotion && isLocomotionClip) hipsMode = "rootMotion";
    if (key === "crouch") hipsMode = "pose";

    // Strip leg bones from idle clip for exhibit performers so feet
    // stay perfectly planted during sequence playback.
    const stripLegs = this.config.stripLegBones && key === "idle";

    return remapClipToSkeleton(raw, this.modelPrefix, hipsMode, stripLegs);
  }

  /**
   * Create actions from clips - only bone prefix remapping, no track filtering.
   * Play all simultaneously, control blending purely through weights.
   * This is how the canonical Three.js skinning-blending example works.
   */
  private createActions(): void {
    if (!this.mixer) return;


    // Idle - starts at weight 1
    const idleClip = this.prepareClip("idle");
    if (idleClip && !this.idleAction) {
      this.idleAction = this.mixer.clipAction(idleClip);
      this.idleAction.setLoop(LoopRepeat, Infinity);
      this.setWeight(this.idleAction, 1);
      this.idleAction.play();
    }

    // Walk directions - start at weight 0
    for (const key of ["forward", "backward", "strafeLeft", "strafeRight"] as DirectionKey[]) {
      const clip = this.prepareClip(key);
      if (clip && !this.walkActions[key]) {
        const action = this.mixer.clipAction(clip);
        action.setLoop(LoopRepeat, Infinity);
        this.setWeight(action, 0);
        action.play();
        this.walkActions[key] = action;
      }
    }

    // Jump (one-shot)
    const jumpClip = this.prepareClip("jump");
    if (jumpClip && !this.jumpAction) {
      this.jumpAction = this.mixer.clipAction(jumpClip);
      this.jumpAction.setLoop(LoopOnce, 1);
      this.jumpAction.clampWhenFinished = true;
      this.setWeight(this.jumpAction, 0);
      this.jumpAction.play();
    }

    // Fall (loop)
    const fallClip = this.prepareClip("fall");
    if (fallClip && !this.fallAction) {
      this.fallAction = this.mixer.clipAction(fallClip);
      this.fallAction.setLoop(LoopRepeat, Infinity);
      this.setWeight(this.fallAction, 0);
      this.fallAction.play();
    }

    // Land (one-shot)
    const landClip = this.prepareClip("land");
    if (landClip && !this.landAction) {
      this.landAction = this.mixer.clipAction(landClip);
      this.landAction.setLoop(LoopOnce, 1);
      this.landAction.clampWhenFinished = true;
      this.setWeight(this.landAction, 0);
      this.landAction.play();
    }

    // Crouch (loop)
    const crouchClip = this.prepareClip("crouch");
    if (crouchClip && !this.crouchAction) {
      this.crouchAction = this.mixer.clipAction(crouchClip);
      this.crouchAction.setLoop(LoopRepeat, Infinity);
      this.setWeight(this.crouchAction, 0);
      this.crouchAction.play();
    }
  }

  /**
   * Set weight on an action - same helper as the Three.js example.
   */
  private setWeight(action: AnimationAction, weight: number): void {
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(weight);
  }

  setLocomotion(input: LocomotionInput): void {
    if (input.isMoving) {
      this.targetIdleWeight = 0;
      this.updateDirectionalTargets(input);
      this.updatePlaybackSpeed(input.speed);
    } else {
      this.targetIdleWeight = 1;
      this.targetDirWeights.forward = 0;
      this.targetDirWeights.backward = 0;
      this.targetDirWeights.strafeLeft = 0;
      this.targetDirWeights.strafeRight = 0;
    }
  }

  setActiveState(state: LocomotionState): void {
    this.activeState = state;
  }

  update(delta: number): void {
    if (!this.mixer) return;

    // Exponential smoothing for framerate-independent blending
    const blendSpeed = 1 / Math.max(0.01, this.config.blendTime);
    const blendFactor = 1 - Math.exp(-blendSpeed * delta);

    if (this.activeState !== null) {
      this.applyStateWeights(blendFactor);
    } else {
      this.applyLegacyWeights(blendFactor);
    }

    this.mixer.update(delta);
  }

  isReady(): boolean {
    return this.initialized && this.clipsLoaded;
  }

  configure(config: LocomotionConfig): void {
    this.config = { ...this.config, ...config };
  }

  getHipsBone(): Bone | null {
    if (!this.root) return null;
    const hipsName = `${this.modelPrefix}Hips`;
    const obj = this.root.getObjectByName(hipsName);
    return (obj as Bone) ?? null;
  }

  dispose(): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    this.idleAction = null;
    this.jumpAction = null;
    this.fallAction = null;
    this.landAction = null;
    this.crouchAction = null;
    for (const key of Object.keys(this.walkActions) as DirectionKey[]) {
      this.walkActions[key] = null;
    }
    this.pendingClips.clear();
    this.root = null;
    this.initialized = false;
    this.clipsLoaded = false;
    this.currentIdleWeight = 1;
    this.targetIdleWeight = 1;
    this.activeState = null;
    this.currentActiveState = null;
    for (const key of Object.keys(this.currentDirWeights) as DirectionKey[]) {
      this.currentDirWeights[key] = 0;
      this.targetDirWeights[key] = 0;
    }
  }

  // --- Private helpers ---

  private loadGltf(url: string): Promise<import("three/examples/jsm/loaders/GLTFLoader.js").GLTF> {
    return new Promise((resolve, reject) => {
      this.loader.load(url, resolve, undefined, reject);
    });
  }

  private updateDirectionalTargets(input: LocomotionInput): void {
    const dir = input.moveDirection ?? { x: 0, z: 1 };
    const fw = Math.max(0, dir.z);
    const bw = Math.max(0, -dir.z);
    const sl = Math.max(0, -dir.x);
    const sr = Math.max(0, dir.x);

    // When moving backward (S held), use 100% backward animation regardless
    // of strafe input. Blending backward + strafe produces an awkward hybrid
    // pose. The physics still moves diagonally - only the animation is pure
    // backward. This matches how most third-person games handle it.
    if (bw > 0) {
      this.targetDirWeights.forward = 0;
      this.targetDirWeights.backward = 1;
      this.targetDirWeights.strafeLeft = 0;
      this.targetDirWeights.strafeRight = 0;
      return;
    }

    const total = fw + sl + sr;
    const n = total > 0 ? 1 / total : 0;

    this.targetDirWeights.forward = fw * n;
    this.targetDirWeights.backward = 0;
    this.targetDirWeights.strafeLeft = sl * n;
    this.targetDirWeights.strafeRight = sr * n;
  }

  private updatePlaybackSpeed(speed: number): void {
    // With root motion, the animation plays at natural speed (1.0) and
    // the displacement it produces IS the movement. Speed-matching would
    // slow the animation while the root motion delta stays the same,
    // causing feet to slide.
    if (this.config.enableRootMotion) {
      for (const key of Object.keys(this.walkActions) as DirectionKey[]) {
        this.walkActions[key]?.setEffectiveTimeScale(this.config.baseSpeed);
      }
      return;
    }

    const timeScale =
      this.config.baseSpeed *
      Math.max(0.3, speed / this.config.animationWalkSpeed);
    for (const key of Object.keys(this.walkActions) as DirectionKey[]) {
      this.walkActions[key]?.setEffectiveTimeScale(timeScale);
    }
  }

  private applyStateWeights(blendFactor: number): void {
    const state = this.activeState!;

    // Phase-based jump: each state has its own clip.
    // jump-up = push off (one-shot), falling-idle = air loop, hard-landing = absorb (one-shot).
    // Physics owns vertical position; animations are purely cosmetic poses.
    const wantIdle = state === LocomotionState.IDLE ? 1 : 0;
    const wantJump = state === LocomotionState.JUMPING ? 1 : 0;
    const wantFall = state === LocomotionState.FALLING ? 1 : 0;
    const wantLand = state === LocomotionState.LANDING ? 1 : 0;

    // Crouch-walk: when crouching with movement input, blend crouch pose (60%)
    // with walk directions (40%) at reduced playback speed. This produces a
    // "hunched walk" without needing a dedicated crouch-walk animation clip.
    // Without movement, 100% crouch-idle plays normally.
    const isCrouching = state === LocomotionState.CROUCHING;
    const hasMovement = Object.values(this.targetDirWeights).some(w => w > 0);
    const crouchWalking = isCrouching && hasMovement;

    const wantWalk = state === LocomotionState.WALKING ? 1 : crouchWalking ? 0.4 : 0;
    const wantCrouch = isCrouching ? (crouchWalking ? 0.6 : 1) : 0;

    // Idle
    this.currentIdleWeight += (wantIdle - this.currentIdleWeight) * blendFactor;
    this.idleAction?.setEffectiveWeight(this.currentIdleWeight);

    // Walk directions (scaled by wantWalk - also drives crouch-walk blend)
    for (const key of Object.keys(this.walkActions) as DirectionKey[]) {
      const dirTarget = this.targetDirWeights[key] * wantWalk;
      const current = this.currentDirWeights[key];
      const newWeight = current + (dirTarget - current) * blendFactor;
      this.currentDirWeights[key] = newWeight;
      this.walkActions[key]?.setEffectiveWeight(newWeight);
    }

    // Airborne phase clips + crouch
    this.blendAction(this.crouchAction, wantCrouch, blendFactor);
    this.blendAction(this.jumpAction, wantJump, blendFactor);
    this.blendAction(this.fallAction, wantFall, blendFactor);
    this.blendAction(this.landAction, wantLand, blendFactor);

    // On state entry: snap weights for instant transitions on one-shot clips.
    if (state !== this.currentActiveState) {
      // Zero out ground animations instantly when entering any airborne state
      if (state === LocomotionState.JUMPING || state === LocomotionState.FALLING) {
        this.idleAction?.setEffectiveWeight(0);
        this.currentIdleWeight = 0;
        for (const key of Object.keys(this.walkActions) as DirectionKey[]) {
          this.walkActions[key]?.setEffectiveWeight(0);
          this.currentDirWeights[key] = 0;
        }
      }
      // Reset one-shot clips on entry
      if (state === LocomotionState.JUMPING && this.jumpAction) {
        this.jumpAction.reset().play();
        this.jumpAction.setEffectiveWeight(1);
      }
      if (state === LocomotionState.FALLING && this.fallAction) {
        this.fallAction.reset().play();
        this.fallAction.setEffectiveWeight(1);
        // Zero out jump clip
        this.jumpAction?.setEffectiveWeight(0);
      }
      if (state === LocomotionState.LANDING && this.landAction) {
        this.landAction.reset().play();
        this.landAction.setEffectiveWeight(1);
        this.fallAction?.setEffectiveWeight(0);
      }
      this.currentActiveState = state;
    }
  }

  private applyLegacyWeights(blendFactor: number): void {
    this.currentIdleWeight +=
      (this.targetIdleWeight - this.currentIdleWeight) * blendFactor;
    this.idleAction?.setEffectiveWeight(this.currentIdleWeight);

    for (const key of Object.keys(this.walkActions) as DirectionKey[]) {
      const target = this.targetDirWeights[key];
      const current = this.currentDirWeights[key];
      const newWeight = current + (target - current) * blendFactor;
      this.currentDirWeights[key] = newWeight;
      this.walkActions[key]?.setEffectiveWeight(newWeight);
    }
  }

  private blendAction(
    action: AnimationAction | null,
    targetWeight: number,
    blendFactor: number
  ): void {
    if (!action) return;
    const current = action.getEffectiveWeight();
    action.setEffectiveWeight(current + (targetWeight - current) * blendFactor);
  }
}
