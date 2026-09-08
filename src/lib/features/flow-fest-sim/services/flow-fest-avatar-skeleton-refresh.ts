import type { Object3D, SkinnedMesh } from "three";

/**
 * Pushes a freshly posed hierarchy into every skeleton's GPU bone matrices.
 *
 * The scene package refreshes each skeleton itself while it applies its own
 * animation and IK, and three.js refreshes a skeleton at most once per render
 * frame. The main pass projects objects *before* the frame counter advances, so
 * on any frame where no later pass (the shadow pass) touches the mesh, the
 * renderer trusts the package's refresh — which predates any pose written
 * after it. A stage that moves bones after the package must refresh again, or
 * the skinned vertices render at the pre-pose bone transforms on those frames.
 * On the EUC that showed as the pelvis flashing out every other frame.
 */
export function refreshSkinnedSkeletons(root: Object3D): number {
  root.updateMatrixWorld(true);
  let refreshed = 0;
  root.traverse((node) => {
    const mesh = node as SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    mesh.skeleton.update();
    refreshed += 1;
  });
  return refreshed;
}
