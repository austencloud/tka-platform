import { Color, Vector2, type MeshStandardMaterial, type Texture } from "three";
import {
  inheritMaskedGroundDetailPatch,
  patchMaskedGroundDetailMaterial,
  type MaskedGroundDetailPatch,
  type MaskedGroundSurfaceDetailMaps,
} from "../../primitives/masked-ground-detail-material";

const STORAGE_KEY = "emberGroundDetailPatch";

export type EmberGroundDetailFamily =
  | "youngLava"
  | "ironContact"
  | "fracturedBasalt"
  | "shelteredAsh";

export const EMBER_GROUND_DETAIL_TEXTURES: Record<
  EmberGroundDetailFamily,
  string
> = {
  youngLava: "/textures/ember-surface-r9/young-lava.png",
  ironContact: "/textures/ember-surface-r9/iron-contact.png",
  fracturedBasalt: "/textures/ember-surface-r9/fractured-basalt.png",
  shelteredAsh: "/textures/ember-surface-r9/sheltered-ash.png",
};

export const EMBER_GROUND_DETAIL_MASK =
  "/textures/ember-surface-r9/fresh-rift-family-mask.png";

export const EMBER_GROUND_SURFACE_TEXTURES = {
  height: "/textures/ember-surface-r11/rock-ground-height.jpg",
  roughness: "/textures/ember-surface-r11/rock-ground-roughness.jpg",
} as const;

export type EmberGroundSurfaceDetailMaps = MaskedGroundSurfaceDetailMaps;

const MASKED_SURFACE_ROLES = new Set([
  "volcanic-basin",
  "playable-shelf",
  "playable-surface",
  "shelf-stratum",
  "stage-crust-transition",
  "lava-channel-levee",
]);

export type EmberGroundDetailPatch = MaskedGroundDetailPatch;

interface EmberGroundDetailOptions {
  preserveColor?: Color;
  normalResponse?: number;
  roughnessFloor?: number;
  absoluteColorStrength?: number;
}

export function isEmberGroundDetailSurface(
  role: string | undefined,
  material: MeshStandardMaterial
): boolean {
  return (
    role !== undefined &&
    MASKED_SURFACE_ROLES.has(role) &&
    material.name.startsWith("Ember_R9_fresh-rift-synthesis_")
  );
}

export function patchEmberGroundDetailMaterial(
  material: MeshStandardMaterial,
  detailMaps: Record<EmberGroundDetailFamily, Texture>,
  familyMask: Texture,
  surfaceMaps: EmberGroundSurfaceDetailMaps,
  strength = 0.94,
  options: EmberGroundDetailOptions = {}
): EmberGroundDetailPatch {
  return patchMaskedGroundDetailMaterial(
    material,
    {
      red: detailMaps.youngLava,
      green: detailMaps.ironContact,
      blue: detailMaps.fracturedBasalt,
      fourth: detailMaps.shelteredAsh,
    },
    familyMask,
    strength,
    {
      storageKey: STORAGE_KEY,
      cacheKey: "ember-ground-detail-r11-layered-volcanic-v1",
      preserveColor: options.preserveColor,
      normalResponse: options.normalResponse ?? 0.3,
      roughnessFloor: options.roughnessFloor ?? 0.68,
      absoluteColorStrength: options.absoluteColorStrength ?? 0.46,
      primaryScale: 2.4,
      secondaryScale: 7.6,
      familyContrast: 1.7,
      heightResponse: 0.34,
      macroScale: 42,
      macroDetailScale: 12,
      macroDetailStrength: 0.62,
      slopeFamilyStrength: 0.65,
      slopeStart: 0.18,
      maskOrigin: new Vector2(-190, -145),
      maskSize: new Vector2(380, 335),
      worldAxisSign: new Vector2(1, 1),
      familyBaselines: [
        new Color(0.047, 0.055, 0.053),
        new Color(0.11, 0.035, 0.01),
        new Color(0.065, 0.079, 0.077),
        new Color(0.086, 0.085, 0.076),
      ],
      macroDark: new Color(0.76, 0.8, 0.81),
      macroLight: new Color(1.24, 1.15, 1.03),
      surfaceDetail: {
        maps: surfaceMaps,
        scale: 1.55,
        albedoStrength: 0.28,
        normalStrength: 0.72,
        roughnessStrength: 0.46,
        slopeProjectionStrength: 0.9,
      },
    }
  );
}

export function inheritEmberGroundDetailPatch(
  source: MeshStandardMaterial,
  target: MeshStandardMaterial
): void {
  inheritMaskedGroundDetailPatch(source, target, STORAGE_KEY);
}
