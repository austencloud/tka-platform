import { PropType } from "./enums/prop-type";

export type PropCategory = "staves-clubs" | "curved" | "novelty" | "singles";

export const PROP_CATEGORIES: { id: PropCategory; label: string }[] = [
  { id: "staves-clubs", label: "Staves & Clubs" },
  { id: "curved", label: "Curved Props" },
  { id: "novelty", label: "Novelty" },
  { id: "singles", label: "Singles" },
];

/**
 * Display metadata for a prop type
 */
export interface PropTypeDisplayInfo {
  /** Display label for the prop type */
  label: string;
  /** Path to the prop's SVG image */
  image: string;
  category?: PropCategory;
}

/**
 * Registry mapping PropType enum values to their display metadata.
 * This is the single source of truth for prop type UI display information.
 */
export const PROP_TYPE_DISPLAY_REGISTRY: Record<PropType, PropTypeDisplayInfo> =
  {
    // === STAFF FAMILY ===
    [PropType.STAFF]: { label: "Staff", image: "/images/props/buttons/staff.svg?v=2", category: "staves-clubs" },
    [PropType.SIMPLESTAFF]: {
      label: "Simple Staff",
      image: "/images/props/buttons/simple_staff.svg?v=2",
    },
    [PropType.BIGSTAFF]: {
      label: "Big Staff",
      image: "/images/props/buttons/bigstaff.svg?v=2",
    },
    [PropType.STAFF2]: {
      label: "Staff V2",
      image: "/images/props/buttons/staff_v2.svg?v=2",
    },

    // === CLUB FAMILY ===
    [PropType.CLUB]: { label: "Club", image: "/images/props/buttons/club.svg", category: "staves-clubs" },
    [PropType.BIGCLUB]: {
      label: "Big Club",
      image: "/images/props/buttons/bigclub.svg",
    },

    // === FAN FAMILY ===
    [PropType.FAN]: { label: "Fan", image: "/images/props/buttons/fan.svg", category: "staves-clubs" },
    [PropType.BIGFAN]: { label: "Big Fan", image: "/images/props/buttons/bigfan.svg" },

    // === TRIAD FAMILY ===
    [PropType.TRIAD]: { label: "Triad", image: "/images/props/buttons/triad.svg", category: "curved" },
    [PropType.BIGTRIAD]: {
      label: "Big Triad",
      image: "/images/props/buttons/bigtriad.svg",
    },

    // === HOOP FAMILY ===
    [PropType.MINIHOOP]: {
      label: "Mini Hoop",
      image: "/images/props/buttons/minihoop.svg",
      category: "curved",
    },
    [PropType.BIGHOOP]: {
      label: "Big Hoop",
      image: "/images/props/buttons/bighoop.svg",
    },

    // === BUUGENG FAMILY ===
    [PropType.BUUGENG]: {
      label: "Buugeng",
      image: "/images/props/buttons/buugeng.svg",
      category: "curved",
    },
    [PropType.BIGBUUGENG]: {
      label: "Big Buugeng",
      image: "/images/props/buttons/bigbuugeng.svg",
    },

    // === TRIGENG FAMILY ===
    [PropType.TRIGENG]: {
      label: "Trigeng",
      image: "/images/props/buttons/trigeng.svg",
      category: "curved",
    },

    // === HAND ===
    [PropType.HAND]: { label: "Hand", image: "/images/props/buttons/hand.svg", category: "singles" },

    // === TRIQUETRA FAMILY ===
    [PropType.TRIQUETRA]: {
      label: "Triquetra",
      image: "/images/props/buttons/triquetra.svg",
      category: "curved",
    },
    [PropType.TRIQUETRA2]: {
      label: "Triquetra 2",
      image: "/images/props/buttons/triquetra2.svg",
    },

    // === SWORD ===
    [PropType.SWORD]: { label: "Sword", image: "/images/props/buttons/sword.svg", category: "singles" },

    // === CHICKEN FAMILY ===
    [PropType.CHICKEN]: {
      label: "Chicken",
      image: "/images/props/buttons/chicken.svg",
      category: "novelty",
    },
    [PropType.BIGCHICKEN]: {
      label: "Big Chicken",
      image: "/images/props/buttons/bigchicken.svg",
    },

    // === GUITAR FAMILY ===
    [PropType.GUITAR]: { label: "Guitar", image: "/images/props/buttons/guitar.svg", category: "novelty" },
    [PropType.UKULELE]: {
      label: "Ukulele",
      image: "/images/props/buttons/ukulele.svg",
    },

    // === DOUBLESTAR FAMILY ===
    [PropType.DOUBLESTAR]: {
      label: "Double Star",
      image: "/images/props/buttons/doublestar.svg",
      category: "novelty",
    },
    [PropType.BIGDOUBLESTAR]: {
      label: "Big Double Star",
      image: "/images/props/buttons/bigdoublestar.svg",
    },

    // === EIGHTRINGS FAMILY ===
    [PropType.EIGHTRINGS]: {
      label: "Eight Rings",
      image: "/images/props/buttons/eightrings.svg",
      category: "novelty",
    },
    [PropType.BIGEIGHTRINGS]: {
      label: "Big Eight Rings",
      image: "/images/props/buttons/bigeightrings.svg",
    },

    // === QUIAD ===
    [PropType.QUIAD]: { label: "Quiad", image: "/images/props/buttons/quiad.svg", category: "singles" },

    // === TORCH FAMILY ===
    [PropType.TORCH]: { label: "Torch", image: "/images/props/buttons/torch.svg", category: "novelty" },
    [PropType.BIGTORCH]: { label: "Big Torch", image: "/images/props/buttons/bigtorch.svg" },

    // === CONTACT BALL FAMILY ===
    [PropType.CONTACTBALL]: {
      label: "Contact Ball",
      image: "/images/props/buttons/contactball.svg",
      category: "novelty",
    },
    [PropType.BIGCONTACTBALL]: {
      label: "Big Contact Ball",
      image: "/images/props/buttons/bigcontactball.svg",
    },
    [PropType.DOUBLECONTACTBALL]: {
      label: "Double Contact Ball",
      image: "/images/props/buttons/doublecontactball.svg",
      category: "novelty",
    },
    [PropType.BIGDOUBLECONTACTBALL]: {
      label: "Big Double Contact Ball",
      image: "/images/props/buttons/bigdoublecontactball.svg",
    },

    // === POI FAMILY (Momentum-based) ===
    [PropType.POI]: { label: "Poi", image: "/images/props/buttons/poi.svg", category: "novelty" },
  } as const;

