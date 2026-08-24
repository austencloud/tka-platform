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
  import {
    getBlossomGroundLifeTier,
    isBlossomGroundLifeTierVisible,
    type BlossomGroundLifeTier,
  } from "./blossom-ground";

  interface Props {
    scene: Object3D | null;
    tier: BlossomGroundLifeTier;
  }

  let { scene, tier }: Props = $props();
  const windDirection = new Vector2(0.58, -0.82).normalize();
  const activeUniforms = new Set<RootedWindUniforms>();

  $effect(() => {
    const loadedScene = scene;
    const activeTier = tier;
    if (!loadedScene) return;

    activeUniforms.clear();
    loadedScene.traverse((child) => {
      const mesh = child as Mesh;
      const identity = `${child.name} ${mesh.geometry?.name ?? ""}`;
      const grassTier = getBlossomGroundLifeTier(
        identity,
        child.userData?.tka_ground_quality_tier
      );
      if (!grassTier) return;

      child.visible = isBlossomGroundLifeTierVisible(grassTier, activeTier);
      if (!mesh.isMesh) return;

      const family =
        identity
          .match(
            /Blossom(?:_| )Grass(?:_| )(?:Base|Medium|High)(?:_| )(Deep|Living|Moonlit|Damp)/i
          )?.[1]
          ?.toLowerCase() ??
        String(child.userData?.tka_ground_palette ?? "living");
      const tierStrength =
        grassTier === "high" ? 0.085 : grassTier === "medium" ? 0.069 : 0.052;
      const strength = family === "damp" ? tierStrength * 1.12 : tierStrength;

      mesh.castShadow = false;
      mesh.receiveShadow = true;
      expandBoundsForRootedWind(mesh, 0.34, "blossomWindBoundsExpanded");
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        activeUniforms.add(
          patchRootedWindMaterial(material, {
            direction: windDirection,
            strength,
            spatialVariation: family === "damp" ? 0.38 : 0.28,
            rootDarkening: 0.34,
            colorVariation: 0.045,
            normalUpBlend: 0.74,
            minimumRoughness: 0.99,
            specularScale: 0.015,
            cacheKey: `blossom-rooted-wind-r1-${family}-${grassTier}`,
            storageKey: "blossomWindUniforms",
          })
        );
      }
    });
  });

  const reducedMotion = $derived(prefersReducedMotion());
  const motionScale = $derived(resolveMotionScale(reducedMotion));

  useTask((delta) => {
    for (const uniforms of activeUniforms) {
      uniforms.strength.value = uniforms.restStrength.value * motionScale;
      uniforms.time.value += delta * motionScale;
    }
  });
</script>
