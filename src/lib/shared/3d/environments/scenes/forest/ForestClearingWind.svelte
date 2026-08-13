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
  import { QualityTier } from "../../../effects/types";
  import {
    getForestGrassTierFromName,
    isForestGrassTierVisible,
  } from "./forest-grass-tier";

  interface Props {
    scene: Object3D | null;
    tier?: QualityTier;
  }

  let { scene, tier = QualityTier.MEDIUM }: Props = $props();

  const windDirection = new Vector2(0.72, -0.69).normalize();
  const activeUniforms = new Set<RootedWindUniforms>();
  const strength = 0.105;

  $effect(() => {
    const loadedScene = scene;
    const activeTier = tier;
    if (!loadedScene) return;

    activeUniforms.clear();
    loadedScene.traverse((child) => {
      const grassTier = getForestGrassTierFromName(child.name);
      if (!grassTier) return;
      child.visible = isForestGrassTierVisible(child.name, activeTier);
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
            spatialVariation: 0.19,
            rootDarkening: 0.24,
            colorVariation: 0.09,
            cacheKey: "forest-rooted-wind-v2",
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
