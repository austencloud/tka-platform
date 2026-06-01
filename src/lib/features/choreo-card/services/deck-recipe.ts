import type { DeckRecipe } from "../domain/models/DeckRelease";
import { canonicalJSON } from "$lib/shared/foundation/utils/canonical-json";
import { cyrb128 } from "$lib/shared/foundation/utils/seeded-rng";

/**
 * Generation-logic pin. Bump when a change to the draw/variation logic would
 * alter the cards a given (recipe, seed) produces — a bumped version changes
 * every hash, so stale cached decks auto-miss instead of silently drifting.
 */
export const GENERATOR_VERSION = "deck-gen@1.0.0";

/**
 * Stable hash of a recipe's draw-relevant fields ⊕ seed ⊕ generatorVersion.
 * Logically-identical recipes hash identically via canonical JSON.
 */
export function hashRecipe(recipe: DeckRecipe): string {
  const [a, b, c, d] = cyrb128(canonicalJSON(recipe));
  return [a, b, c, d].map((n) => (n >>> 0).toString(16).padStart(8, "0")).join("");
}

/** Mint a fresh crypto-random seed (Reroll). 64-bit, hex. */
export function mintSeed(): string {
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  return buf[0]!.toString(16).padStart(8, "0") + buf[1]!.toString(16).padStart(8, "0");
}
