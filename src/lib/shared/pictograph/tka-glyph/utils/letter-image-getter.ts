import type { Letter } from "../../../foundation/domain/models/letter";
import { getLetterType } from "../../../foundation/domain/models/letter";
import { LetterType } from "../../../foundation/domain/models/letter-type";

/**
 * Check if a letter is a dash letter (Type3 or Type5)
 */
export function isDashLetter(letter: string | null | undefined): boolean {
  if (!letter) return false;
  return letter.endsWith("-");
}

/**
 * Get the base letter (without dash) for dash letters
 */
export function getBaseLetter(letter: string): string {
  if (letter.endsWith("-")) {
    return letter.slice(0, -1);
  }
  return letter;
}

/**
 * Get the full image path for a letter based on its type.
 * For dash letters (Type3/Type5), returns the base letter path from Type2/Type4.
 * Browser will handle URL encoding automatically during fetch.
 */
export function getLetterImagePath(letter: Letter): string {
  const letterType = getLetterType(letter);

  // For dash letters, load the base letter from the parent type folder
  // Type3 letters (X-, W-, etc.) -> load from Type2
  // Type5 letters (Φ-, Ψ-, Λ-) -> load from Type4
  if (letterType === LetterType.TYPE3) {
    const baseLetter = getBaseLetter(letter);
    return `/images/letters_trimmed/${LetterType.TYPE2}/${baseLetter}.svg`;
  }

  if (letterType === LetterType.TYPE5) {
    const baseLetter = getBaseLetter(letter);
    return `/images/letters_trimmed/${LetterType.TYPE4}/${baseLetter}.svg`;
  }

  // TAU_DASH (τ-) is Type4, but its base letter τ lives in Type6.
  // The dash overlay is rendered separately by the Dash component.
  if (letter === "τ-") {
    return `/images/letters_trimmed/${LetterType.TYPE6}/τ.svg`;
  }

  // For all other letter types, use the combined SVG
  return `/images/letters_trimmed/${letterType}/${letter}.svg`;
}