/**
 * Props temporarily deactivated from selection UIs.
 * They still exist in the enum, registry, and saved data - just hidden from pickers.
 * Remove from this set to reactivate.
 */
export const DEACTIVATED_PROP_TYPES: ReadonlySet<PropType> = new Set([
  PropType.BIGFAN,
  PropType.GUITAR,
  PropType.UKULELE,
  PropType.CONTACTBALL,
  PropType.BIGCONTACTBALL,
  PropType.BIGDOUBLECONTACTBALL,
  // Poi stays deactivated for the category pickers. BentoPropGrid re-includes it
  // for dev/admin only, to exercise the poi-legal composer filter.
  // (Fractalgeng removed 2026-06-30.)
  PropType.POI,
]);

/**
 * Whether a prop type is currently active (not deactivated).
 */
export function isPropActive(propType: PropType): boolean {
  return !DEACTIVATED_PROP_TYPES.has(propType);
}

/**
 * Gets all available prop types in display order.
 */
export function getAllPropTypes(): PropType[] {
  return Object.keys(PROP_TYPE_DISPLAY_REGISTRY) as PropType[];
}

/**
 * Gets display information for a specific prop type.
 */
export function getPropTypeDisplayInfo(
  propType: PropType
): PropTypeDisplayInfo {
  return PROP_TYPE_DISPLAY_REGISTRY[propType];
}

/**
 * Finds a prop type by its string value (case-insensitive).
 * Useful for parsing user input or legacy data.
 */
