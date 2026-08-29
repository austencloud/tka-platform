
import * as THREE from "three";
import {
  Bone,
  Euler,
  Object3D,
  Quaternion,
  SkinnedMesh,
  Skeleton,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RootMotionExtractor } from "@austencloud/scene-3d";
import type { PoseSample } from "./feature-types";
import type { LegChain, RigBinding } from "./rig-binding";

// Module-level scratch to avoid per-call allocation (pattern mirrors
// hinge-constrained-leg-ik-solver.ts).
const _hipsWorld = new Vector3();
const _leftFootWorld = new Vector3();
const _rightFootWorld = new Vector3();
const _leftThighWorld = new Vector3();
const _rightThighWorld = new Vector3();
const _hipsQuat = new Quaternion();
const _euler = new Euler();
const _restA = new Vector3();
const _restB = new Vector3();

// Mixamo bone-name prefixes to try when resolving a canonical name. The
// avatar in this repo (X Bot.glb) uses the colon form ("mixamorig:Hips").
const NAME_PREFIXES = ["", "mixamorig:", "mixamorig"];

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

interface ClipEntry {
  clip: THREE.AnimationClip;
  action: THREE.AnimationAction;
  durationSec: number;
}

/**
 * Self-loaded RigBinding provider. Loads the avatar GLB (SkinnedMesh +
 * skeleton), each clip GLB's animation, and owns a single AnimationMixer used
 * for stateless pose sampling (set time → mixer.update(0) → read world).
 */
