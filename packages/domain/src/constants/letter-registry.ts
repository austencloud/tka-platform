import type { Letter, LetterTypeNumber, LetterTypeInfo } from "../types/letter.js";

/** All 47 TKA letters, ordered by type */
export const ALL_LETTERS: Letter[] = [
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

const TYPE_DEFINITIONS: Record<string, { name: string; typeNumber: LetterTypeNumber; letters: Letter[] }> = {
  "type1": { name: "Type 1: Dual-Shift", typeNumber: 1, letters: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"] },
  "type2": { name: "Type 2: Shift", typeNumber: 2, letters: ["W", "X", "Y", "Z", "Σ", "Δ", "Θ", "Ω"] },
  "type3": { name: "Type 3: Cross-Shift", typeNumber: 3, letters: ["W-", "X-", "Y-", "Z-", "Σ-", "Δ-", "Θ-", "Ω-"] },
  "type4": { name: "Type 4: Dash", typeNumber: 4, letters: ["Φ", "Ψ", "Λ"] },
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

export function getLettersByType(typeNumber: LetterTypeNumber): Letter[] {
  const key = `type${typeNumber}`;
  return TYPE_DEFINITIONS[key]?.letters ?? [];
}
