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
  fracturedBasalt: "/textures/ember-midflank-r5/rock-ground-color.jpg",
  shelteredAsh: "/textures/ember-surface-r9/sheltered-ash.png",
};

export const EMBER_GROUND_DETAIL_MASK =
  "/textures/ember-midflank-r5/family-mask.png";

export const EMBER_GROUND_SURFACE_TEXTURES = {
  height: "/textures/ember-surface-r11/rock-ground-height.jpg",
} as const;

export type EmberGroundSurfaceDetailMaps = MaskedGroundSurfaceDetailMaps;

// Every geology role the world ships except the hero escarpment. The bowl roles
// were the original gate; the upcountry roles were added because the slice
// beyond the performer bowl was reading as smooth low-poly clay. Three of them
// (caldera-bank, perimeter-talus-cluster, meshy-lava-bank) were already being
// patched by accident: GLTFLoader shares one material instance per glTF
// material index, so they inherited the pass through roped-pahoehoe and
// iron-contact-crust. Naming them makes the reach deliberate instead of
// incidental. meshy-hero-geology stays out — it carries authored columnar
// normals and the rim-lit sculpt that reads correctly at close range, and this
// pass would fold its own normal map down to normalResponse.
const MASKED_SURFACE_ROLES = new Set([
  "volcanic-basin",
  "playable-shelf",
  "playable-surface",
  "shelf-stratum",
  "stage-crust-transition",
  "lava-channel-levee",
  "caldera-bank",
  "perimeter-talus-cluster",
  "meshy-lava-bank",
  "meshy-distant-caldera",
  "meshy-fumarole-talus",
]);

// The bowl families the performer stands on and among. Their baked albedo is
// already volcanic, so the detail pass sits on top of it at the strength the
// close-range crust was tuned to.
const STAGE_TIER_FAMILIES = ["roped-pahoehoe", "iron-contact-crust"] as const;

export type EmberGroundDetailTier = "stage" | "upcountry";

interface EmberGroundDetailTierProfile {
  absoluteColorStrength: number;
  familyContrast: number;
  macroDark: Color;
  macroLight: Color;
}

// preserveColor parks material.color at white for the duration of the patch, so
// the atmosphere look's tint lerp cannot reach a patched surface: albedo is the
// baked map mixed toward the synthesised detail. That is why the bowl reads as
// warm crust while the basin and the breached caldera read as pale grey — same
// shader, different baked map. The upcountry profile answers that by letting
// the synthesised detail carry most of the albedo and by biasing the macro
// range darker and warmer, which is also what stops the long slopes from
// reading as untextured clay.
const TIER_PROFILES: Record<
  EmberGroundDetailTier,
  EmberGroundDetailTierProfile
> = {
  stage: {
    absoluteColorStrength: 0.46,
    familyContrast: 1.7,
    macroDark: new Color(0.76, 0.8, 0.81),
    macroLight: new Color(1.24, 1.15, 1.03),
  },
  upcountry: {
    absoluteColorStrength: 0.82,
    familyContrast: 2.05,
    macroDark: new Color(0.54, 0.52, 0.51),
    macroLight: new Color(1.02, 0.94, 0.85),
  },
};

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
  if (material.name.startsWith("Ember_Midflank_R5_")) {
    return !material.name.endsWith("live-deposit");
  }
  return (
    role !== undefined &&
    MASKED_SURFACE_ROLES.has(role) &&
    material.name.startsWith("Ember_R9_fresh-rift-synthesis_")
  );
}

// Resolved from the material, never from the role: one material instance is
// shared across many roles, and the first patch wins, so a role-keyed tier
// would depend on traverse order.
export function emberGroundDetailTier(
  material: MeshStandardMaterial
): EmberGroundDetailTier {
  return STAGE_TIER_FAMILIES.some((family) => material.name.endsWith(family))
    ? "stage"
    : "upcountry";
}