export function findPropTypeByValue(value: string): PropType | undefined {
  const normalized = value.toLowerCase();
  return getAllPropTypes().find((pt) => pt.toLowerCase() === normalized);
}

/**
 * Prop types that are variations of a base prop type.
 * These are displayed as toggle options on the base prop card.
 * When selecting a base prop, variations are hidden from the main grid.
 */
export const VARIANT_PROP_TYPES: PropType[] = [
  // Staff family
  PropType.SIMPLESTAFF,
  PropType.BIGSTAFF,
  PropType.STAFF2,
  // Club family
  PropType.BIGCLUB,
  // Fan family
  PropType.BIGFAN,
  // Triad family
  PropType.BIGTRIAD,
  // Hoop family
  PropType.BIGHOOP,
  // Buugeng family
  PropType.BIGBUUGENG,
  // Triquetra family
  PropType.TRIQUETRA2,
  // Chicken family
  PropType.BIGCHICKEN,
  // Guitar family
  PropType.UKULELE,
  // Doublestar family
  PropType.BIGDOUBLESTAR,
  // Eightrings family
  PropType.BIGEIGHTRINGS,
  // Contact ball family (DOUBLECONTACTBALL is now standalone)
  PropType.BIGCONTACTBALL,
  PropType.BIGDOUBLECONTACTBALL,
  // Torch family
  PropType.BIGTORCH,
];

/**
 * Mapping from variant prop types to their base prop types.
 */
const VARIANT_TO_BASE: Partial<Record<PropType, PropType>> = {
  // Staff variations
  [PropType.SIMPLESTAFF]: PropType.STAFF,
  [PropType.BIGSTAFF]: PropType.STAFF,
  [PropType.STAFF2]: PropType.STAFF,
  // Club variations
  [PropType.BIGCLUB]: PropType.CLUB,
  // Fan variations
  [PropType.BIGFAN]: PropType.FAN,
  // Triad variations
  [PropType.BIGTRIAD]: PropType.TRIAD,
  // Hoop variations
  [PropType.BIGHOOP]: PropType.MINIHOOP,
  // Buugeng variations
  [PropType.BIGBUUGENG]: PropType.BUUGENG,
  // Triquetra variations
  [PropType.TRIQUETRA2]: PropType.TRIQUETRA,
  // Chicken variations
  [PropType.BIGCHICKEN]: PropType.CHICKEN,
  // Guitar variations
  [PropType.UKULELE]: PropType.GUITAR,
  // Doublestar variations
  [PropType.BIGDOUBLESTAR]: PropType.DOUBLESTAR,
  // Eightrings variations
  [PropType.BIGEIGHTRINGS]: PropType.EIGHTRINGS,
  // Contact ball variations (CONTACTBALL, BIGCONTACTBALL, BIGDOUBLECONTACTBALL deactivated)
  [PropType.BIGCONTACTBALL]: PropType.CONTACTBALL,
  [PropType.BIGDOUBLECONTACTBALL]: PropType.CONTACTBALL,
  // DOUBLECONTACTBALL is now standalone (not a variant) since its base is deactivated
  // Torch variations
  [PropType.BIGTORCH]: PropType.TORCH,
};

/**
 * Mapping from base prop types to their variant prop types.
 * Order matters - this determines the cycle order when toggling.
 */
const BASE_TO_VARIANTS: Partial<Record<PropType, PropType[]>> = {
  [PropType.STAFF]: [PropType.SIMPLESTAFF, PropType.BIGSTAFF, PropType.STAFF2],
  [PropType.CLUB]: [PropType.BIGCLUB],
  [PropType.FAN]: [PropType.BIGFAN],
  [PropType.TRIAD]: [PropType.BIGTRIAD],
  [PropType.MINIHOOP]: [PropType.BIGHOOP],
  [PropType.BUUGENG]: [PropType.BIGBUUGENG],
  [PropType.TRIQUETRA]: [PropType.TRIQUETRA2],
  [PropType.CHICKEN]: [PropType.BIGCHICKEN],
  [PropType.GUITAR]: [PropType.UKULELE],
  [PropType.DOUBLESTAR]: [PropType.BIGDOUBLESTAR],
  [PropType.EIGHTRINGS]: [PropType.BIGEIGHTRINGS],
  [PropType.CONTACTBALL]: [PropType.BIGCONTACTBALL, PropType.BIGDOUBLECONTACTBALL],
  [PropType.TORCH]: [PropType.BIGTORCH],
};

