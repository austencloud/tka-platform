import {
  Color,
  MeshStandardMaterial,
  Vector2,
  type Mesh,
  type Object3D,
  type Texture,
} from "three";

import {
  patchMaskedGroundDetailMaterial,
  type MaskedGroundDetailMaps,
  type MaskedGroundDetailPatch,
} from "../../primitives/masked-ground-detail-material";
import {
  expandBoundsForRootedWind,
  patchRootedWindMaterial,
  type RootedWindUniforms,
} from "../../primitives/rooted-wind-material";
import {
  getBlossomGroundLifeTier,
  getBlossomGroundMaskBounds,
  getBlossomStageContact,
  isBlossomGroundLifeTierVisible,
  type BlossomGroundLifeTier,
} from "../../scenes/cherry-blossom/blossom-ground";

export interface BlossomGroundAssets {
  detailMaps: MaskedGroundDetailMaps;
  familyMask: Texture;
}

export interface BlossomGroundRuntimeOptions {
  environmentRoot: Object3D;
  assets: BlossomGroundAssets;
  stageWidth: number;
  stageDepth: number;
  stageZOffset: number;
  qualityTier: BlossomGroundLifeTier;
  motionScale: number;
}

export interface BlossomGroundRuntime {
  update(deltaSeconds: number): void;
  dispose(): void;
}

/** Exact owner of Blossom's masked soil detail and rooted grass movement. */
export function createBlossomGroundRuntime(
  options: BlossomGroundRuntimeOptions
): BlossomGroundRuntime {
  const detailPatches = new Set<MaskedGroundDetailPatch>();
  const windUniforms = new Set<RootedWindUniforms>();
  const windDirection = new Vector2(0.58, -0.82).normalize();
  const bounds = getBlossomGroundMaskBounds();
  const contact = getBlossomStageContact();

  options.environmentRoot.traverse((child) => {
    const mesh = child as Mesh;
    const identity = `${child.name} ${mesh.geometry?.name ?? ""}`;
    const grassTier = getBlossomGroundLifeTier(
      identity,
      child.userData?.tka_ground_quality_tier
    );
    if (grassTier) {
      child.visible = isBlossomGroundLifeTierVisible(
        grassTier,
        options.qualityTier
      );
      if (mesh.isMesh) {
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
          windUniforms.add(
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
      }
    }

    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const candidate of materials) {
      const material = candidate as MeshStandardMaterial;
      if (
        !material.isMeshStandardMaterial ||
        material.name !== "Blossom Living Garden Ground"
      ) {
        continue;
      }
      detailPatches.add(
        patchMaskedGroundDetailMaterial(
          material,
          options.assets.detailMaps,
          options.assets.familyMask,
          0.92,
          {
            storageKey: "blossomGroundDetailPatch",
            cacheKey: "blossom-ground-detail-r2.1",
            preserveColor: material.color,
            normalResponse: 0.27,
            roughnessFloor: 0.98,
            absoluteColorStrength: 0.76,
            primaryScale: 2.45,
            secondaryScale: 6.8,
            maskOrigin: new Vector2(
              bounds.min[0],
              bounds.min[1] + options.stageZOffset
            ),
            maskSize: new Vector2(bounds.size[0], bounds.size[1]),
            worldAxisSign: new Vector2(1, 1),
            familyBaselines: [
              new Color(0.58, 0.56, 0.49),
              new Color(0.44, 0.62, 0.29),
              new Color(0.36, 0.44, 0.25),
              new Color(0.27, 0.31, 0.23),
            ],
            macroDark: new Color(0.86, 0.9, 0.84),
            macroLight: new Color(1.07, 1.03, 0.96),
            contactZone: {
              center: new Vector2(0, options.stageZOffset),
              halfSize: new Vector2(
                options.stageWidth * 0.5 + contact.edgeInset,
                options.stageDepth * 0.5 + contact.edgeInset
              ),
              feather: contact.feather,
              noise: contact.noise,
              strength: contact.strength,
            },
          }
        )
      );
    }
  });

  return {
    update(deltaSeconds) {
      for (const uniforms of windUniforms) {
        uniforms.strength.value =
          uniforms.restStrength.value * options.motionScale;
        uniforms.time.value += deltaSeconds * options.motionScale;
      }
    },
    dispose() {
      for (const patch of detailPatches) patch.dispose();
      detailPatches.clear();
      windUniforms.clear();
    },
  };
}
