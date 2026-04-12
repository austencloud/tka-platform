/**
 * SeatedAudienceLoader
 *
 * Loads Mixamo avatar GLBs and sitting-idle FBX clips, then produces
 * independent animated clones that mix-and-match characters with
 * animations. Each clone is a fully skinned mesh with its own
 * AnimationMixer so the audience fidgets out of sync instead of
 * moving in perfect lockstep.
 *
 * Caches:
 *   - One template scene per avatar GLB URL
 *   - One raw AnimationClip per FBX URL
 *   - Retargeted clips are built on demand for each (animation, avatar)
 *     combination — bone names can differ per avatar (mixamorig: vs
 *     mixamorig) even though they all share the Mixamo skeleton layout
 *
 * Retargeting strategy:
 *   We use three.js's SkeletonUtils.retargetClip, which samples the
 *   source pose in world space each frame and rebuilds the clip in
 *   the target's local-bone space. This is the canonical three.js
 *   solution and handles the things we used to hand-roll wrong:
 *
 *     - FBXLoader parents the source skeleton under an armature group
 *       with a cm→m scale and an axis correction. retargetClip reads
 *       through bone.matrixWorld so it sees the corrected pose and
 *       produces metric, Y-up local transforms directly. No manual
 *       × 0.01 scaling, no manual axis flip, no discarded Hips
 *       quaternion track.
 *
 *     - Differing bone-name prefixes (FBX "mixamorig:Hips" vs GLB
 *       "mixamorigHips") are bridged via an explicit target→source
 *       names map. We build this map per (avatar, animation) combo
 *       and pass it to retargetClip.
 */

import {
  AnimationClip,
  AnimationMixer,
  Bone,
  BufferGeometry,
  LoopRepeat,
  Skeleton,
  SkinnedMesh,
  type Object3D,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import {
  clone as skeletonClone,
  retargetClip,
} from "three/examples/jsm/utils/SkeletonUtils.js";

export interface SeatedAudienceClone {
  /** Cloned scene graph — add to the Threlte tree via `<T is={root} />`. */
  root: Object3D;
  /** Mixer driving this clone's sitting animation. Caller updates per frame. */
  mixer: AnimationMixer;
}

/**
 * Find the first SkinnedMesh inside a scene subtree. retargetClip
 * needs a SkinnedMesh (for `.skeleton`), not the Object3D scene root
 * returned by GLTFLoader / FBXLoader.
 */
function findSkinnedMesh(root: Object3D): SkinnedMesh | null {
  let found: SkinnedMesh | null = null;
  root.traverse((child) => {
    if (found) return;
    if ((child as { isSkinnedMesh?: boolean }).isSkinnedMesh) {
      found = child as SkinnedMesh;
    }
  });
  return found;
}

/**
 * Return a SkinnedMesh carrying the skeleton for this FBX / GLB
 * hierarchy. If the asset already has a SkinnedMesh (e.g. a Mixamo
 * "With Skin" export), return it directly.
 *
 * For "Without Skin" animation FBX files the hierarchy contains
 * only bones, no SkinnedMesh. SkeletonUtils.retargetClip still needs
 * a `.skeleton` property on source, so we synthesize a dummy
 * SkinnedMesh: collect every Bone in the subtree, wrap them in a
 * fresh Skeleton, attach an empty-geometry SkinnedMesh, and parent
 * it back under the root so `source.updateMatrixWorld()` still
 * propagates down through the bones during sampling. The dummy is
 * invisible and renders nothing.
 */
function ensureSkinnedMesh(root: Object3D, label: string): SkinnedMesh {
  const existing = findSkinnedMesh(root);
  if (existing) return existing;

  const bones: Bone[] = [];
  root.traverse((child) => {
    if ((child as { isBone?: boolean }).isBone) {
      bones.push(child as Bone);
    }
  });
  if (bones.length === 0) {
    throw new Error(
      `[SeatedAudienceLoader] ${label} has no bones to build a skeleton from`
    );
  }

  const skeleton = new Skeleton(bones);
  const dummy = new SkinnedMesh(new BufferGeometry());
  dummy.name = "__seated-audience-dummy-skin";
  dummy.visible = false;
  dummy.bind(skeleton);
  root.add(dummy);
  return dummy;
}

/**
 * Detect the bone-name prefix for a skeleton. Mixamo FBX exports use
 * "mixamorig:" (with colon); Mixamo GLB exports converted via fbx2gltf
 * use "mixamorig" (no colon, colons are illegal in GLB names). Both
 * have a "Hips" bone at the root of the chain, so we find that bone
 * and slice off everything before "Hips".
 */
function detectBonePrefix(mesh: SkinnedMesh): string {
  for (const bone of mesh.skeleton.bones) {
    const idx = bone.name.indexOf("Hips");
    if (idx !== -1) return bone.name.slice(0, idx);
  }
  return "";
}

/**
 * Build the `names` map that SkeletonUtils.retargetClip uses to
 * translate target bone names into source bone names. We walk every
 * bone in the target skeleton, strip its prefix to get the core name
 * ("Hips", "Spine", "LeftArm", …), then rebuild the expected source
 * name by prepending the source prefix. Bones that exist in the
 * target but not the source are skipped so retargetClip can leave
 * them at bind pose.
 */
function buildRetargetNamesMap(
  target: SkinnedMesh,
  source: SkinnedMesh
): Record<string, string> {
  const targetPrefix = detectBonePrefix(target);
  const sourcePrefix = detectBonePrefix(source);
  const sourceNames = new Set(source.skeleton.bones.map((b) => b.name));

  const map: Record<string, string> = {};
  for (const bone of target.skeleton.bones) {
    const coreName = targetPrefix
      ? bone.name.slice(targetPrefix.length)
      : bone.name;
    const sourceName = sourcePrefix + coreName;
    if (sourceNames.has(sourceName)) {
      map[bone.name] = sourceName;
    }
  }
  return map;
}

function loadGLTF(url: string): Promise<{ scene: Object3D }> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => resolve({ scene: gltf.scene }), undefined, reject);
  });
}

