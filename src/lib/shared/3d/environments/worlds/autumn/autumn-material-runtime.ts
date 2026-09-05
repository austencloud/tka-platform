import {
  MeshStandardMaterial,
  Vector2,
  type Mesh,
  type Object3D,
  type Texture,
} from "three";

import {
  applyAutumnGeometryTier,
  restoreAutumnGeometryTier,
  type AutumnGeometryTierReport,
} from "../../scenes/autumn/quality/autumn-geometry-tier";
import type {
  AutumnQualityConfig,
  AutumnQualityTier,
} from "../../scenes/autumn/quality/autumn-quality";
import {
  patchAutumnDepthCohesionMaterial,
  type AutumnDepthCohesionPatch,
} from "../../scenes/autumn/runtime/atmosphere/autumn-depth-cohesion";
import {
  isAutumnGroundMaterial,
  patchAutumnGroundDetailMaterial,
  type AutumnGroundDetailPatch,
} from "../../scenes/autumn/runtime/ground/autumn-ground-detail";
import { sampleAutumnLanternFlicker } from "../../scenes/autumn/runtime/lighting/autumn-lantern-flicker";
import { configureAutumnShadowMesh } from "../../scenes/autumn/runtime/lighting/autumn-shadow-roles";
import {
  getAutumnGrassTierFromName,
  isAutumnGrassTierVisible,
} from "../../scenes/autumn/runtime/wind/autumn-grass-tier";
import {
  expandBoundsForRootedWind,
  patchRootedWindMaterial,
  type RootedWindUniforms,
} from "../../primitives/rooted-wind-material";

export interface AutumnMaterialRuntime {
  geometryReport: AutumnGeometryTierReport;
  update(deltaSeconds: number): void;
  setActive(active: boolean): void;
  setGroundDetailStrength(strength: number): void;
  setMotionScale(scale: number): void;
  setQuality(tier: AutumnQualityTier, quality: AutumnQualityConfig): void;
  dispose(): void;
}

const WIND_STRENGTH = 0.14;
const WIND_BOUNDS_MARGIN = 0.25;

/**
 * Owns every production material mutation applied to the authored Autumn GLB.
 * Patch order matches AutumnRuntimeSystems: wind, ground detail, then depth.
 */
export function createAutumnMaterialRuntime(options: {
  environment: Object3D;
  tier: AutumnQualityTier;
  quality: AutumnQualityConfig;
  groundDetailMap: Texture | null;
  groundDetailStrength: number;
  motionScale?: number;
  active?: boolean;
}): AutumnMaterialRuntime {
  const environment = options.environment;
  const windDirection = new Vector2(0.86, 0.5).normalize();
  const windUniforms = new Set<RootedWindUniforms>();
  const groundPatches = new Set<AutumnGroundDetailPatch>();
  const depthPatches = new Set<AutumnDepthCohesionPatch>();
  const lanterns = new Map<MeshStandardMaterial, number>();
  const grassObjects: Object3D[] = [];
  const geometryReport = applyAutumnGeometryTier(environment, options.tier);
  let tier = options.tier;
  let motionScale = Math.max(0, options.motionScale ?? 1);
  let active = options.active ?? true;
  let localTime = 0;
  let disposed = false;

  environment.traverse((child) => {
    const grassTier = getAutumnGrassTierFromName(child.name);
    if (grassTier) {
      grassObjects.push(child);
      child.visible = isAutumnGrassTierVisible(child.name, tier);
    }

    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    configureAutumnShadowMesh(mesh, options.quality.shadows);

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const candidate of materials) {
      if (!(candidate instanceof MeshStandardMaterial)) continue;

      if (grassTier) {
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        expandBoundsForRootedWind(
          mesh,
          WIND_BOUNDS_MARGIN,
          "autumnWindBoundsExpanded"
        );
        windUniforms.add(
          patchRootedWindMaterial(candidate, {
            direction: windDirection,
            strength: WIND_STRENGTH,
            spatialVariation: 0.16,
            cacheKey: "autumn-rooted-wind-v3",
            storageKey: "autumnWindUniforms",
          })
        );
      }

      if (options.groundDetailMap && isAutumnGroundMaterial(candidate)) {
        groundPatches.add(
          patchAutumnGroundDetailMaterial(
            candidate,
            options.groundDetailMap,
            options.groundDetailStrength
          )
        );
      }

      const depthPatch = patchAutumnDepthCohesionMaterial(candidate);
      if (depthPatch) depthPatches.add(depthPatch);

      if (child.name.startsWith("Autumn_Wayfinding_Lantern_Glow")) {
        lanterns.set(candidate, candidate.emissiveIntensity);
      }
    }
  });

  function syncWindStrength(): void {
    const strength = active && motionScale > 0 ? WIND_STRENGTH : 0;
    for (const uniforms of windUniforms) uniforms.strength.value = strength;
  }
  syncWindStrength();

  return {
    geometryReport,
    update(deltaSeconds) {
      if (disposed || !active) return;
      for (const uniforms of windUniforms) {
        uniforms.time.value += deltaSeconds;
      }
      localTime += deltaSeconds * motionScale;
      const flicker =
        motionScale === 0 ? 1 : sampleAutumnLanternFlicker(localTime);
      for (const [material, baseIntensity] of lanterns) {
        material.emissiveIntensity = baseIntensity * flicker;
      }
    },
    setActive(nextActive) {
      active = nextActive;
      syncWindStrength();
    },
    setGroundDetailStrength(strength) {
      for (const patch of groundPatches) {
        patch.uniforms.strength.value = strength;
      }
    },
    setMotionScale(scale) {
      motionScale = Number.isFinite(scale) ? Math.max(0, scale) : 1;
      syncWindStrength();
    },
    setQuality(nextTier, quality) {
      tier = nextTier;
      geometryReport.tier = nextTier;
      for (const object of grassObjects) {
        object.visible = isAutumnGrassTierVisible(object.name, nextTier);
      }
      environment.traverse((child) => {
        const mesh = child as Mesh;
        if (mesh.isMesh) configureAutumnShadowMesh(mesh, quality.shadows);
      });
      for (const object of grassObjects) {
        const mesh = object as Mesh;
        if (!mesh.isMesh) continue;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [material, baseIntensity] of lanterns) {
        material.emissiveIntensity = baseIntensity;
      }
      for (const patch of depthPatches) patch.dispose();
      for (const patch of groundPatches) patch.dispose();
      restoreAutumnGeometryTier(environment);
      windUniforms.clear();
      groundPatches.clear();
      depthPatches.clear();
      lanterns.clear();
    },
  };
}
