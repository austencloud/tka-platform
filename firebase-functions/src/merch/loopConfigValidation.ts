import * as functions from "firebase-functions";

export interface RecipeSliceRequest {
  count?: number;
  flavor?: string;
  level?: number;
  steps?: number;
  maxTurns?: number;
}

export interface LoopConfigRequest {
  pack?: string;
  recipe?: RecipeSliceRequest[];
  level?: string;
  length?: string;
  flavor?: string;
  custom?: {
    maxTurns?: number;
    levelBalance?: string;
    excludeFlavors?: string[];
  };
}

// Mirrors of the client whitelists (src/lib/features/store/domain/
// shop-prop-options.ts and loop-config.ts) — the client codebase can't be
// imported from the functions build. Keep in sync.
export const SHOP_PROP_TYPES = ["staff", "club", "fan", "triad", "buugeng"] as const;
const LOOP_LEVELS = ["1", "2", "3", "mix"] as const;
const LOOP_LENGTHS = ["8", "12", "16", "mix"] as const;
const LOOP_FLAVORS = [
  "variety", "rotated", "mirrored", "flipped", "swapped", "inverted", "rewound",
  "mirrored-swapped", "mirrored-inverted", "mirrored-rotated", "rotated-swapped",
  "rotated-inverted", "swapped-inverted", "mirrored-swapped-inverted",
  "mirrored-inverted-rotated", "mirrored-rotated-swapped",
  "mirrored-rotated-inverted-swapped",
] as const;
const LEVEL_BALANCES = ["mostly-1", "even", "mostly-spicy"] as const;
const LOOP_PACKS = ["mild", "medium", "spicy"] as const;
const DECK_SIZE = 54;
const MAX_RECIPE_SLICES = 8;
const RECIPE_STEPS = [4, 8, 12, 16] as const;

function validateRecipe(slices: RecipeSliceRequest[], bad: (msg: string) => void): void {
  if (!Array.isArray(slices) || slices.length === 0) bad("Recipe needs at least one slice");
  if (slices.length > MAX_RECIPE_SLICES) bad("Too many recipe slices");
  let total = 0;
  for (const s of slices) {
    if (!Number.isInteger(s.count) || (s.count as number) < 1) bad("Bad slice count");
    total += s.count as number;
    if (
      typeof s.flavor !== "string" ||
      s.flavor === "variety" ||
      !LOOP_FLAVORS.includes(s.flavor as never)
    )
      bad("Unknown slice flavor");
    if (![1, 2, 3].includes(s.level as number)) bad("Bad slice level");
    if (!RECIPE_STEPS.includes(s.steps as never)) bad("Bad slice steps");
    if (s.level === 1) {
      if (s.maxTurns !== undefined) bad("Level 1 slices carry no turns");
    } else {
      const t = s.maxTurns;
      if (typeof t !== "number" || t < 0.5 || t > 3 || (t * 2) % 1 !== 0)
        bad("Bad slice turn ceiling");
      else if (s.level === 2 && t % 1 !== 0) bad("Half turns are Level 3 only");
    }
  }
  if (total !== DECK_SIZE) bad(`Recipe must total exactly ${DECK_SIZE} cards`);
}

export function validateLoopConfig(cfg: LoopConfigRequest): void {
  const bad = (msg: string) => {
    throw new functions.https.HttpsError("invalid-argument", msg);
  };
  const dialsPresent =
    cfg.level !== undefined ||
    cfg.length !== undefined ||
    cfg.flavor !== undefined ||
    cfg.custom !== undefined;
  if (cfg.pack !== undefined) {
    if (!LOOP_PACKS.includes(cfg.pack as never)) bad("Unknown loop pack");
    if (dialsPresent || cfg.recipe !== undefined) bad("Pack orders carry no dial fields");
    return;
  }
  if (cfg.recipe !== undefined) {
    if (dialsPresent) bad("Recipe orders carry no dial fields");
    validateRecipe(cfg.recipe, bad);
    return;
  }
  if (!LOOP_LEVELS.includes(cfg.level as never)) bad("Unknown loop level");
  if (!LOOP_LENGTHS.includes(cfg.length as never)) bad("Unknown loop length");
  if (!LOOP_FLAVORS.includes(cfg.flavor as never)) bad("Unknown loop flavor");
  if (cfg.custom) {
    if (cfg.custom.maxTurns !== undefined) {
      const t = cfg.custom.maxTurns;
      if (typeof t !== "number" || t < 0.5 || t > 3 || (t * 2) % 1 !== 0)
        bad("Unknown max turns");
    }
    if (
      cfg.custom.levelBalance !== undefined &&
      !LEVEL_BALANCES.includes(cfg.custom.levelBalance as never)
    )
      bad("Unknown level balance");
    if (cfg.custom.excludeFlavors !== undefined) {
      if (
        !Array.isArray(cfg.custom.excludeFlavors) ||
        cfg.custom.excludeFlavors.some((f) => !LOOP_FLAVORS.includes(f as never))
      )
        bad("Unknown excluded flavor");
    }
  }
}