function loadFBX(url: string): Promise<Object3D & { animations: AnimationClip[] }> {
  const loader = new FBXLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (fbx) => resolve(fbx as Object3D & { animations: AnimationClip[] }),
      undefined,
      reject
    );
  });
}

/**
 * Cache entry for one loaded FBX animation. We hang onto the raw clip
 * plus a reference to the source SkinnedMesh so SkeletonUtils can
 * sample the source pose per frame during retargeting.
 */
interface ClipCacheEntry {
  rawClip: AnimationClip;
  sourceRoot: Object3D;
  sourceMesh: SkinnedMesh;
}

/**
 * Cache entry for one loaded avatar GLB. Also stores the retargeted
 * clip *per animation URL* so we only re-run retargetClip once per
 * (avatar, animation) combination.
 */
interface AvatarCacheEntry {
  templateScene: Object3D;
  templateMesh: SkinnedMesh;
  retargetedClips: Map<string, AnimationClip>;
}

export class SeatedAudienceLoader {
  private avatarCache = new Map<string, Promise<AvatarCacheEntry>>();
  private clipCache = new Map<string, Promise<ClipCacheEntry>>();

  /**
   * Prefetch the given avatar GLBs and animation FBXs in parallel so
   * callers can await a single promise before asking for clones.
   */
  async preload(
    modelUrls: readonly string[],
    animationUrls: readonly string[]
  ): Promise<void> {
    await Promise.all([
      ...modelUrls.map((url) => this.getAvatar(url)),
      ...animationUrls.map((url) => this.getClip(url)),
    ]);
  }

  /**
   * Create an independent animated clone of `modelUrl` playing the
   * retargeted `animationUrl` clip. Awaits both the avatar and
   * animation caches so callers do not need to preload first.
   *
   * Caller owns the returned objects and must add `root` to the scene
   * graph and call `mixer.update(delta)` each frame.
   *
   * @param timeOffset Seconds to pre-advance the mixer so multiple
   *                   clones are not in perfect lockstep.
   */
  async createClone(
    modelUrl: string,
    animationUrl: string,
    timeOffset: number = 0
  ): Promise<SeatedAudienceClone | null> {
    const [avatarEntry, clipEntry] = await Promise.all([
      this.getAvatar(modelUrl),
      this.getClip(animationUrl),
    ]);
    return this.buildClone(avatarEntry, clipEntry, timeOffset);
  }

