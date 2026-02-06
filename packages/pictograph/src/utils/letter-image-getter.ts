import type { Letter } from "@tka/types";
import { getLetterType, LetterType } from "@tka/types";

export function isDashLetter(letter: string | null | undefined): boolean {
  if (!letter) return false;
  return letter.endsWith("-");
}

export function getBaseLetter(letter: string): string {
  if (letter.endsWith("-")) {
    return letter.slice(0, -1);
  }
  return letter;
}

export function getLetterImagePath(letter: Letter | string): string {
  const letterType = getLetterType(letter as Letter);

  if (letterType === LetterType.TYPE3) {
    const baseLetter = getBaseLetter(letter);
    return `/images/letters_trimmed/${LetterType.TYPE2}/${baseLetter}.svg`;
  }

  if (letterType === LetterType.TYPE5) {
    const baseLetter = getBaseLetter(letter);
    return `/images/letters_trimmed/${LetterType.TYPE4}/${baseLetter}.svg`;
  }

  return `/images/letters_trimmed/${letterType}/${letter}.svg`;
}
