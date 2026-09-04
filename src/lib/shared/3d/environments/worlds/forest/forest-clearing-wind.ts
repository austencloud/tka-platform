import { MeshStandardMaterial, Vector2, type Mesh, type Object3D } from "three";
import { QualityTier } from "../../../effects/types";
import {
  expandBoundsForRootedWind,
  patchRootedWindMaterial,
  type RootedWindUniforms,
} from "../../primitives/rooted-wind-material";
import { FOREST_LIVING_GRASS_MATERIAL_PROFILE } from "../../scenes/forest/forest-grass-material-profile";
import {
  getForestGrassTierFromName,
  isForestGrassTierVisible,
} from "../../scenes/forest/forest-grass-tier";

export interface ForestClearingWind {
  update(deltaSeconds: number, motionScale?: number): void;
}

/** Exact renderer-neutral owner of Forest's rooted grass wind. */
export function createForestClearingWind(
  root: Object3D,
  tier: QualityTier = QualityTier.MEDIUM
): ForestClearingWind {
  const direction = new Vector2(0.72, -0.69).normalize();
  const uniforms = new Set<RootedWindUniforms>();

  root.traverse((child) => {
    const grassTier = getForestGrassTierFromName(child.name);
    if (!grassTier) return;
    child.visible = isForestGrassTierVisible(child.name, tier);
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const species = String(child.userData?.tka_ground_species ?? "");
    const stratum = String(child.userData?.tka_ground_stratum ?? "");
    const ecosystem =
      child.userData?.tka_role === "near-frame-ground-ecosystem";
    const livingGrass =
      ecosystem && child.userData?.tka_ground_family === "grass";
    const baseStrength = ecosystem
      ? species === "forest-moss"
        ? 0.018
        : species === "bracken-fern" || species === "nettle-colony"
          ? 0.062
          : 0.075
      : 0.082;
    const strength =
      baseStrength * Number(child.userData?.tka_wind_response ?? 1);
    const rootDarkening = ecosystem
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
      uniforms.add(
        patchRootedWindMaterial(material, {
          direction,
          strength,
          spatialVariation: stratum === "carpet" ? 0.18 : 0.32,
          rootDarkening,
          colorVariation: ecosystem
            ? FOREST_LIVING_GRASS_MATERIAL_PROFILE.colorVariation
            : 0.07,
          normalUpBlend: livingGrass
            ? FOREST_LIVING_GRASS_MATERIAL_PROFILE.normalUpBlend
            : 0,
          minimumRoughness: livingGrass
            ? FOREST_LIVING_GRASS_MATERIAL_PROFILE.minimumRoughness
            : 0,
          specularScale: livingGrass
            ? FOREST_LIVING_GRASS_MATERIAL_PROFILE.specularScale
            : 1,
          cacheKey: `forest-rooted-wind-v7-${species || "legacy"}-${stratum || "legacy"}`,
          storageKey: "forestWindUniforms",
        })
      );
    }
  });

  return {
    update(deltaSeconds, motionScale = 1) {
      for (const entry of uniforms) {
        entry.strength.value = entry.restStrength.value * motionScale;
        entry.time.value += deltaSeconds * motionScale;
      }
    },
  };
}
