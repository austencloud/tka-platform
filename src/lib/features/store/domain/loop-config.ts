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

/** "variety" + every LOOP type the generation engine implements (the buyer
 *  picks through the generate panel's LOOP overlay, which exposes them all).
 *  This list is the checkout whitelist — the firebase function mirrors it. */
export const LOOP_FLAVORS = [
  "variety",
  "rotated",
  "mirrored",
  "flipped",
  "swapped",
  "inverted",
  "rewound",
  "mirrored-swapped",
  "mirrored-inverted",
  "mirrored-rotated",
  "rotated-swapped",
  "rotated-inverted",
  "swapped-inverted",
  "mirrored-swapped-inverted",
  "mirrored-inverted-rotated",
  "mirrored-rotated-swapped",
  "mirrored-rotated-inverted-swapped",
] as const;
export type LoopFlavor = (typeof LOOP_FLAVORS)[number];

export interface LoopConfig {
  /** Curated pack id. When present, the pack's recipe drives fulfillment and
   *  the dial fields are absent — pack XOR dials. */
  pack?: LoopPackId;
  level?: LoopLevel;
  length?: LoopLength;
  flavor?: LoopFlavor;
  custom?: {
    /** Max turns per motion (Level 2+ only; defaults to 1 — gentle). Rides on
     *  every L2+ order so fulfillment never guesses. */
    maxTurns?: number;
    /** Blend balance for level "mix". Present only when fine-tune touched. */
    levelBalance?: "mostly-1" | "even" | "mostly-spicy";
    /** Flavors excluded from the variety grab bag. Present only when touched. */
    excludeFlavors?: LoopFlavor[];
  };
}

/** Turn ceilings per level — half turns unlock at Level 3, mirroring the
 *  generator. Level 1 has no turns by definition (no dial shown), and the
 *  floors exclude 0: a Level 2 deck capped at 0 turns IS a Level 1 deck. */
export const TURN_VALUES_WHOLE: readonly number[] = [1, 2, 3];
export const TURN_VALUES_HALF: readonly number[] = [0.5, 1, 1.5, 2, 2.5, 3];
/** "Don't go over 1 if you're new" — the recommendation, baked in as default. */
export const DEFAULT_MAX_TURNS = 1;

/** Page loads buyable untouched: the Mild pack. Custom mode defaults to
 *  rotated — the only flavor with reliably great mandalas. */
export const DEFAULT_LOOP_CONFIG: LoopConfig = { pack: "mild" };

/** One muted line per Mix chip — the feel of the blend, never percentages. */
export const LEVEL_MIX_COPY = "Mostly Level 1. A few cards that bite.";
export const LENGTH_MIX_COPY = "Mostly eight-counts, with a few longer runs.";
export const VARIETY_COPY =
  "Every flavor in one deck. Rotated makes the cleanest mandalas; the rest get weird.";

/* ── curated packs ───────────────────────────────────────────────────────────
   A pack is a RECIPE: slices of (flavor, level, per-length counts, turn cap)
   that the dials can't express. Rotated quartered loops are the only flavor
   with reliably great mandalas, so every pack keeps a rotated core and the
   flavor share grows with the heat. Fulfillment resolves the pack id against
   these constants (the firebase function whitelists only the ids).
   Spec: docs/superpowers/specs/2026-07-12-loop-pack-recipes-design.md */

export const LOOP_PACK_IDS = ["mild", "medium", "spicy"] as const;
export type LoopPackId = (typeof LOOP_PACK_IDS)[number];

export interface LoopPackSlice {
  flavor: LoopFlavor;
  /** Numeric difficulty level (1–3). */
  level: number;
  /** Cards per step count, e.g. { 8: 38, 12: 8, 16: 8 }. */
  lengths: Record<number, number>;
  /** Turn ceiling for Level 2+ slices. Absent on Level 1 (no turns). */
  maxTurns?: number;
}

/** One fan slot for the preview — a single card's generation dials. */
export interface LoopPackPreviewSlot {
  flavor: LoopFlavor;
  level: number;
  steps: number;
  maxTurns?: number;
}

export interface LoopPack {
  id: LoopPackId;
  name: string;
  /** Chip subtitle — one glance, no jargon. */
  sub: string;
  /** Stage caption while the pack is selected. */
  tagline: string;
  /** Composition line shown under the chips — the recipe, honestly. */
  composition: string;
  slices: LoopPackSlice[];
  /** Six representative cards for the preview fan. */
  previewHand: LoopPackPreviewSlot[];
}

