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

import type { AnimationAction, Object3D } from "three";
import { AnimationMixer, AnimationClip, LoopRepeat, LoopOnce } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type {
  ILocomotionAnimator,
  LocomotionInput,
  AnimationUrls,
  LocomotionConfig,
} from "../contracts/ILocomotionAnimator";
import { LocomotionState } from "../contracts/IAnimationStateMachine";

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
 * - All .quaternion tracks (bone rotations — the core of animation)
 * - Hips .position track (lateral weight-shift that prevents torso tilt)
 *
 * FILTER OUT:
 * - .position tracks on non-Hips bones (cause root motion displacement)
 * - .scale tracks on any bone (can make meshes disappear)
 *
 * This matches the Three.js example's effective behavior — in that example
 * the Soldier.glb only contains quaternion + Hips position tracks, so no
 * filtering is needed. Mixamo separate exports include extra tracks we must skip.
 */
function remapClipToSkeleton(
  clip: AnimationClip,
  modelPrefix: string
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

      // Skip Hips quaternion — Mixamo separate exports bake the character's
      // base orientation into this track, which lays the avatar flat on its back.
      // The locomotion system controls facing via group rotation instead.
      if (coreName === "Hips" && property === "quaternion") return false;

      // Keep all other quaternion tracks — bone rotations are the animation.
      // Filter out position/scale tracks (position teleports, scale vanishes).
      if (property === "quaternion") return true;

      return false;
    })
    .map((track) => {
      // Remap bone prefix if needed
      if (clipPrefix === modelPrefix) return track;

      const dotIdx = track.name.indexOf(".");
      const boneName = track.name.slice(0, dotIdx);
      const property = track.name.slice(dotIdx);
      const coreName = clipPrefix ? boneName.slice(clipPrefix.length) : boneName;

      const cloned = track.clone();
      cloned.name = `${modelPrefix}${coreName}${property}`;
      return cloned;
    });

  return new AnimationClip(clip.name, clip.duration, tracks);
}

export class LocomotionAnimator implements ILocomotionAnimator {
  private mixer: AnimationMixer | null = null;
  private root: Object3D | null = null;
  private loader = new GLTFLoader();
  private modelPrefix = "mixamorig";

  // Actions — created from raw clips, no processing
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
   * Remap a pending clip's track names to match this model's bone prefix,
   * then return the remapped clip. This is the ONLY processing we do.
   */
  private prepareClip(key: string): AnimationClip | null {
    const raw = this.pendingClips.get(key);
    if (!raw) return null;
    return remapClipToSkeleton(raw, this.modelPrefix);
  }

  /**
   * Create actions from clips — only bone prefix remapping, no track filtering.
   * Play all simultaneously, control blending purely through weights.
   * This is how the canonical Three.js skinning-blending example works.
   */
  private createActions(): void {
    if (!this.mixer) return;


    // Idle — starts at weight 1
    const idleClip = this.prepareClip("idle");
    if (idleClip && !this.idleAction) {
      this.idleAction = this.mixer.clipAction(idleClip);
      this.idleAction.setLoop(LoopRepeat, Infinity);
      this.setWeight(this.idleAction, 1);
      this.idleAction.play();
    }

    // Walk directions — start at weight 0
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
   * Set weight on an action — same helper as the Three.js example.
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
    // pose. The physics still moves diagonally — only the animation is pure
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
    const timeScale =
      this.config.baseSpeed *
      Math.max(0.3, speed / this.config.animationWalkSpeed);
    for (const key of Object.keys(this.walkActions) as DirectionKey[]) {
      this.walkActions[key]?.setEffectiveTimeScale(timeScale);
    }
  }

  private applyStateWeights(blendFactor: number): void {
    const state = this.activeState!;

    // The Mixamo jump clip is a full-arc animation (crouch → push → air → land).
    // Keep it playing through JUMPING, FALLING, and LANDING states instead of
    // switching to separate fall/land clips that don't match.
    const isAirborne =
      state === LocomotionState.JUMPING ||
      state === LocomotionState.FALLING ||
      state === LocomotionState.LANDING;

    const wantIdle = state === LocomotionState.IDLE ? 1 : 0;
    const wantWalk = state === LocomotionState.WALKING ? 1 : 0;
    const wantCrouch = state === LocomotionState.CROUCHING ? 1 : 0;
    const wantJump = isAirborne ? 1 : 0;

    // Idle
    this.currentIdleWeight += (wantIdle - this.currentIdleWeight) * blendFactor;
    this.idleAction?.setEffectiveWeight(this.currentIdleWeight);

    // Walk directions (scaled by wantWalk)
    for (const key of Object.keys(this.walkActions) as DirectionKey[]) {
      const dirTarget = this.targetDirWeights[key] * wantWalk;
      const current = this.currentDirWeights[key];
      const newWeight = current + (dirTarget - current) * blendFactor;
      this.currentDirWeights[key] = newWeight;
      this.walkActions[key]?.setEffectiveWeight(newWeight);
    }

    // Other states
    this.blendAction(this.crouchAction, wantCrouch, blendFactor);
    this.blendAction(this.jumpAction, wantJump, blendFactor);
    // Fall/land clips unused — the full jump animation covers the entire arc
    this.blendAction(this.fallAction, 0, blendFactor);
    this.blendAction(this.landAction, 0, blendFactor);

    // On state entry: snap weights instantly for jump.
    // The camera moves on the same frame as the input, so the animation must too.
    if (state !== this.currentActiveState) {
      if (state === LocomotionState.JUMPING && this.jumpAction) {
        this.jumpAction.reset().play();
        this.jumpAction.setEffectiveWeight(1);
        // Zero out everything else instantly
        this.idleAction?.setEffectiveWeight(0);
        this.currentIdleWeight = 0;
        for (const key of Object.keys(this.walkActions) as DirectionKey[]) {
          this.walkActions[key]?.setEffectiveWeight(0);
          this.currentDirWeights[key] = 0;
        }
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
