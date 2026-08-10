<script lang="ts">
  import { useTask } from "@threlte/core";
  import {
    MeshStandardMaterial,
    Vector2,
    type Mesh,
    type Object3D,
  } from "three";
  import type { AutumnQualityTier } from "../../quality/autumn-quality";
  import {
    getAutumnGrassTierFromName,
    isAutumnGrassTierVisible,
  } from "./autumn-grass-tier";
  import { prefersReducedMotion } from "../../../../primitives/motion-preference";
  import {
    expandBoundsForRootedWind,
    patchRootedWindMaterial,
    type RootedWindUniforms,
  } from "../../../../primitives/rooted-wind-material";

  interface Props {
    scene: Object3D | null;
    tier: AutumnQualityTier;
  }

  let { scene, tier }: Props = $props();

  const windDirection = new Vector2(0.86, 0.5).normalize();
  const activeUniforms = new Set<RootedWindUniforms>();

  // Peak horizontal offset the wind shader can apply: strength 0.14 times the
  // primary+flutter envelope (1.24) times the maximum gust (1.0), rounded up.
  const WIND_BOUNDS_MARGIN = 0.25;

  $effect(() => {
    const loadedScene = scene;
    const activeTier = tier;
    if (!loadedScene) return;

    activeUniforms.clear();
    loadedScene.traverse((child) => {
      const grassTier = getAutumnGrassTierFromName(child.name);
      if (!grassTier) return;

      child.visible = isAutumnGrassTierVisible(child.name, activeTier);
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      // Culling used to be disabled outright, which submitted all three grass
      // meshes (28,519 triangles) every frame regardless of where the camera
      // looked. The real reason was the wind shader pushing tips outside the
      // authored bounds, so the bounds are grown by the shader's maximum
      // displacement instead and culling is left on.
      expandBoundsForRootedWind(
        mesh,
        WIND_BOUNDS_MARGIN,
        "autumnWindBoundsExpanded"
      );
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        if (material instanceof MeshStandardMaterial) {
          activeUniforms.add(
            patchRootedWindMaterial(material, {
              direction: windDirection,
              strength: 0.14,
              spatialVariation: 0.16,
              cacheKey: "autumn-rooted-wind-v3",
              storageKey: "autumnWindUniforms",
            })
          );
        }
      }
    });
  });

  const reducedMotion = $derived(prefersReducedMotion());

  useTask((delta) => {
    for (const uniforms of activeUniforms) {
      uniforms.strength.value = reducedMotion ? 0 : 0.14;
      uniforms.time.value += delta;
    }
  });
</script>