/**
 * Checks if a prop type has variations available.
 */
export function hasVariations(propType: PropType): boolean {
  return (
    BASE_TO_VARIANTS[propType] !== undefined ||
    VARIANT_TO_BASE[propType] !== undefined
  );
}

/**
 * Gets the base prop type for a variant (or returns itself if not a variant).
 */
export function getBasePropType(propType: PropType): PropType {
  return VARIANT_TO_BASE[propType] ?? propType;
}

/**
 * Gets all variations for a prop type (including the base).
 */
export function getAllVariations(propType: PropType): PropType[] {
  const base = getBasePropType(propType);
  const variants = BASE_TO_VARIANTS[base];
  return variants ? [base, ...variants] : [base];
}

/**
 * Gets the next variation for a prop type (cycles through variants).
 */
export function getNextVariation(propType: PropType): PropType {
  const base = getBasePropType(propType);
  const variants = BASE_TO_VARIANTS[base];

  if (!variants || variants.length === 0) {
    return propType;
  }

  // If current is the base, return first variant
  if (propType === base) {
    return variants[0] ?? base;
  }

  // Find current in variants and return next (or cycle back to base)
  const currentIndex = variants.indexOf(propType);
  if (currentIndex === variants.length - 1) {
    return base;
  }
  const nextVariant = variants[currentIndex + 1];
  return nextVariant ?? base;
}

/**
 * Gets a display label for the variation (e.g., "Ver 1", "Ver 2").
 */
export function getVariationLabel(propType: PropType): string {
  const base = getBasePropType(propType);
  const variants = BASE_TO_VARIANTS[base];

  if (!variants || variants.length === 0) {
    return "";
  }

  // Base is version 1
  if (propType === base) {
    return "Ver 1";
  }

  // Find index in variants
  const index = variants.indexOf(propType);
  if (index >= 0) {
    return `Ver ${index + 2}`;
  }

  return "";
}

/**
 * Gets the variation index (0-based) for a prop type within its variation group.
 */
export function getVariationIndex(propType: PropType): number {
  const base = getBasePropType(propType);
  if (propType === base) return 0;

  const variants = BASE_TO_VARIANTS[base];
  if (!variants) return 0;

  const index = variants.indexOf(propType);
  return index >= 0 ? index + 1 : 0;
}

/**
 * Gets the triquetra variation number (1 or 2).
 * @deprecated Use getVariationIndex instead for generic variation support.
 */
export function getTriquetraVariation(propType: PropType): number {
  if (propType === PropType.TRIQUETRA) return 1;
  if (propType === PropType.TRIQUETRA2) return 2;
  return 1;
}

/**
 * Returns base props grouped by category, filtered by isPropActive and excluding variants.
 */