export const LOOP_PACKS: LoopPack[] = [
  {
    id: "mild",
    name: "Mild",
    sub: "Level 1 · pure mandalas",
    tagline:
      "Every card is a mandala. Rotated loops at Level 1, mostly eight-counts with a few longer runs.",
    composition: "38× 8-count · 8× 12 · 8× 16 · all rotated · Level 1",
    slices: [{ flavor: "rotated", level: 1, lengths: { 8: 38, 12: 8, 16: 8 } }],
    previewHand: [
      { flavor: "rotated", level: 1, steps: 8 },
      { flavor: "rotated", level: 1, steps: 8 },
      { flavor: "rotated", level: 1, steps: 8 },
      { flavor: "rotated", level: 1, steps: 8 },
      { flavor: "rotated", level: 1, steps: 12 },
      { flavor: "rotated", level: 1, steps: 16 },
    ],
  },
  {
    id: "medium",
    name: "Medium",
    sub: "Levels 1–2 · gentle turns",
    tagline:
      "Longer runs and gentle turns. Mostly Level 1, a Level 2 bite, a taste of mirrored.",
    composition: "30× Level 1 · 18× Level 2 (≤1 turn) · 6× mirrored-swapped",
    slices: [
      { flavor: "rotated", level: 1, lengths: { 8: 14, 12: 10, 16: 6 } },
      { flavor: "rotated", level: 2, lengths: { 8: 8, 12: 6, 16: 4 }, maxTurns: 1 },
      { flavor: "mirrored-swapped", level: 1, lengths: { 8: 6 } },
    ],
    previewHand: [
      { flavor: "rotated", level: 1, steps: 8 },
      { flavor: "rotated", level: 1, steps: 12 },
      { flavor: "rotated", level: 1, steps: 16 },
      { flavor: "rotated", level: 2, steps: 8, maxTurns: 1 },
      { flavor: "rotated", level: 2, steps: 12, maxTurns: 1 },
      { flavor: "mirrored-swapped", level: 1, steps: 8 },
    ],
  },
  {
    id: "spicy",
    name: "Spicy",
    sub: "Levels 2–3 · the weird stuff",
    tagline:
      "Whole and half turns, Level 3 cards, and the weird flavors. You were warned.",
    composition: "24× Level 2 (≤2 turns) · 10× Level 3 · 20× flavor mix",
    slices: [
      { flavor: "rotated", level: 2, lengths: { 8: 10, 12: 8, 16: 6 }, maxTurns: 2 },
      { flavor: "rotated", level: 3, lengths: { 8: 6, 12: 4 }, maxTurns: 2 },
      { flavor: "mirrored-swapped", level: 2, lengths: { 8: 7 }, maxTurns: 1 },
      { flavor: "mirrored-inverted", level: 1, lengths: { 8: 7 } },
      { flavor: "swapped-inverted", level: 2, lengths: { 8: 6 }, maxTurns: 1 },
    ],
    previewHand: [
      { flavor: "rotated", level: 2, steps: 8, maxTurns: 2 },
      { flavor: "rotated", level: 2, steps: 12, maxTurns: 2 },
      { flavor: "rotated", level: 3, steps: 8, maxTurns: 2 },
      { flavor: "mirrored-swapped", level: 2, steps: 8, maxTurns: 1 },
      { flavor: "mirrored-inverted", level: 1, steps: 8 },
      { flavor: "swapped-inverted", level: 2, steps: 8, maxTurns: 1 },
    ],
  },
];

export function loopPack(id: LoopPackId): LoopPack {
  return LOOP_PACKS.find((p) => p.id === id)!;
}

/**
 * The full range is open: decks are GENERATED live at fulfillment (same engine
 * as the deck releaser — "live generation makes any length at any level"), so
 * there is no enumerated-pool restriction. Level "mix" stays a preset/advanced
 * concept, not a stepper stop.
 */
export const AVAILABLE_LEVELS: readonly LoopLevel[] = ["1", "2", "3"];
export const AVAILABLE_LENGTHS: readonly LoopLength[] = ["8", "12", "16"];

/** Every flavor is generable at every level. */
export function availableFlavors(_level: LoopLevel): readonly LoopFlavor[] {
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

/* ── flavor ⇄ LOOPType bridge ─────────────────────────────────────────────
   The shop's flavor picker IS the generate panel's LOOP overlay, which speaks
   LOOPType. Flavors stay the checkout vocabulary; these convert both ways. */

/** LOOPType selected in the overlay → checkout flavor slug. */
export function flavorForLoopType(loopType: string): LoopFlavor | null {
  const parts = ["rotated", "mirrored", "flipped", "swapped", "inverted", "rewound"].filter(
    (c) => loopType.includes(c)
  );
  return flavorSlugFromComponents(parts);
}

/** Human label for a flavor slug ("mirrored-swapped" → "Mirrored / Swapped"). */
export function flavorLabel(flavor: LoopFlavor): string {
  if (flavor === "variety") return "Variety Pack";
  return flavor
    .split("-")
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
    .join(" / ");
}
