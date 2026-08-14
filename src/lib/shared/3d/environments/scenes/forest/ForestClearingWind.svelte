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
  import { FOREST_LIVING_GRASS_MATERIAL_PROFILE } from "./forest-grass-material-profile";

  interface Props {
    scene: Object3D | null;
    tier?: QualityTier;
  }

  let { scene, tier = QualityTier.MEDIUM }: Props = $props();

  const windDirection = new Vector2(0.72, -0.69).normalize();
  const activeUniforms = new Set<RootedWindUniforms>();

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

      const species = String(child.userData?.tka_ground_species ?? "");
      const stratum = String(child.userData?.tka_ground_stratum ?? "");
      const isEcosystem =
        child.userData?.tka_role === "near-frame-ground-ecosystem";
      const isLivingGrass =
        isEcosystem && child.userData?.tka_ground_family === "grass";
      const baseStrength = isEcosystem
        ? species === "forest-moss"
          ? 0.018
          : species === "bracken-fern" || species === "nettle-colony"
            ? 0.062
            : 0.075
        : 0.082;
      const authoredWindResponse = Number(
        child.userData?.tka_wind_response ?? 1
      );
      const strength = baseStrength * authoredWindResponse;
      const rootDarkening = isEcosystem
        ? FOREST_LIVING_GRASS_MATERIAL_PROFILE.rootDarkening
        : 0.36;

      mesh.castShadow = false;
      mesh.receiveShadow = true;
      expandBoundsForRootedWind(mesh, 0.28, "forestWindBoundsExpanded");
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        activeUniforms.add(
          patchRootedWindMaterial(material, {
            direction: windDirection,
            strength,
            spatialVariation: stratum === "carpet" ? 0.18 : 0.32,
            rootDarkening,
            colorVariation: isEcosystem
              ? FOREST_LIVING_GRASS_MATERIAL_PROFILE.colorVariation
              : 0.07,
            // Real turf scatters light through thousands of narrow blades. A
            // strongly face-normal response turns instanced cards into pale
            // sheets as the camera rises. Bent vegetation normals keep their
            // summer-green value stable while the wind still changes shape.
            normalUpBlend: isLivingGrass
              ? FOREST_LIVING_GRASS_MATERIAL_PROFILE.normalUpBlend
              : 0,
            minimumRoughness: isLivingGrass
              ? FOREST_LIVING_GRASS_MATERIAL_PROFILE.minimumRoughness
              : 0,
            specularScale: isLivingGrass
              ? FOREST_LIVING_GRASS_MATERIAL_PROFILE.specularScale
              : 1,
            cacheKey: `forest-rooted-wind-v7-${species || "legacy"}-${stratum || "legacy"}`,
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
      uniforms.strength.value = uniforms.restStrength.value * motionScale;
      uniforms.time.value += delta * motionScale;
    }
  });
</script>
