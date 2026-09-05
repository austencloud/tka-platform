import {
  Material,
  ShaderMaterial,
  Texture,
  type BufferGeometry,
  type Object3D,
} from "three";

function disposeTexture(value: unknown, disposed: Set<Texture>): void {
  if (!(value instanceof Texture) || disposed.has(value)) return;
  disposed.add(value);
  value.dispose();
}

/** Dispose one independently-loaded Celestial graph exactly once per resource. */
export function disposeCelestialObjectTree(root: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();

  root.traverse((object) => {
    const renderable = object as Object3D & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
    };
    if (renderable.geometry && !geometries.has(renderable.geometry)) {
      geometries.add(renderable.geometry);
      renderable.geometry.dispose();
    }
    const values = Array.isArray(renderable.material)
      ? renderable.material
      : renderable.material
        ? [renderable.material]
        : [];
    for (const material of values) {
      if (materials.has(material)) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        disposeTexture(value, textures);
      }
      if (material instanceof ShaderMaterial) {
        for (const uniform of Object.values(material.uniforms)) {
          const value = uniform?.value;
          if (Array.isArray(value)) {
            for (const item of value) disposeTexture(item, textures);
          } else {
            disposeTexture(value, textures);
          }
        }
      }
      material.dispose();
    }
  });
  root.clear();
}
