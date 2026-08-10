<script lang="ts">
  import type { Mesh, MeshStandardMaterial, Object3D } from "three";
  import {
    patchAutumnDepthCohesionMaterial,
    type AutumnDepthCohesionPatch,
  } from "./autumn-depth-cohesion";

  interface Props {
    scene?: Object3D | null;
  }

  let { scene = null }: Props = $props();

  $effect(() => {
    const loadedScene = scene;
    if (!loadedScene) return;

    const patches = new Set<AutumnDepthCohesionPatch>();
    loadedScene.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const candidate of materials) {
        const material = candidate as MeshStandardMaterial;
        if (!material.isMeshStandardMaterial) continue;
        const patch = patchAutumnDepthCohesionMaterial(material);
        if (patch) patches.add(patch);
      }
    });

    return () => {
      for (const patch of patches) patch.dispose();
    };
  });
</script>

