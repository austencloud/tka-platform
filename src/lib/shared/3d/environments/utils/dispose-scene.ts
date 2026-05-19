import type { Object3D, Material, BufferGeometry } from "three";

interface DisposableMesh {
  geometry?: BufferGeometry;
  material?: Material | Material[];
}

export function disposeSceneGraph(root: Object3D): void {
  root.traverse((child) => {
    const mesh = child as unknown as DisposableMesh;
    mesh.geometry?.dispose();
    if (mesh.material) {
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const m of mats) m.dispose();
    }
  });
}