export function patchEmberGroundDetailMaterial(
  material: MeshStandardMaterial,
  detailMaps: Record<EmberGroundDetailFamily, Texture>,
  familyMask: Texture,
  surfaceMaps: EmberGroundSurfaceDetailMaps,
  strength = 0.94,
  options: EmberGroundDetailOptions = {}
): EmberGroundDetailPatch {
  const tier = TIER_PROFILES[emberGroundDetailTier(material)];
  const midflank = material.name.startsWith("Ember_Midflank_R5_");
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
      // One key for both tiers on purpose: the tier only moves uniform values,
      // so the two profiles share a single compiled program.
      cacheKey: "ember-ground-detail-r13-upcountry-reach-v1",
      // The old GLB has albedo maps; R5 uses its authored material color.
      // Whitening an untextured material turns the whole mountain into chalk.
      preserveColor: midflank ? undefined : options.preserveColor,
      normalResponse: options.normalResponse ?? 0.3,
      roughnessFloor: options.roughnessFloor ?? 0.68,
      absoluteColorStrength:
        options.absoluteColorStrength ??
        (midflank ? 0.65 : tier.absoluteColorStrength),
      primaryScale: 2.4,
      secondaryScale: 7.6,
      contactZone: midflank
        ? {
            center: new Vector2(0, 0),
            halfSize: new Vector2(4.2, 3.7),
            feather: 2.8,
            noise: 1.2,
            strength: 0.8,
          }
        : undefined,
      familyContrast: tier.familyContrast,
      heightResponse: midflank ? 0.025 : 0.34,
      macroScale: 42,
      macroDetailScale: 12,
      macroDetailStrength: 0.62,
      slopeFamilyStrength: 0.65,
      slopeStart: 0.18,
      bladeSignal: 0,
      maskOrigin: new Vector2(-190, -145),
      maskSize: new Vector2(380, 335),
      worldAxisSign: new Vector2(1, 1),
      familyBaselines: [
        new Color(0.047, 0.055, 0.053),
        new Color(0.11, 0.035, 0.01),
        new Color(0.065, 0.079, 0.077),
        new Color(0.086, 0.085, 0.076),
      ],
      macroDark: tier.macroDark.clone(),
      macroLight: tier.macroLight.clone(),
      surfaceDetail: {
        maps: surfaceMaps,
        scale: 1.55,
        albedoStrength: midflank ? 0.45 : 0.22,
        normalStrength: midflank ? 0.14 : 0.72,
        // 2.63 against 1.55 is irrational enough that the two lattices never
        // re-align inside the 380m basin, and 0.94rad keeps the scan's own
        // directional grain from stacking with itself.
        breakup: {
          scale: 2.63,
          rotation: 0.94,
          blendScale: 19,
        },
      },
      // Warp displacement (3.2m) exceeds the 1.55m micro-surface tile, so no
      // region of the basin repeats its neighbour's phase.
      deTiling: {
        warpScale: 26,
        warpStrength: 3.2,
        latticeScale: 34,
        latticeMixLow: 0.12,
        latticeMixHigh: 0.72,
      },
      // The old 90m end was set well inside what the textures can actually
      // resolve. At 200m a 50-degree 1080p frame spans roughly 0.16m per pixel,
      // so the 2.4m primary lattice and the 1.55m micro-surface still land on
      // 10-15 pixels per tile — nowhere near the derivative breakdown the fade
      // exists to avoid. Ending the grade at 210 instead keeps grain across the
      // whole basin, and because the ramp is longer the mid field (30-70m, the
      // range the orbit cameras fill) now carries more detail than it did, not
      // less. Specular anti-aliasing plus the far roughness floor below still
      // absorb whatever normal variance survives.
      distanceGrading: {
        start: 18,
        end: 210,
        detailAlbedo: 0.78,
        detailNormal: 0.3,
        roughnessFloor: 0.93,
        grazingRoughnessFloor: 0.86,
        grazingStart: 0.2,
      },
      specularAntiAliasing: {
        variance: 0.25,
        threshold: 0.18,
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
