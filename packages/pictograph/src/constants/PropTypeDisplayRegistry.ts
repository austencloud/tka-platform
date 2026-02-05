import { PropType } from "@tka/types";

export interface PropTypeDisplayInfo {
  label: string;
  image: string;
}

export const PROP_TYPE_DISPLAY_REGISTRY: Record<PropType, PropTypeDisplayInfo> =
  {
    [PropType.STAFF]: { label: "Staff", image: "/images/props/staff.svg?v=2" },
    [PropType.SIMPLESTAFF]: {
      label: "Simple Staff",
      image: "/images/props/simple_staff.svg?v=2",
    },
    [PropType.BIGSTAFF]: {
      label: "Big Staff",
      image: "/images/props/bigstaff.svg?v=2",
    },
    [PropType.STAFF2]: {
      label: "Staff V2",
      image: "/images/props/staff_v2.svg?v=2",
    },
    [PropType.CLUB]: { label: "Club", image: "/images/props/club.svg" },
    [PropType.BIGCLUB]: {
      label: "Big Club",
      image: "/images/props/bigclub.svg",
    },
    [PropType.FAN]: { label: "Fan", image: "/images/props/fan.svg" },
    [PropType.BIGFAN]: { label: "Big Fan", image: "/images/props/bigfan.svg" },
    [PropType.TRIAD]: { label: "Triad", image: "/images/props/triad.svg" },
    [PropType.BIGTRIAD]: {
      label: "Big Triad",
      image: "/images/props/bigtriad.svg",
    },
    [PropType.MINIHOOP]: {
      label: "Mini Hoop",
      image: "/images/props/minihoop.svg",
    },
    [PropType.BIGHOOP]: {
      label: "Big Hoop",
      image: "/images/props/bighoop.svg",
    },
    [PropType.BUUGENG]: {
      label: "Buugeng",
      image: "/images/props/buugeng.svg",
    },
    [PropType.BIGBUUGENG]: {
      label: "Big Buugeng",
      image: "/images/props/bigbuugeng.svg",
    },
    [PropType.FRACTALGENG]: {
      label: "Fractalgeng",
      image: "/images/props/fractalgeng.svg",
    },
    [PropType.HAND]: { label: "Hand", image: "/images/props/hand.svg" },
    [PropType.TRIQUETRA]: {
      label: "Triquetra",
      image: "/images/props/triquetra.svg",
    },
    [PropType.TRIQUETRA2]: {
      label: "Triquetra 2",
      image: "/images/props/triquetra2.svg",
    },
    [PropType.SWORD]: { label: "Sword", image: "/images/props/sword.svg" },
    [PropType.CHICKEN]: {
      label: "Chicken",
      image: "/images/props/chicken.svg",
    },
    [PropType.BIGCHICKEN]: {
      label: "Big Chicken",
      image: "/images/props/bigchicken.svg",
    },
    [PropType.GUITAR]: { label: "Guitar", image: "/images/props/guitar.svg" },
    [PropType.UKULELE]: {
      label: "Ukulele",
      image: "/images/props/ukulele.svg",
    },
    [PropType.DOUBLESTAR]: {
      label: "Double Star",
      image: "/images/props/doublestar.svg",
    },
    [PropType.BIGDOUBLESTAR]: {
      label: "Big Double Star",
      image: "/images/props/bigdoublestar.svg",
    },
    [PropType.EIGHTRINGS]: {
      label: "Eight Rings",
      image: "/images/props/eightrings.svg",
    },
    [PropType.BIGEIGHTRINGS]: {
      label: "Big Eight Rings",
      image: "/images/props/bigeightrings.svg",
    },
    [PropType.QUIAD]: { label: "Quiad", image: "/images/props/quiad.svg" },
    [PropType.POI]: { label: "Poi", image: "/images/props/club.svg" },
  } as const;

export function getAllPropTypes(): PropType[] {
  return Object.keys(PROP_TYPE_DISPLAY_REGISTRY) as PropType[];
}

export function getPropTypeDisplayInfo(
  propType: PropType
): PropTypeDisplayInfo {
  return PROP_TYPE_DISPLAY_REGISTRY[propType];
}

export function findPropTypeByValue(value: string): PropType | undefined {
  const normalized = value.toLowerCase();
  return getAllPropTypes().find((pt) => pt.toLowerCase() === normalized);
}

