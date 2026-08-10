<script lang="ts">
  import { useTask } from "@threlte/core";
  import { MeshStandardMaterial, type Mesh, type Object3D } from "three";
  import {
    prefersReducedMotion,
    resolveMotionScale,
  } from "../../../../primitives/motion-preference";
  import { sampleAutumnLanternFlicker } from "./autumn-lantern-flicker";

  interface Props {
    scene: Object3D | null;
  }

  let { scene }: Props = $props();

  const activeMaterials = new Map<MeshStandardMaterial, number>();

  $effect(() => {
    const loadedScene = scene;
    activeMaterials.clear();
    if (!loadedScene) return;

    loadedScene.traverse((child) => {
      if (!child.name.startsWith("Autumn_Wayfinding_Lantern_Glow")) return;
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        if (material instanceof MeshStandardMaterial) {
          activeMaterials.set(material, material.emissiveIntensity);
        }
      }
    });

    return () => {
      for (const [material, baseIntensity] of activeMaterials) {
        material.emissiveIntensity = baseIntensity;
      }
      activeMaterials.clear();
    };
  });

  const reducedMotion = $derived(prefersReducedMotion());
  const motionScale = $derived(resolveMotionScale(reducedMotion));
  let localTime = 0;

  useTask((delta) => {
    localTime += delta * motionScale;
    const flicker = reducedMotion ? 1 : sampleAutumnLanternFlicker(localTime);
    for (const [material, baseIntensity] of activeMaterials) {
      material.emissiveIntensity = baseIntensity * flicker;
    }
  });
</script>
