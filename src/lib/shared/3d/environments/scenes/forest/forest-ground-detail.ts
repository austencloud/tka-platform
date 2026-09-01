import { Color, Vector2, type MeshStandardMaterial, type Texture } from "three";
import {
  inheritMaskedGroundDetailPatch,
  patchMaskedGroundDetailMaterial,
  type MaskedGroundDetailPatch,
} from "../../primitives/masked-ground-detail-material";

const STORAGE_KEY = "forestGroundDetailPatch";

export type ForestGroundDetailFamily = "neutral" | "meadow" | "litter" | "damp";

export const FOREST_GROUND_DETAIL_TEXTURES: Record<
  ForestGroundDetailFamily,
  string
> = {
  neutral: "/textures/forest-floor/forest-ground-detail-neutral.jpg",
  meadow: "/textures/forest-floor/forest-ground-detail-meadow.jpg",
  litter: "/textures/forest-floor/forest-ground-detail-litter.jpg",
  damp: "/textures/forest-floor/forest-ground-detail-damp.jpg",
};

const FOREST_GROUND_MATERIAL_FAMILIES = new Map<
  string,
  ForestGroundDetailFamily
>([
  ["Packed Performance Clearing", "meadow"],
  ["Path Soil", "neutral"],
  ["Leaf Duff", "litter"],
  ["Shade Moss", "litter"],
  ["Damp Hollow", "damp"],
  ["Quiet Distant Ground", "neutral"],
]);

export type ForestGroundDetailPatch = MaskedGroundDetailPatch;

interface ForestGroundDetailOptions {
  preserveColor?: Color;
  normalResponse?: number;
  roughnessFloor?: number;
  absoluteColorStrength?: number;
  primaryScale?: number;
  secondaryScale?: number;
  maskOrigin?: Vector2;
  maskSize?: Vector2;
  worldAxisSign?: Vector2;
}

export function isForestGroundMaterial(
  material: MeshStandardMaterial
): boolean {
  return getForestGroundDetailFamily(material) !== null;
}

export function getForestGroundDetailFamily(
  material: MeshStandardMaterial
): ForestGroundDetailFamily | null {
  return FOREST_GROUND_MATERIAL_FAMILIES.get(material.name) ?? null;
}

export function patchForestGroundDetailMaterial(
  material: MeshStandardMaterial,
  detailMaps: Record<ForestGroundDetailFamily, Texture>,
  familyMask: Texture,
  strength = 0.9,
  options: ForestGroundDetailOptions = {}
): ForestGroundDetailPatch {
  return patchMaskedGroundDetailMaterial(
    material,
    {
      right: detailMaps.neutral,
      green: detailMaps.meadow,
      left: detailMaps.litter,
      fourth: detailMaps.damp,
    },
    familyMask,
    strength,
    {
      storageKey: STORAGE_KEY,
      cacheKey: "forest-ground-detail-v8",
      preserveColor: options.preserveColor,
      normalResponse: options.normalResponse,
      roughnessFloor: options.roughnessFloor,
      absoluteColorStrength: options.absoluteColorStrength ?? 0,
      primaryScale: options.primaryScale ?? 2.8,
      secondaryScale: options.secondaryScale ?? 7.4,
      maskOrigin: options.maskOrigin ?? new Vector2(-200, -200),
      maskSize: options.maskSize ?? new Vector2(400, 400),
      worldAxisSign: options.worldAxisSign ?? new Vector2(1, -1),
      familyBaselines: [
        new Color(0.36, 0.38, 0.25),
        new Color(0.44, 0.62, 0.29),
        new Color(0.36, 0.44, 0.25),
        new Color(0.36, 0.38, 0.25),
      ],
      macroDark: new Color(0.94, 0.96, 0.91),
      macroLight: new Color(1.04, 1.02, 0.93),
    }
  );
}

export function inheritForestGroundDetailPatch(
  source: MeshStandardMaterial,
  target: MeshStandardMaterial
): void {
  inheritMaskedGroundDetailPatch(source, target, STORAGE_KEY);
}
