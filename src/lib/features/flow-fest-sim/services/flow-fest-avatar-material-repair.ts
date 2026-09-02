import type { Material, Mesh, Object3D } from "three";

/**
 * Repairs skinned-avatar materials left in the scene package's fade render
 * state after the fade has finished.
 *
 * `Avatar3D` fades a model by setting `transparent = true` and
 * `depthWrite = false`, then restores an "authored" snapshot it captured the
 * first time it saw each material. When a second instance of the same
 * character clones its materials from a source that was captured mid-fade,
 * that snapshot records the fade state as authored and the model never
 * returns to opaque: the pelvis and thighs sort behind the shirt and vanish.
 *
 * The signature is unambiguous. `GLTFLoader` marks `alphaMode: "BLEND"`
 * materials `transparent` but never clears `depthWrite`, so a fully opaque
 * material that is both transparent and non-depth-writing can only be a fade
 * leftover. Materials that are still fading (opacity below 1) and materials
 * hidden at opacity 0 (hair and eyelash cards) are left alone.
 */
export function isFadeLeftoverMaterial(material: Material): boolean {
  return material.opacity >= 1 && material.transparent && !material.depthWrite;
}

/** Restores every fade-leftover material under `root`; returns the count. */
export function repairFadeLeftoverMaterials(root: Object3D): number {
  let repaired = 0;
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) {
      if (!material || !isFadeLeftoverMaterial(material)) continue;
      material.transparent = false;
      material.depthWrite = true;
      material.needsUpdate = true;
      repaired += 1;
    }
  });
  return repaired;
}

const PERFORMER_ROOT_PREFIX = "PERFORMER_";

/**
 * Sweeps every avatar root in `scene`. Called on a slow cadence by the sim,
 * because the package re-runs its fade whenever an avatar's opacity or model
 * changes, which can reintroduce the leftover long after mount.
 */
export function sweepFlowFestAvatarMaterials(scene: Object3D): number {
  let repaired = 0;
  scene.traverse((node) => {
    if (!node.name.startsWith(PERFORMER_ROOT_PREFIX)) return;
    repaired += repairFadeLeftoverMaterials(node);
  });
  return repaired;
}
