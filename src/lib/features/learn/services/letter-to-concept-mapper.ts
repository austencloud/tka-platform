/**
 * LetterToConceptMapper
 *
 * Static mapping from TKA letters to curriculum concept IDs
 * and knowledge graph type node IDs.
 *
 * Letter-to-type mappings are stable (defined by the TKA alphabet).
 * Concept IDs reference the curriculum in domain/concepts.ts.
 */

/** Letter type number (1-6) for each TKA letter */
const LETTER_TYPE_MAP: ReadonlyMap<string, number> = new Map([
  // Type 1: Dual-Shift (A-V)
  ...["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
    "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"].map(
    (l) => [l, 1] as const
  ),
  // Type 2: Shift (one shifts, one static)
  ...["W", "X", "Y", "Z", "Σ", "Δ", "Θ", "Ω", "μ", "ν"].map(
    (l) => [l, 2] as const
  ),
  // Type 3: Cross-Shift (one shifts, one dashes)
  ...["W-", "X-", "Y-", "Z-", "Σ-", "Δ-", "Θ-", "Ω-"].map(
    (l) => [l, 3] as const
  ),
  // Type 4: Dash (one dashes, one static)
  ...["Φ", "Ψ", "Λ", "τ-"].map((l) => [l, 4] as const),
  // Type 5: Dual-Dash (both dash)
  ...["Φ-", "Ψ-", "Λ-"].map((l) => [l, 5] as const),
  // Type 6: Static (both stay)
  ...["α", "β", "γ", "ζ", "η", "τ", "⊕"].map((l) => [l, 6] as const),
]);

/**
 * Maps letter type number to the best-fit curriculum concept ID.
 * Some types span multiple concepts (Type 1 has several groups),
 * so we map to the broadest relevant concept.
 */
const TYPE_TO_CONCEPT: ReadonlyMap<number, string> = new Map([
  [1, "type1-abc-ghi"],
  [2, "type2-wxyz"],
  [3, "type3-cross-shift-letters"],
  [4, "type456-dash-static"],
  [5, "type456-dash-static"],
  [6, "type456-dash-static"],
]);

export function getConceptId(letter: string): string | null {
  const typeNum = LETTER_TYPE_MAP.get(letter);
  if (typeNum === undefined) return null;
  return TYPE_TO_CONCEPT.get(typeNum) ?? null;
}

export function getTypeNodeId(letter: string): string | null {
  const typeNum = LETTER_TYPE_MAP.get(letter);
  if (typeNum === undefined) return null;
  return `type-${typeNum}`;
}
