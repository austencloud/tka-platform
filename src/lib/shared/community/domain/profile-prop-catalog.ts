import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  getAllVariations,
  getBasePropType,
  getPropTypeDisplayInfo,
  isPremiumCosmeticProp,
  isPropActive,
} from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";

export type ProfilePropGroup = "core" | "specialty";

export interface ProfilePropFamily {
  representative: PropType;
  label: string;
  group: ProfilePropGroup;
  variants: readonly PropType[];
}

interface ProfilePropFamilyDefinition {
  representative: PropType;
  label: string;
  group: ProfilePropGroup;
}

const FAMILY_DEFINITIONS: readonly ProfilePropFamilyDefinition[] = [
  { representative: PropType.STAFF, label: "Staff", group: "core" },
  { representative: PropType.CLUB, label: "Club", group: "core" },
  { representative: PropType.FAN, label: "Fan", group: "core" },
  { representative: PropType.BUUGENG, label: "Buugeng", group: "core" },
  { representative: PropType.MINIHOOP, label: "Hoop", group: "core" },
  { representative: PropType.TRIAD, label: "Triad", group: "core" },
  {
    representative: PropType.TRIQUETRA,
    label: "Triquetra",
    group: "core",
  },
  { representative: PropType.SWORD, label: "Sword", group: "core" },
  {
    representative: PropType.DOUBLESTAR,
    label: "Double Star",
    group: "specialty",
  },
  {
    representative: PropType.EIGHTRINGS,
    label: "Eight Rings",
    group: "specialty",
  },
] as const;

function activeProfileVariants(representative: PropType): PropType[] {
  return getAllVariations(representative).filter(
    (prop) => isPropActive(prop) && !isPremiumCosmeticProp(prop)
  );
}

export const PROFILE_PROP_FAMILIES: readonly ProfilePropFamily[] =
  FAMILY_DEFINITIONS.map((family) => ({
    ...family,
    variants: activeProfileVariants(family.representative),
  }));

const FAMILY_BY_VARIANT = new Map<PropType, ProfilePropFamily>(
  PROFILE_PROP_FAMILIES.flatMap((family) =>
    family.variants.map((variant) => [variant, family] as const)
  )
);

export function getProfilePropFamily(
  prop: PropType
): ProfilePropFamily | undefined {
  return FAMILY_BY_VARIANT.get(prop);
}

export function getProfilePropFamilyByRepresentative(
  representative: PropType
): ProfilePropFamily | undefined {
  return PROFILE_PROP_FAMILIES.find(
    (family) => family.representative === representative
  );
}

export function getProfilePropLabel(prop: PropType): string {
  return getPropTypeDisplayInfo(prop).label;
}

export function isProfilePropChoice(prop: PropType): boolean {
  return FAMILY_BY_VARIANT.has(prop);
}

export function uniqueProfileProps(props: readonly PropType[]): PropType[] {
  return props.filter((prop, index) => props.indexOf(prop) === index);
}

export function getLegacyProfileProps(props: readonly PropType[]): PropType[] {
  return uniqueProfileProps(props).filter((prop) => !isProfilePropChoice(prop));
}

export function getSelectedFamilyVariants(
  props: readonly PropType[],
  family: ProfilePropFamily
): PropType[] {
  const selected = new Set(props);
  return family.variants.filter((variant) => selected.has(variant));
}

export function ensureProfilePropFamily(
  props: readonly PropType[],
  representative: PropType
): PropType[] {
  const family = getProfilePropFamilyByRepresentative(representative);
  if (!family) return uniqueProfileProps(props);
  if (getSelectedFamilyVariants(props, family).length > 0) {
    return uniqueProfileProps(props);
  }
  return uniqueProfileProps([...props, family.representative]);
}

export function toggleProfilePropVariant(
  props: readonly PropType[],
  prop: PropType
): PropType[] {
  if (!isProfilePropChoice(prop)) return uniqueProfileProps(props);
  return props.includes(prop)
    ? uniqueProfileProps(props.filter((selected) => selected !== prop))
    : uniqueProfileProps([...props, prop]);
}

export function removeProfileProp(
  props: readonly PropType[],
  prop: PropType
): PropType[] {
  return uniqueProfileProps(props.filter((selected) => selected !== prop));
}

export function profileFamilyRepresentative(prop: PropType): PropType {
  return getProfilePropFamily(prop)?.representative ?? getBasePropType(prop);
}