export async function createSelfLoadedRigBinding(
  avatarGlbUrl: string,
  clips: { clipId: string; url: string }[]
): Promise<RigBinding> {
  const loader = new GLTFLoader();

  // 1. Load avatar GLB; find the SkinnedMesh + its skeleton.
  const avatarGltf = await loader.loadAsync(avatarGlbUrl);
  const avatarRoot: Object3D = avatarGltf.scene;

  let skeleton: Skeleton | null = null;
  avatarRoot.traverse((obj) => {
    if (!skeleton && (obj as SkinnedMesh).isSkinnedMesh) {
      skeleton = (obj as SkinnedMesh).skeleton;
    }
  });
  if (!skeleton) {
    throw new Error(
      `[self-loaded-rig-binding] No SkinnedMesh/skeleton found in ${avatarGlbUrl}`
    );
  }
  const skel: Skeleton = skeleton;

  // Bone lookup: try the bare name, then mixamorig prefixes.
  const getBone = (name: string): Bone | null => {
    for (const prefix of NAME_PREFIXES) {
      const bone = skel.getBoneByName(prefix + name);
      if (bone) return bone;
    }
    return null;
  };

  const requireBone = (name: string): Bone => {
    const bone = getBone(name);
    if (!bone) {
      throw new Error(
        `[self-loaded-rig-binding] Required bone "${name}" not found in ${avatarGlbUrl}`
      );
    }
    return bone;
  };

  const hipsBone = requireBone("Hips");
  const leftFootBone = requireBone("LeftFoot");
  const rightFootBone = requireBone("RightFoot");
  const leftThighBone = requireBone("LeftUpLeg");
  const rightThighBone = requireBone("RightUpLeg");

  // 2. Load each clip's animation; key by clipId.
  // 3. Single AnimationMixer over the avatar root; cache one action per clip.
  const mixer = new THREE.AnimationMixer(avatarRoot);
  const clipMap = new Map<string, ClipEntry>();

  for (const { clipId, url } of clips) {
    const clipGltf = await loader.loadAsync(url);
    const clip = clipGltf.animations[0];
    if (!clip) {
      throw new Error(
        `[self-loaded-rig-binding] Clip GLB ${url} has no animations`
      );
    }
    const action = mixer.clipAction(clip);
    // Activated lazily in poseAt (play + paused scrub). A non-playing action is
    // never evaluated by the mixer, so .time alone would pose nothing.
    clipMap.set(clipId, { clip, action, durationSec: clip.duration });
  }

  const requireClip = (clipId: string): ClipEntry => {
    const entry = clipMap.get(clipId);
    if (!entry) {
      throw new Error(
        `[self-loaded-rig-binding] Unknown clipId "${clipId}"`
      );
    }
    return entry;
  };

  // 4. Build leg chains at REST POSE (before any clip is applied).
  // REST-DIR convention: child bone's local rest position, normalized.
  // verify on test page (tunable at runtime).
  avatarRoot.updateMatrixWorld(true);

  function buildLegChain(side: "Left" | "Right"): LegChain {
    const upLeg = requireBone(`${side}UpLeg`);
    const leg = requireBone(`${side}Leg`);
    const foot = requireBone(`${side}Foot`);

    upLeg.getWorldPosition(_restA);
    leg.getWorldPosition(_restB);
    const upperLength = _restA.distanceTo(_restB);

    leg.getWorldPosition(_restA);
    foot.getWorldPosition(_restB);
    const lowerLength = _restA.distanceTo(_restB);

    // child local position, normalized = that joint's rest direction.
    const rootRestDir = new Vector3()
      .copy(leg.position)
      .normalize();
    const middleRestDir = new Vector3()
      .copy(foot.position)
      .normalize();

    return {
      root: upLeg,
      middle: leg,
      effector: foot,
      totalLength: upperLength + lowerLength,
      upperLength,
      lowerLength,
      rootRestDir,
      middleRestDir,
    };
  }

  const leftLegChain = buildLegChain("Left");
  const rightLegChain = buildLegChain("Right");

  // 7. RootMotionExtractor — lazily initialized on first delta read.
  let rootMotion: RootMotionExtractor | null = null;

  // --- pose helpers -------------------------------------------------------
  function poseAt(clipId: string, time: number): void {
    const entry = requireClip(clipId);
    // Make the target clip the only active action, paused at the scrub time.
    // A paused action is still evaluated by mixer.update() — its time just does
    // not advance — which is exactly stateless pose sampling. Other actions are
    // disabled + zero-weight so they do not blend into the pose.
    for (const [id, e] of clipMap) {
      if (id === clipId) {
        e.action.enabled = true;
        e.action.play();
        e.action.paused = true;
        e.action.setEffectiveWeight(1);
        e.action.time = clamp(time, 0, e.durationSec);
      } else {
        e.action.enabled = false;
        e.action.setEffectiveWeight(0);
      }
    }
    mixer.update(0);
    avatarRoot.updateMatrixWorld(true);
  }

  return {
    root: avatarRoot,

    getBone,
    getLeftLegChain: () => leftLegChain,
    getRightLegChain: () => rightLegChain,

    clipSpecs: () =>
      Array.from(clipMap.entries()).map(([clipId, entry]) => ({
        clipId,
        durationSec: entry.durationSec,
      })),

    samplePose(clipId: string, time: number): PoseSample {
      poseAt(clipId, time);

      hipsBone.getWorldPosition(_hipsWorld);
      leftFootBone.getWorldPosition(_leftFootWorld);
      rightFootBone.getWorldPosition(_rightFootWorld);
      leftThighBone.getWorldPosition(_leftThighWorld);
      rightThighBone.getWorldPosition(_rightThighWorld);
      hipsBone.getWorldQuaternion(_hipsQuat);

      _euler.setFromQuaternion(_hipsQuat, "YXZ");

      return {
        hips: [_hipsWorld.x, _hipsWorld.y, _hipsWorld.z],
        leftFoot: [
          _leftFootWorld.x - _hipsWorld.x,
          _leftFootWorld.y - _hipsWorld.y,
          _leftFootWorld.z - _hipsWorld.z,
        ],
        rightFoot: [
          _rightFootWorld.x - _hipsWorld.x,
          _rightFootWorld.y - _hipsWorld.y,
          _rightFootWorld.z - _hipsWorld.z,
        ],
        leftThigh: [
          _leftThighWorld.x - _hipsWorld.x,
          _leftThighWorld.y - _hipsWorld.y,
          _leftThighWorld.z - _hipsWorld.z,
        ],
        rightThigh: [
          _rightThighWorld.x - _hipsWorld.x,
          _rightThighWorld.y - _hipsWorld.y,
          _rightThighWorld.z - _hipsWorld.z,
        ],
        facing: _euler.y,
        rootXZ: [_hipsWorld.x, _hipsWorld.z],
      };
    },

    readLivePose(): PoseSample {
      hipsBone.getWorldPosition(_hipsWorld);
      leftFootBone.getWorldPosition(_leftFootWorld);
      rightFootBone.getWorldPosition(_rightFootWorld);
      leftThighBone.getWorldPosition(_leftThighWorld);
      rightThighBone.getWorldPosition(_rightThighWorld);
      hipsBone.getWorldQuaternion(_hipsQuat);
      _euler.setFromQuaternion(_hipsQuat, "YXZ");
      return {
        hips: [_hipsWorld.x, _hipsWorld.y, _hipsWorld.z],
        leftFoot: [
          _leftFootWorld.x - _hipsWorld.x,
          _leftFootWorld.y - _hipsWorld.y,
          _leftFootWorld.z - _hipsWorld.z,
        ],
        rightFoot: [
          _rightFootWorld.x - _hipsWorld.x,
          _rightFootWorld.y - _hipsWorld.y,
          _rightFootWorld.z - _hipsWorld.z,
        ],
        leftThigh: [
          _leftThighWorld.x - _hipsWorld.x,
          _leftThighWorld.y - _hipsWorld.y,
          _leftThighWorld.z - _hipsWorld.z,
        ],
        rightThigh: [
          _rightThighWorld.x - _hipsWorld.x,
          _rightThighWorld.y - _hipsWorld.y,
          _rightThighWorld.z - _hipsWorld.z,
        ],
        facing: _euler.y,
        rootXZ: [_hipsWorld.x, _hipsWorld.z],
      };
    },

    applyClip(clipId: string, time: number): void {
      poseAt(clipId, time);
    },

    rootMotionDelta(): { x: number; forward: number; yawDelta: number } {
      if (!rootMotion) {
        rootMotion = new RootMotionExtractor();
        rootMotion.initialize(hipsBone);
      }
      return rootMotion.extract();
    },

    resetRootMotion(): void {
      if (rootMotion) rootMotion.reset();
    },
  };
}