export function getBasePropsByCategory(): Map<PropCategory, PropType[]> {
  const result = new Map<PropCategory, PropType[]>();
  for (const cat of PROP_CATEGORIES) {
    result.set(cat.id, []);
  }

  for (const [propTypeStr, info] of Object.entries(PROP_TYPE_DISPLAY_REGISTRY)) {
    const propType = propTypeStr as PropType;
    if (!info.category) continue;
    if (!isPropActive(propType)) continue;
    if (VARIANT_PROP_TYPES.includes(propType)) continue;
    result.get(info.category)?.push(propType);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Size modifier (props-tab Phase 2) — standard ⇄ big pairs
// ---------------------------------------------------------------------------

/**
 * Standard → Big size-variant pairs. Drives the "Big" modifier toggle on the
 * prop readout: a prop can be flipped to its big version (and back) without
 * hunting the Big section. Note minihoop pairs with bighoop.
 */
const STANDARD_TO_BIG: Partial<Record<PropType, PropType>> = {
  [PropType.STAFF]: PropType.BIGSTAFF,
  [PropType.CLUB]: PropType.BIGCLUB,
  [PropType.TRIAD]: PropType.BIGTRIAD,
  [PropType.MINIHOOP]: PropType.BIGHOOP,
  [PropType.BUUGENG]: PropType.BIGBUUGENG,
  [PropType.EIGHTRINGS]: PropType.BIGEIGHTRINGS,
  [PropType.TORCH]: PropType.BIGTORCH,
  [PropType.CHICKEN]: PropType.BIGCHICKEN,
  [PropType.DOUBLESTAR]: PropType.BIGDOUBLESTAR,
};

const BIG_TO_STANDARD: Partial<Record<PropType, PropType>> = Object.fromEntries(
  Object.entries(STANDARD_TO_BIG).map(([std, big]) => [big, std]),
) as Partial<Record<PropType, PropType>>;

/** Whether a prop has a standard⇄big counterpart (either direction). */
export function hasBigVariant(propType: PropType): boolean {
  return propType in STANDARD_TO_BIG || propType in BIG_TO_STANDARD;
}

/** Whether a prop is currently the big size. */
export function isBigVariant(propType: PropType): boolean {
  return propType in BIG_TO_STANDARD;
}

/** Toggle a prop between its standard and big size. Returns it unchanged if it
 *  has no size counterpart. */
export function toggleBigVariant(propType: PropType): PropType {
  return STANDARD_TO_BIG[propType] ?? BIG_TO_STANDARD[propType] ?? propType;
}

/**
 * Flat prop-picker sections (props-tab redesign, 2026-06-18).
 *
 * Single source of truth for the FLAT prop grid (`BentoPropGrid`): every listed
 * prop renders as its own button under one of three section headers — no
 * popover, no variant-drill. This is intentionally separate from the shared
 * `category` taxonomy + variant maps above (consumed by PropPopover,
 * MyPropsDrawer, composition recipes, …), which are left untouched.
 *
 * Curation: props NOT listed here are simply absent from the picker. Simple
 * Staff (backend thumb-orientation prop), Staff V2, and Hand (hand-path teaching
 * only) stay fully wired elsewhere but off the picker. Poi IS listed here but
 * dark-gated in BentoPropGrid (dev/admin only, matching the poi-legal filter
 * gate), so the public picker still omits it while the filter is validated.
 * (Fractalgeng was removed from the codebase entirely.)
 *
 * Rendering filters by isPropActive, so deactivating a listed prop hides it
 * without editing this list.
 */
export const PROP_PICKER_SECTIONS: { label: string; props: PropType[] }[] = [
  {
    label: "Standard",
    props: [
      PropType.STAFF,
      PropType.CLUB,
      PropType.FAN,
      PropType.TRIAD,
      PropType.MINIHOOP,
      PropType.BUUGENG,
      PropType.TRIGENG,
      PropType.EIGHTRINGS,
      PropType.DOUBLECONTACTBALL,
      PropType.TORCH,
      PropType.SWORD,
    ],
  },
  {
    label: "Big",
    props: [
      PropType.BIGSTAFF,
      PropType.BIGCLUB,
      PropType.BIGTRIAD,
      PropType.BIGHOOP,
      PropType.BIGBUUGENG,
      PropType.BIGEIGHTRINGS,
      PropType.BIGTORCH,
      PropType.BIGCHICKEN,
      PropType.BIGDOUBLESTAR,
    ],
  },
  {
    label: "Novelty",
    props: [
      PropType.CHICKEN,
      PropType.DOUBLESTAR,
      PropType.QUIAD,
      PropType.TRIQUETRA,
      PropType.TRIQUETRA2,
      // Dark-gated to dev/admin in BentoPropGrid — see the docstring above.
      PropType.POI,
    ],
  },
];
