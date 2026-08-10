<script lang="ts">
  import { useTask } from "@threlte/core";
  import {
    MeshStandardMaterial,
    Vector2,
    type Mesh,
    type Object3D,
  } from "three";
  import {
    prefersReducedMotion,
    resolveMotionScale,
  } from "../../primitives/motion-preference";
  import {
    expandBoundsForRootedWind,
    patchRootedWindMaterial,
    type RootedWindUniforms,
  } from "../../primitives/rooted-wind-material";

  interface Props {
    scene: Object3D | null;
  }

  let { scene }: Props = $props();

  const windDirection = new Vector2(0.72, -0.69).normalize();
  const activeUniforms = new Set<RootedWindUniforms>();
  const strength = 0.105;

  $effect(() => {
    const loadedScene = scene;
    if (!loadedScene) return;

    activeUniforms.clear();
    loadedScene.traverse((child) => {
      if (!child.name.startsWith("Forest_Grass_")) return;
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;

      mesh.castShadow = false;
      mesh.receiveShadow = true;
      expandBoundsForRootedWind(mesh, 0.22, "forestWindBoundsExpanded");
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        activeUniforms.add(
          patchRootedWindMaterial(material, {
            direction: windDirection,
            strength,
            cacheKey: "forest-rooted-wind-v1",
            storageKey: "forestWindUniforms",
          })
        );
      }
    });
  });

  const reducedMotion = $derived(prefersReducedMotion());
  const motionScale = $derived(resolveMotionScale(reducedMotion));

  useTask((delta) => {
    for (const uniforms of activeUniforms) {
      uniforms.strength.value = strength * motionScale;
      uniforms.time.value += delta * motionScale;
    }
  });
</script>
