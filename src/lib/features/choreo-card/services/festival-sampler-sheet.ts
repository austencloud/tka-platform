export const FESTIVAL_SHEET_COLUMNS = 3;
export const FESTIVAL_SAMPLE_CARD_COUNT = 8;
export const FESTIVAL_SHEET_CARD_COUNT = 9;

/** Place the signup card in the center cell of the fixed 3×3 handout. */
export function placeFestivalSignupAtCenter<T>(
  sampleCards: readonly T[],
  signupCard: T
): T[] {
  if (sampleCards.length !== FESTIVAL_SAMPLE_CARD_COUNT) {
    throw new Error(
      `Festival sheet needs ${FESTIVAL_SAMPLE_CARD_COUNT} sample cards; received ${sampleCards.length}`
    );
  }
  return [
    ...sampleCards.slice(0, 4),
    signupCard,
    ...sampleCards.slice(4),
  ];
}

/** Back-page order for a long-edge duplex flip: mirror each row's columns. */
export function mirrorFestivalSheetColumns<T>(items: readonly T[]): T[] {
  const mirrored: T[] = [];
  for (let row = 0; row < items.length; row += FESTIVAL_SHEET_COLUMNS) {
    mirrored.push(
      ...items.slice(row, row + FESTIVAL_SHEET_COLUMNS).reverse()
    );
  }
  return mirrored;
}
