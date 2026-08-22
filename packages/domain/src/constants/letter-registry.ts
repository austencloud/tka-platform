import type { Letter, LetterTypeNumber, LetterTypeInfo } from "../types/letter.js";

/** The 47 Level 1 letters represented in the canonical pictograph dataframe. */
export const BASE_ALPHABET_LETTERS: Letter[] = [
  // Type 1: Dual-Shift
  "A", "B", "C", "D", "E", "F", "G", "H", "I",
  "J", "K", "L", "M", "N", "O", "P", "Q", "R",
  "S", "T", "U", "V",
  // Type 2: Shift
  "W", "X", "Y", "Z", "Σ", "Δ", "Θ", "Ω",
  // Type 3: Cross-Shift
  "W-", "X-", "Y-", "Z-", "Σ-", "Δ-", "Θ-", "Ω-",
  // Type 4: Dash
  "Φ", "Ψ", "Λ",
  // Type 5: Dual-Dash
  "Φ-", "Ψ-", "Λ-",
  // Type 6: Static
  "α", "β", "γ",
];

/** Registered higher-level letters whose pictograph variations are not in the base dataframe yet. */
export const EXTENDED_ALPHABET_LETTERS: Letter[] = ["τ-"];

/** Every registered alphabet letter, with the Level 1 set first. */
export const REGISTERED_ALPHABET_LETTERS: Letter[] = [
  ...BASE_ALPHABET_LETTERS,
  ...EXTENDED_ALPHABET_LETTERS,
];

/**
 * Level 1/dataframe letters. Kept as the established export so existing games
 * and generators do not start requesting an extension with no variations.
 */
export const ALL_LETTERS: Letter[] = BASE_ALPHABET_LETTERS;

const TYPE_DEFINITIONS: Record<string, { name: string; typeNumber: LetterTypeNumber; letters: Letter[] }> = {
  "type1": { name: "Type 1: Dual-Shift", typeNumber: 1, letters: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"] },
  "type2": { name: "Type 2: Shift", typeNumber: 2, letters: ["W", "X", "Y", "Z", "Σ", "Δ", "Θ", "Ω"] },
  "type3": { name: "Type 3: Cross-Shift", typeNumber: 3, letters: ["W-", "X-", "Y-", "Z-", "Σ-", "Δ-", "Θ-", "Ω-"] },
  "type4": { name: "Type 4: Dash", typeNumber: 4, letters: ["Φ", "Ψ", "Λ", "τ-"] },
  "type5": { name: "Type 5: Dual-Dash", typeNumber: 5, letters: ["Φ-", "Ψ-", "Λ-"] },
  "type6": { name: "Type 6: Static", typeNumber: 6, letters: ["α", "β", "γ"] },
};

/** Map from letter to its type info. Used for O(1) letter→type lookups. */
export const LETTER_TO_TYPE: Record<string, LetterTypeInfo> = {};
for (const [typeKey, typeInfo] of Object.entries(TYPE_DEFINITIONS)) {
  for (const letter of typeInfo.letters) {
    LETTER_TO_TYPE[letter] = {
      type: typeKey,
      name: typeInfo.name,
      typeNumber: typeInfo.typeNumber,
    };
  }
}

export function getLetterType(letter: string): LetterTypeNumber | undefined {
  return LETTER_TO_TYPE[letter]?.typeNumber;
}

export function isValidLetter(letter: string): letter is Letter {
  return letter in LETTER_TO_TYPE;
}

export function getLettersByType(
  typeNumber: LetterTypeNumber,
  options: { includeExtended?: boolean } = {}
): Letter[] {
  const key = `type${typeNumber}`;
  const letters = TYPE_DEFINITIONS[key]?.letters ?? [];
  if (options.includeExtended) return [...letters];
  return letters.filter((letter) => !EXTENDED_ALPHABET_LETTERS.includes(letter));
}
