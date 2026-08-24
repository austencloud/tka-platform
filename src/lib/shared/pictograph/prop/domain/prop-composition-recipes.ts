import { PropType } from "./enums/prop-type";
import { getBasePropType } from "./prop-type-display-registry";

/**
 * Transform parameters for one prop in a paired composition.
 * Coordinates are in a 0-100 viewBox space.
 */
export interface PropTransform {
  /** X position (0-100, center of viewBox) */
  x: number;
  /** Y position (0-100, center of viewBox) */
  y: number;
  /** Rotation in degrees */
  rotation: number;
  /** Scale factor (1 = natural size) */
  scale: number;
}

/**
 * A composition recipe defines how two props (blue + red) are arranged
 * to create an aesthetically pleasing paired preview.
 */
export interface CompositionRecipe {
  blue: PropTransform;
  red: PropTransform;
  /** Overall scale applied to both props (shrinks the pair to fit the viewBox) */
  pairScale: number;
}

/**
 * Default composition recipes per base prop family.
 * These are starting points - tune in the Prop Button Lab tab.
 *
 * Each recipe assumes a viewBox of "0 0 100 100".
 * x/y are the center point of each prop image within that viewBox.
 */
const FAMILY_RECIPES: Partial<Record<PropType, CompositionRecipe>> = {
  // Staves: crossed in an X
  [PropType.STAFF]: {
    blue: { x: 50, y: 50, rotation: -45, scale: 0.55 },
    red: { x: 50, y: 50, rotation: 45, scale: 0.55 },
    pairScale: 1,
  },
  // Fans: facing each other (beta-like)
  [PropType.FAN]: {
    blue: { x: 35, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 65, y: 50, rotation: 180, scale: 0.45 },
    pairScale: 1,
  },
  // Clubs: angled V, handles meeting
  [PropType.CLUB]: {
    blue: { x: 35, y: 50, rotation: -20, scale: 0.5 },
    red: { x: 65, y: 50, rotation: 20, scale: 0.5 },
    pairScale: 1,
  },
  // Buugengs: interlocked S-curves
  [PropType.BUUGENG]: {
    blue: { x: 35, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 65, y: 50, rotation: 180, scale: 0.45 },
    pairScale: 1,
  },
  // Hoops: overlapping circles (Venn)
  [PropType.MINIHOOP]: {
    blue: { x: 38, y: 50, rotation: 0, scale: 0.5 },
    red: { x: 62, y: 50, rotation: 0, scale: 0.5 },
    pairScale: 1,
  },
  // Triads: rotational offset
  [PropType.TRIAD]: {
    blue: { x: 38, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 62, y: 50, rotation: 60, scale: 0.45 },
    pairScale: 1,
  },
  // Triquetras: interlocking geometry
  [PropType.TRIQUETRA]: {
    blue: { x: 38, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 62, y: 50, rotation: 60, scale: 0.45 },
    pairScale: 1,
  },
  // Chickens: mirrored pair
  [PropType.CHICKEN]: {
    blue: { x: 35, y: 50, rotation: 10, scale: 0.45 },
    red: { x: 65, y: 50, rotation: -10, scale: 0.45 },
    pairScale: 1,
  },
  // Guitars: side by side, slight angle
  [PropType.GUITAR]: {
    blue: { x: 35, y: 50, rotation: -15, scale: 0.45 },
    red: { x: 65, y: 50, rotation: 15, scale: 0.45 },
    pairScale: 1,
  },
  // Double Stars: overlapping offset
  [PropType.DOUBLESTAR]: {
    blue: { x: 38, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 62, y: 50, rotation: 30, scale: 0.45 },
    pairScale: 1,
  },
  // Eight Rings: side by side
  [PropType.EIGHTRINGS]: {
    blue: { x: 38, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 62, y: 50, rotation: 0, scale: 0.45 },
    pairScale: 1,
  },
  // Contact Balls: side by side (spheres)
  [PropType.CONTACTBALL]: {
    blue: { x: 38, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 62, y: 50, rotation: 0, scale: 0.45 },
    pairScale: 1,
  },
  // Torches: crossed
  [PropType.TORCH]: {
    blue: { x: 50, y: 50, rotation: -30, scale: 0.5 },
    red: { x: 50, y: 50, rotation: 30, scale: 0.5 },
    pairScale: 1,
  },
  // Hand: mirrored pair (left/right hands)
  [PropType.HAND]: {
    blue: { x: 35, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 65, y: 50, rotation: 0, scale: 0.45 },
    pairScale: 1,
  },
  // Sword: crossed swords
  [PropType.SWORD]: {
    blue: { x: 50, y: 50, rotation: -40, scale: 0.55 },
    red: { x: 50, y: 50, rotation: 40, scale: 0.55 },
    pairScale: 1,
  },
  // Sickles: mirrored fighting pair, blades opening away from each other
  [PropType.SICKLES]: {
    blue: { x: 45, y: 51, rotation: -28, scale: 0.48 },
    red: { x: 55, y: 49, rotation: 152, scale: 0.48 },
    pairScale: 1,
  },
  // Energy Saber: crossed, matching its sword parent
  [PropType.ENERGY_SABER]: {
    blue: { x: 50, y: 50, rotation: -40, scale: 0.55 },
    red: { x: 50, y: 50, rotation: 40, scale: 0.55 },
    pairScale: 1,
  },
  // Energy Staff: crossed in an X, matching its staff parent
  [PropType.ENERGY_STAFF]: {
    blue: { x: 50, y: 50, rotation: -45, scale: 0.55 },
    red: { x: 50, y: 50, rotation: 45, scale: 0.55 },
    pairScale: 1,
  },
  // Quiad: side by side
  [PropType.QUIAD]: {
    blue: { x: 38, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 62, y: 50, rotation: 0, scale: 0.45 },
    pairScale: 1,
  },
  // Trigeng: facing each other
  [PropType.TRIGENG]: {
    blue: { x: 35, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 65, y: 50, rotation: 180, scale: 0.45 },
    pairScale: 1,
  },
};

/** Fallback recipe for any prop type not explicitly mapped */
const DEFAULT_RECIPE: CompositionRecipe = {
  blue: { x: 35, y: 50, rotation: 10, scale: 0.45 },
  red: { x: 65, y: 50, rotation: -10, scale: 0.45 },
  pairScale: 1,
};

/**
 * Gets the composition recipe for a prop type.
 * Variants inherit from their base family.
 */
export function getCompositionRecipe(propType: PropType): CompositionRecipe {
  const base = getBasePropType(propType);
  return FAMILY_RECIPES[base] ?? FAMILY_RECIPES[propType] ?? DEFAULT_RECIPE;
}

/**
 * All base prop types that have explicit recipes.
 * Used by the lab tab to display all configurable families.
 */
export function getRecipeFamilies(): {
  propType: PropType;
  recipe: CompositionRecipe;
}[] {
  return Object.entries(FAMILY_RECIPES).map(([key, recipe]) => ({
    propType: key as PropType,
    recipe,
  }));
}
