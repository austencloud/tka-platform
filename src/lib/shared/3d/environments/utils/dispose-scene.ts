import type { Object3D, Material, BufferGeometry, Texture } from "three";

interface DisposableMesh {
  geometry?: BufferGeometry;
  material?: Material | Material[];
}

function disposeMaterialTextures(mat: Material): void {
  const m = mat as unknown as Record<string, unknown>;
  const textureKeys = ['map', 'normalMap', 'roughnessMap', 'aoMap', 'emissiveMap', 'metalnessMap', 'envMap', 'lightMap', 'bumpMap', 'displacementMap', 'alphaMap'];
  for (const key of textureKeys) {
    const tex = m[key] as Texture | undefined;
    if (tex && typeof tex.dispose === 'function') {
      tex.dispose();
    }
  }
}

export function disposeSceneGraph(root: Object3D): void {
  root.traverse((child) => {
    const mesh = child as unknown as DisposableMesh;
    mesh.geometry?.dispose();
    if (mesh.material) {
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const m of mats) {
        disposeMaterialTextures(m);
        m.dispose();
      }
    }
  });
}
