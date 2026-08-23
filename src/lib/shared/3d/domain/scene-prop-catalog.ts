import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

export interface ScenePropVariant {
  id: PropType;
  label: string;
}

export interface ScenePropFamily {
  tileLabel: string;
  controlLabel: string;
  representative: PropType;
  variants: readonly ScenePropVariant[];
}

/**
 * Physical props that the production 3D scene can render and the Prop Studio
 * can review. Keep this catalog shared so a prop cannot appear in the performer
 * inspector without also belonging to the 3D studio's supported surface.
 */
export const SCENE_PROP_FAMILIES: readonly ScenePropFamily[] = [
  {
    tileLabel: "Sword / Sickles",
    controlLabel: "Weapon",
    representative: PropType.SWORD,
    variants: [
      { id: PropType.SWORD, label: "Sword" },
      { id: PropType.SICKLES, label: "Sickles" },
    ],
  },
  {
    tileLabel: "Double Staff",
    controlLabel: "Double Staff build",
    representative: PropType.STAFF,
    variants: [
      { id: PropType.STAFF, label: "Staff" },
      { id: PropType.CAPSULE_BATON, label: "LED Baton" },
      { id: PropType.FIRE_DOUBLE_STAFF, label: "Fire Staff" },
    ],
  },
  {
    tileLabel: "Chicken",
    controlLabel: "Chicken size",
    representative: PropType.CHICKEN,
    variants: [
      { id: PropType.CHICKEN, label: "Chicken" },
      { id: PropType.BIGCHICKEN, label: "Big Chicken" },
    ],
  },
  {
    tileLabel: "Club / Torch",
    controlLabel: "Club build",
    representative: PropType.CLUB,
    variants: [
      { id: PropType.CLUB, label: "Club" },
      { id: PropType.TORCH, label: "Torch" },
    ],
  },
  {
    tileLabel: "Instruments",
    controlLabel: "Instrument",
    representative: PropType.GUITAR,
    variants: [
      { id: PropType.GUITAR, label: "Guitar" },
      { id: PropType.UKULELE, label: "Ukulele" },
    ],
  },
  {
    tileLabel: "Triquetra",
    controlLabel: "Triquetra grip",
    representative: PropType.TRIQUETRA,
    variants: [
      { id: PropType.TRIQUETRA, label: "Triquetra" },
      { id: PropType.TRIQUETRA2, label: "Triquetra 2" },
    ],
  },
  {
    tileLabel: "Triad / Trigeng",
    controlLabel: "Triad form",
    representative: PropType.TRIAD,
    variants: [
      { id: PropType.TRIAD, label: "Triad" },
      { id: PropType.TRIGENG, label: "Trigeng" },
    ],
  },
] as const;

export const SCENE_PROP_REPRESENTATIVES = [
  PropType.CLUB,
  PropType.FAN,
  PropType.TRIAD,
  PropType.MINIHOOP,
  PropType.BUUGENG,
  PropType.TRIQUETRA,
  PropType.CHICKEN,
  PropType.DOUBLESTAR,
  PropType.EIGHTRINGS,
  PropType.SWORD,
  PropType.QUIAD,
  PropType.STAFF,
  PropType.POI,
  PropType.GUITAR,
] as const;

export const SCENE_PROP_TYPES: readonly PropType[] = [
  ...SCENE_PROP_REPRESENTATIVES,
  ...SCENE_PROP_FAMILIES.flatMap((family) =>
    family.variants.map((variant) => variant.id)
  ),
];

const SCENE_PROP_TYPE_SET = new Set<PropType>(SCENE_PROP_TYPES);

export function isScenePhysicalProp(prop: PropType): boolean {
  return SCENE_PROP_TYPE_SET.has(prop);
}

export function findScenePropFamily(
  prop: PropType
): ScenePropFamily | undefined {
  return SCENE_PROP_FAMILIES.find((family) =>
    family.variants.some((variant) => variant.id === prop)
  );
}

export function findScenePropFamilyByRepresentative(
  prop: PropType
): ScenePropFamily | undefined {
  return SCENE_PROP_FAMILIES.find((family) => family.representative === prop);
}
