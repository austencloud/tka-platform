import { Color, Vector2, type MeshStandardMaterial, type Texture } from "three";
import {
  inheritMaskedGroundDetailPatch,
  patchMaskedGroundDetailMaterial,
  type MaskedGroundDetailPatch,
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
  strength = 0.92,
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
      cacheKey: "ember-ground-detail-r9-fresh-rift-v1",
      preserveColor: options.preserveColor,
      normalResponse: options.normalResponse ?? 0.24,
      roughnessFloor: options.roughnessFloor ?? 0.76,
      absoluteColorStrength: options.absoluteColorStrength ?? 0.72,
      primaryScale: 2.15,
      secondaryScale: 6.8,
      maskOrigin: new Vector2(-190, -145),
      maskSize: new Vector2(380, 335),
      worldAxisSign: new Vector2(1, 1),
      familyBaselines: [
        new Color(0.047, 0.055, 0.053),
        new Color(0.11, 0.035, 0.01),
        new Color(0.065, 0.079, 0.077),
        new Color(0.086, 0.085, 0.076),
      ],
      macroDark: new Color(0.87, 0.91, 0.92),
      macroLight: new Color(1.1, 1.06, 0.99),
    }
  );
}

export function inheritEmberGroundDetailPatch(
  source: MeshStandardMaterial,
  target: MeshStandardMaterial
): void {
  inheritMaskedGroundDetailPatch(source, target, STORAGE_KEY);
}
