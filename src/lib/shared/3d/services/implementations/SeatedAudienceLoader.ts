/**
 * SeatedAudienceLoader
 *
 * Pre-bakes every asset needed by the seated audience before the scene
 * is visible:
 *   - GLB avatar models (cached, then cloned per seat via SkeletonUtils)
 *   - FBX sitting-idle clips (cached raw)
 *   - Remapped AnimationClips keyed by (modelUrl, animationUrl) so the
 *     per-seat mixer setup does zero work at mount time
 *
 * Remapping is a prefix swap (e.g. "mixamorig:" → "mixamorig") rather
 * than SkeletonUtils.retargetClip - both skeletons share the Mixamo
 * layout, they just use different naming conventions. Position tracks
 * are stripped except for a cm→m scaled Hips track that drops the
 * pelvis to seated height.
 */

import {
  AnimationClip,
  Bone,
  BufferGeometry,
  KeyframeTrack,
  Skeleton,
  SkinnedMesh,
  type Object3D,
} from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

function ensureSkinnedMesh(root: Object3D, label: string): SkinnedMesh {
  let existing: SkinnedMesh | null = null;
  root.traverse((child) => {
    if (!existing && (child as { isSkinnedMesh?: boolean }).isSkinnedMesh) {
      existing = child as SkinnedMesh;
    }
  });
  if (existing) return existing;

  const bones: Bone[] = [];
  root.traverse((child) => {
    if ((child as { isBone?: boolean }).isBone) {
      bones.push(child as Bone);
    }
  });
  if (bones.length === 0) {
    throw new Error(`[SeatedAudienceLoader] ${label} has no bones`);
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
 * Detect the bone-name prefix. Mixamo FBX uses "mixamorig:" (colon),
 * Mixamo GLB uses "mixamorig" (no colon). Both have "Hips" at root.
 */
function detectBonePrefix(mesh: SkinnedMesh): string {
  for (const bone of mesh.skeleton.bones) {
    const idx = bone.name.indexOf("Hips");
    if (idx !== -1) return bone.name.slice(0, idx);
  }
  return "";
}

const fbxLoader = new FBXLoader();
const gltfLoader = new GLTFLoader();

function loadFBX(url: string): Promise<Object3D & { animations: AnimationClip[] }> {
  return new Promise((resolve, reject) => {
    fbxLoader.load(
      url,
      (fbx) => resolve(fbx as Object3D & { animations: AnimationClip[] }),
      undefined,
      reject,
    );
  });
}

interface ClipCacheEntry {
  rawClip: AnimationClip;
  sourceMesh: SkinnedMesh;
  sourcePrefix: string;
}

interface ModelCacheEntry {
  scene: Object3D;
  targetPrefix: string;
  targetBoneNames: Set<string>;
}

export interface PreparedFigure {
  scene: Object3D;
  clip: AnimationClip | null;
}

export class SeatedAudienceLoader {
  private clipCache = new Map<string, Promise<ClipCacheEntry>>();
  private modelCache = new Map<string, Promise<ModelCacheEntry>>();
  private remappedClipCache = new Map<string, Promise<AnimationClip | null>>();

  /**
   * Preload everything needed to render the audience: all GLB models,
   * all FBX animations, and every remapped clip for the cartesian
   * product of (model, animation). After this resolves, prepareFigure
   * returns synchronously from cache with no main-thread hitches.
   */
  async preloadAll(
    modelUrls: readonly string[],
    animationUrls: readonly string[],
  ): Promise<void> {
    await Promise.all([
      ...modelUrls.map((u) => this.getModel(u)),
      ...animationUrls.map((u) => this.getClip(u)),
    ]);

    const pairs: Promise<AnimationClip | null>[] = [];
    for (const model of modelUrls) {
      for (const anim of animationUrls) {
        pairs.push(this.getRemappedClip(model, anim));
      }
    }
    await Promise.all(pairs);
  }

  /** Back-compat: preload only animation clips. */
  async preloadAnimations(animationUrls: readonly string[]): Promise<void> {
    await Promise.all(animationUrls.map((url) => this.getClip(url)));
  }

  /**
   * Return a freshly cloned scene + pre-baked clip for a seat. After
   * preloadAll has completed, this resolves in a microtask - the only
   * work is a SkeletonUtils.clone of the cached scene (preserves skeleton
   * binding so each seat animates independently).
   */
  async prepareFigure(
    modelUrl: string,
    animationUrl: string,
  ): Promise<PreparedFigure> {
    const [model, clip] = await Promise.all([
      this.getModel(modelUrl),
      this.getRemappedClip(modelUrl, animationUrl),
    ]);
    const scene = cloneSkinned(model.scene);
    scene.traverse((child: Object3D) => {
      const mesh = child as { isMesh?: boolean; isSkinnedMesh?: boolean; frustumCulled?: boolean };
      if (mesh.isMesh || mesh.isSkinnedMesh) {
        mesh.frustumCulled = false;
      }
    });
    return { scene, clip };
  }

  private getModel(url: string): Promise<ModelCacheEntry> {
    let cached = this.modelCache.get(url);
    if (cached) return cached;
    cached = new Promise<ModelCacheEntry>((resolve, reject) => {
      gltfLoader.load(
        url,
        (gltf) => {
          let mesh: SkinnedMesh | null = null;
          gltf.scene.traverse((child) => {
            if (!mesh && (child as { isSkinnedMesh?: boolean }).isSkinnedMesh) {
              mesh = child as SkinnedMesh;
            }
          });
          if (!mesh) {
            reject(new Error(`[SeatedAudienceLoader] No SkinnedMesh in ${url}`));
            return;
          }
          const targetPrefix = detectBonePrefix(mesh);
          const targetBoneNames = new Set(
            (mesh as SkinnedMesh).skeleton.bones.map((b) => b.name),
          );
          resolve({ scene: gltf.scene, targetPrefix, targetBoneNames });
        },
        undefined,
        reject,
      );
    });
    this.modelCache.set(url, cached);
    return cached;
  }

  private getRemappedClip(
    modelUrl: string,
    animationUrl: string,
  ): Promise<AnimationClip | null> {
    const key = `${modelUrl}|${animationUrl}`;
    let cached = this.remappedClipCache.get(key);
    if (cached) return cached;
    cached = (async () => {
      const [model, clipEntry] = await Promise.all([
        this.getModel(modelUrl),
        this.getClip(animationUrl),
      ]);
      return this.buildRemappedClip(model, clipEntry);
    })();
    this.remappedClipCache.set(key, cached);
    return cached;
  }

  private buildRemappedClip(
    model: ModelCacheEntry,
    clipEntry: ClipCacheEntry,
  ): AnimationClip | null {
    const { targetPrefix, targetBoneNames } = model;
    const sourcePrefix = clipEntry.sourcePrefix;

    const remappedTracks: KeyframeTrack[] = [];

    for (const track of clipEntry.rawClip.tracks) {
      const dotIdx = track.name.lastIndexOf(".");
      if (dotIdx === -1) continue;

      const sourceBoneName = track.name.slice(0, dotIdx);
      const property = track.name.slice(dotIdx);

      const isPosition = property === ".position";
      const isHipsPosition = isPosition && sourceBoneName.includes("Hips");
      if (isPosition && !isHipsPosition) continue;

      let coreName = sourceBoneName;
      if (sourcePrefix && sourceBoneName.startsWith(sourcePrefix)) {
        coreName = sourceBoneName.slice(sourcePrefix.length);
      }

      const targetBoneName = targetPrefix + coreName;
      if (!targetBoneNames.has(targetBoneName)) continue;

      const cloned = track.clone();
      cloned.name = `${targetBoneName}${property}`;

      if (isHipsPosition) {
        const values = cloned.values as Float32Array | number[];
        for (let vi = 0; vi < values.length; vi++) {
          values[vi] = (values[vi] ?? 0) * 0.01;
        }
      }

      remappedTracks.push(cloned);
    }

    if (remappedTracks.length === 0) return null;

    return new AnimationClip(
      clipEntry.rawClip.name || "sitting-idle",
      clipEntry.rawClip.duration,
      remappedTracks,
    );
  }

  private getClip(animationUrl: string): Promise<ClipCacheEntry> {
    let cached = this.clipCache.get(animationUrl);
    if (cached) return cached;
    cached = loadFBX(animationUrl).then((fbx) => {
      const rawClip = fbx.animations[0];
      if (!rawClip) {
        throw new Error(`[SeatedAudienceLoader] No animations in ${animationUrl}`);
      }
      const sourceMesh = ensureSkinnedMesh(fbx, `Animation ${animationUrl}`);
      const sourcePrefix = detectBonePrefix(sourceMesh);
      return { rawClip, sourceMesh, sourcePrefix };
    });
    this.clipCache.set(animationUrl, cached);
    return cached;
  }
}

export const seatedAudienceLoader = new SeatedAudienceLoader();
