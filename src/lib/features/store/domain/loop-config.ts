/**
 * LOOP deck configurator v2 domain: the three dials (level, length, flavor),
 * their Mix options, curated-blend copy, availability gating, and the checkout
 * config shape. Flat $30 across the board — ONE product + ONE Stripe price;
 * the configuration rides checkout metadata into the order doc (the propType
 * pattern). Blend recipes are OURS: buyers pick a chip, never a percentage.
 *
 * The firebase function keeps a mirrored whitelist of these values
 * (createMerchCheckout — it can't import client code); keep them in sync.
 *
 * Spec: docs/superpowers/specs/2026-07-10-loop-deck-configurator-v2-design.md
 */

export const LOOP_LEVELS = ["1", "2", "3", "mix"] as const;
export type LoopLevel = (typeof LOOP_LEVELS)[number];

export const LOOP_LENGTHS = ["8", "12", "16", "mix"] as const;
export type LoopLength = (typeof LOOP_LENGTHS)[number];

/** "variety" + the flavor SKU listing slugs (derived from live products at
 *  runtime for display; this list is the checkout whitelist). */
export const LOOP_FLAVORS = [
  "variety",
  "rotated",
  "mirrored",
  "swapped",
  "inverted",
  "mirrored-swapped",
  "mirrored-inverted",
  "mirrored-swapped-inverted",
] as const;
export type LoopFlavor = (typeof LOOP_FLAVORS)[number];

export interface LoopConfig {
  level: LoopLevel;
  length: LoopLength;
  flavor: LoopFlavor;
  /** Present ONLY when the advanced panel was touched. */
  custom?: {
    /** Blend balance for level "mix". */
    levelBalance?: "mostly-1" | "even" | "mostly-spicy";
    /** Flavors excluded from the variety grab bag. */
    excludeFlavors?: LoopFlavor[];
  };
}

/** Page loads buyable untouched: Level 1 · 8-count · Variety. */
export const DEFAULT_LOOP_CONFIG: LoopConfig = {
  level: "1",
  length: "8",
  flavor: "variety",
};

/** One muted line per Mix chip — the feel of the blend, never percentages. */
export const LEVEL_MIX_COPY = "Mostly Level 1. A few cards that bite.";
export const LENGTH_MIX_COPY = "Mostly eight-counts, with a few longer runs.";
export const VARIETY_COPY =
  "Mostly rotated quartered LOOPs, with a grab bag of the other flavors.";

/**
 * Inventory gating, derived from what's actually enumerated today:
 * Level 1 fully stocked; Level 2 exists for rotated only; Level 3 and the
 * 12/16 lengths have no enumerated decks yet. Mix chips stay live — their
 * recipes draw from stocked pools.
 */
export const AVAILABLE_LEVELS: readonly LoopLevel[] = ["1", "2", "mix"];
export const AVAILABLE_LENGTHS: readonly LoopLength[] = ["8", "mix"];

/** Flavors purchasable at a given level (Level 2 enumeration = rotated only). */
export function availableFlavors(level: LoopLevel): readonly LoopFlavor[] {
  if (level === "2") return ["variety", "rotated"];
  return LOOP_FLAVORS;
}

/** Maps a flavor SKU's deckId/loopComponents to its config slug. */
export function flavorSlugFromComponents(components: string[]): LoopFlavor | null {
  const set = new Set(components.map((c) => c.toLowerCase()));
  const slug = [...set].sort().join("-");
  const match = LOOP_FLAVORS.find(
    (f) => f !== "variety" && [...f.split("-")].sort().join("-") === slug
  );
  return match ?? null;
}