export const VARIANT_PROP_TYPES: PropType[] = [
  PropType.SIMPLESTAFF,
  PropType.BIGSTAFF,
  PropType.STAFF2,
  PropType.BIGCLUB,
  PropType.BIGFAN,
  PropType.BIGTRIAD,
  PropType.BIGHOOP,
  PropType.BIGBUUGENG,
  PropType.FRACTALGENG,
  PropType.TRIQUETRA2,
  PropType.BIGCHICKEN,
  PropType.UKULELE,
  PropType.BIGDOUBLESTAR,
  PropType.BIGEIGHTRINGS,
];

const VARIANT_TO_BASE: Partial<Record<PropType, PropType>> = {
  [PropType.SIMPLESTAFF]: PropType.STAFF,
  [PropType.BIGSTAFF]: PropType.STAFF,
  [PropType.STAFF2]: PropType.STAFF,
  [PropType.BIGCLUB]: PropType.CLUB,
  [PropType.BIGFAN]: PropType.FAN,
  [PropType.BIGTRIAD]: PropType.TRIAD,
  [PropType.BIGHOOP]: PropType.MINIHOOP,
  [PropType.BIGBUUGENG]: PropType.BUUGENG,
  [PropType.FRACTALGENG]: PropType.BUUGENG,
  [PropType.TRIQUETRA2]: PropType.TRIQUETRA,
  [PropType.BIGCHICKEN]: PropType.CHICKEN,
  [PropType.UKULELE]: PropType.GUITAR,
  [PropType.BIGDOUBLESTAR]: PropType.DOUBLESTAR,
  [PropType.BIGEIGHTRINGS]: PropType.EIGHTRINGS,
};

const BASE_TO_VARIANTS: Partial<Record<PropType, PropType[]>> = {
  [PropType.STAFF]: [PropType.SIMPLESTAFF, PropType.BIGSTAFF, PropType.STAFF2],
  [PropType.CLUB]: [PropType.BIGCLUB],
  [PropType.FAN]: [PropType.BIGFAN],
  [PropType.TRIAD]: [PropType.BIGTRIAD],
  [PropType.MINIHOOP]: [PropType.BIGHOOP],
  [PropType.BUUGENG]: [PropType.BIGBUUGENG, PropType.FRACTALGENG],
  [PropType.TRIQUETRA]: [PropType.TRIQUETRA2],
  [PropType.CHICKEN]: [PropType.BIGCHICKEN],
  [PropType.GUITAR]: [PropType.UKULELE],
  [PropType.DOUBLESTAR]: [PropType.BIGDOUBLESTAR],
  [PropType.EIGHTRINGS]: [PropType.BIGEIGHTRINGS],
};

export function hasVariations(propType: PropType): boolean {
  return (
    BASE_TO_VARIANTS[propType] !== undefined ||
    VARIANT_TO_BASE[propType] !== undefined
  );
}

export function getBasePropType(propType: PropType): PropType {
  return VARIANT_TO_BASE[propType] ?? propType;
}

export function getAllVariations(propType: PropType): PropType[] {
  const base = getBasePropType(propType);
  const variants = BASE_TO_VARIANTS[base];
  return variants ? [base, ...variants] : [base];
}

export function getNextVariation(propType: PropType): PropType {
  const base = getBasePropType(propType);
  const variants = BASE_TO_VARIANTS[base];

  if (!variants || variants.length === 0) {
    return propType;
  }

  if (propType === base) {
    return variants[0] ?? base;
  }

  const currentIndex = variants.indexOf(propType);
  if (currentIndex === variants.length - 1) {
    return base;
  }
  const nextVariant = variants[currentIndex + 1];
  return nextVariant ?? base;
}

export function getVariationLabel(propType: PropType): string {
  const base = getBasePropType(propType);
  const variants = BASE_TO_VARIANTS[base];

  if (!variants || variants.length === 0) {
    return "";
  }

  if (propType === base) {
    return "Ver 1";
  }

  const index = variants.indexOf(propType);
  if (index >= 0) {
    return `Ver ${index + 2}`;
  }

  return "";
}

export function getVariationIndex(propType: PropType): number {
  const base = getBasePropType(propType);
  if (propType === base) return 0;

  const variants = BASE_TO_VARIANTS[base];
  if (!variants) return 0;

  const index = variants.indexOf(propType);
  return index >= 0 ? index + 1 : 0;
}

export function getTriquetraVariation(propType: PropType): number {
  if (propType === PropType.TRIQUETRA) return 1;
  if (propType === PropType.TRIQUETRA2) return 2;
  return 1;
}