  private buildClone(
    avatarEntry: AvatarCacheEntry,
    clipEntry: ClipCacheEntry,
    timeOffset: number
  ): SeatedAudienceClone {
    const cacheKey = clipEntry.rawClip.uuid;
    let retargeted = avatarEntry.retargetedClips.get(cacheKey);
    if (!retargeted) {
      // Retarget once per (avatar, animation) pair, using a fresh
      // clone of the template as the sample target. retargetClip
      // mutates the target skeleton while sampling, so we can't use
      // the cached template directly — that would leave the template
      // stuck at the last-sampled pose and break future clones.
      const sampleTargetRoot = skeletonClone(avatarEntry.templateScene);
      const sampleTargetMesh = findSkinnedMesh(sampleTargetRoot);
      if (!sampleTargetMesh) {
        throw new Error(
          "[SeatedAudienceLoader] Sample target has no SkinnedMesh"
        );
      }

      const namesMap = buildRetargetNamesMap(
        sampleTargetMesh,
        clipEntry.sourceMesh
      );

      // `hip` is the SOURCE hip bone name. retargetClip also stores
      // a position track for that bone so the pelvis drops from
      // standing to seated height as the clip plays.
      const sourcePrefix = detectBonePrefix(clipEntry.sourceMesh);
      const sourceHipName = `${sourcePrefix}Hips`;

      retargeted = retargetClip(
        sampleTargetMesh,
        clipEntry.sourceMesh,
        clipEntry.rawClip,
        {
          fps: 30,
          names: namesMap,
          hip: sourceHipName,
        } as Record<string, unknown>
      );
      retargeted.name = clipEntry.rawClip.name || "sitting-idle";
      avatarEntry.retargetedClips.set(cacheKey, retargeted);
    }

    const root = skeletonClone(avatarEntry.templateScene);

    // Root the mixer on the SkinnedMesh inside the cloned scene, not
    // on the Group scene root. retargetClip emits `.bones[name].quat`
    // track paths, and PropertyBinding only resolves those against
    // nodes that expose a `.skeleton` — Groups don't.
    const rootMesh = findSkinnedMesh(root);
    if (!rootMesh) {
      throw new Error(
        "[SeatedAudienceLoader] Cloned avatar has no SkinnedMesh"
      );
    }

    const mixer = new AnimationMixer(rootMesh);
    const action = mixer.clipAction(retargeted);
    action.setLoop(LoopRepeat, Infinity);
    action.play();
    if (timeOffset > 0) mixer.update(timeOffset);
    return { root, mixer };
  }

  private getAvatar(modelUrl: string): Promise<AvatarCacheEntry> {
    let cached = this.avatarCache.get(modelUrl);
    if (cached) return cached;
    cached = loadGLTF(modelUrl).then((gltf) => {
      const mesh = findSkinnedMesh(gltf.scene);
      if (!mesh) {
        throw new Error(
          `[SeatedAudienceLoader] Avatar ${modelUrl} has no SkinnedMesh`
        );
      }
      return {
        templateScene: gltf.scene,
        templateMesh: mesh,
        retargetedClips: new Map<string, AnimationClip>(),
      };
    });
    this.avatarCache.set(modelUrl, cached);
    return cached;
  }

  private getClip(animationUrl: string): Promise<ClipCacheEntry> {
    let cached = this.clipCache.get(animationUrl);
    if (cached) return cached;
    cached = loadFBX(animationUrl).then((fbx) => {
      const rawClip = fbx.animations[0];
      if (!rawClip) {
        throw new Error(`[SeatedAudienceLoader] No animations in ${animationUrl}`);
      }
      // Mixamo "Without Skin" FBX exports contain bones but no
      // SkinnedMesh. ensureSkinnedMesh synthesizes a dummy one
      // carrying the existing bones so retargetClip can sample
      // `source.skeleton.bones` during playback.
      const sourceMesh = ensureSkinnedMesh(fbx, `Animation ${animationUrl}`);
      return {
        rawClip,
        sourceRoot: fbx,
        sourceMesh,
      };
    });
    this.clipCache.set(animationUrl, cached);
    return cached;
  }
}

/**
 * Module-level singleton so multiple SeatedAudience3D instances share
 * the same caches — switching tabs doesn't re-fetch GLBs or FBXs.
 */
export const seatedAudienceLoader = new SeatedAudienceLoader();
