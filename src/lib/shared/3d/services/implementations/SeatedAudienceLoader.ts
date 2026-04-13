/**
 * SeatedAudienceLoader
 *
 * Loads sitting-idle FBX clips and remaps their bone-name tracks
 * to match target avatar skeletons. Uses simple string renaming
 * instead of SkeletonUtils.retargetClip (which corrupts the
 * target skeleton when used with Threlte's useGltf-loaded meshes).
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

function loadFBX(url: string): Promise<Object3D & { animations: AnimationClip[] }> {
  return new Promise((resolve, reject) => {
    fbxLoader.load(
      url,
      (fbx) => resolve(fbx as Object3D & { animations: AnimationClip[] }),
      undefined,
      reject
    );
  });
}

interface ClipCacheEntry {
  rawClip: AnimationClip;
  sourceMesh: SkinnedMesh;
  sourcePrefix: string;
}

export class SeatedAudienceLoader {
  private clipCache = new Map<string, Promise<ClipCacheEntry>>();

  async preloadAnimations(animationUrls: readonly string[]): Promise<void> {
    await Promise.all(animationUrls.map((url) => this.getClip(url)));
  }

  /**
   * Remap an FBX sitting animation's tracks to use the target avatar's
   * bone names. This is a simple prefix swap (e.g. "mixamorig:" → "mixamorig")
   * rather than a full retarget — both skeletons share the Mixamo layout,
   * they just use different naming conventions.
   *
   * Position tracks are stripped because the FBX hips position is in
   * centimeter space and would fling the figure off-screen.
   */
  async remapAnimation(
    targetMesh: SkinnedMesh,
    animationUrl: string
  ): Promise<AnimationClip | null> {
    const clipEntry = await this.getClip(animationUrl);

    const targetPrefix = detectBonePrefix(targetMesh);
    const sourcePrefix = clipEntry.sourcePrefix;

    // Build a set of target bone names for validation
    const targetBoneNames = new Set(
      targetMesh.skeleton.bones.map((b) => b.name)
    );

    const remappedTracks: KeyframeTrack[] = [];

    for (const track of clipEntry.rawClip.tracks) {
      // Parse the track name: "boneName.property"
      const dotIdx = track.name.lastIndexOf(".");
      if (dotIdx === -1) continue;

      const sourceBoneName = track.name.slice(0, dotIdx);
      const property = track.name.slice(dotIdx); // ".quaternion", ".scale", etc.

      // Only keep the Hips position track (drops pelvis to seated height).
      // All other position tracks are skipped.
      const isPosition = property === ".position";
      const isHipsPosition = isPosition && sourceBoneName.includes("Hips");
      if (isPosition && !isHipsPosition) continue;

      // Strip source prefix to get core name (e.g. "Hips", "Spine", "LeftArm")
      let coreName = sourceBoneName;
      if (sourcePrefix && sourceBoneName.startsWith(sourcePrefix)) {
        coreName = sourceBoneName.slice(sourcePrefix.length);
      }

      // Rebuild with target prefix
      const targetBoneName = targetPrefix + coreName;

      // Only include tracks for bones that exist in the target
      if (!targetBoneNames.has(targetBoneName)) continue;

      // AnimationMixer resolves track names by searching the scene graph
      // for nodes with matching names. Just use "boneName.property".
      const newName = `${targetBoneName}${property}`;

      // Clone the track with the new name
      const cloned = track.clone();
      cloned.name = newName;

      // Scale hips position from cm (FBX) to meters (GLB)
      if (isHipsPosition) {
        for (let vi = 0; vi < cloned.values.length; vi++) {
          cloned.values[vi] *= 0.01;
        }
      }

      remappedTracks.push(cloned);
    }

    if (remappedTracks.length === 0) return null;

    const clip = new AnimationClip(
      clipEntry.rawClip.name || "sitting-idle",
      clipEntry.rawClip.duration,
      remappedTracks
    );
    return clip;
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
