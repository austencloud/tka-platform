/**
 * Runtime recoloring for loaded GLTF prop models.
 *
 * Traverses a cloned GLTF scene graph and tints all MeshStandardMaterials
 * to the target prop color (blue/red) while preserving PBR properties
 * like roughness, metalness, normal maps, and texture detail.
 */

import { Color, type Object3D, type Mesh, MeshStandardMaterial } from "three";
import { PROP_COLORS } from "./Prop3DProps";

/**
 * Recolor a cloned GLTF scene to match a prop color (blue or red).
 *
 * Strategy: multiply the original material color by the target hue.
 * This preserves relative brightness/darkness across different parts
 * of the model (handle vs body vs accents) while shifting everything
 * toward the target color family.
 */
export function recolorPropModel(
  scene: Object3D,
  propColor: "blue" | "red"
): void {
  const target = new Color(PROP_COLORS[propColor].main);

  scene.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;

    // Handle both single material and material arrays
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    for (const mat of materials) {
      if (!(mat instanceof MeshStandardMaterial)) continue;

      // Clone the material so we don't mutate the cached original
      const cloned = mat.clone();

      // Get the original luminance to preserve relative brightness
      const origHSL = { h: 0, s: 0, l: 0 };
      cloned.color.getHSL(origHSL);

      // If the original is very dark (shadow/accent) or very light (highlight),
      // preserve more of the original character. Otherwise shift toward target.
      if (origHSL.l < 0.15 || origHSL.l > 0.85) {
        // Near-black or near-white: just tint slightly
        cloned.color.lerp(target, 0.2);
      } else {
        // Normal surfaces: shift hue strongly, keep original lightness
        const targetHSL = { h: 0, s: 0, l: 0 };
        target.getHSL(targetHSL);
        cloned.color.setHSL(targetHSL.h, targetHSL.s * 0.8, origHSL.l);
      }

      mesh.material = cloned;
    }
  });
}
