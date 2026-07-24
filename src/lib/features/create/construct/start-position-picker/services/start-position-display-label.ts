import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

/**
 * Formats the canonical static letter with its position number, such as α1.
 */
export function getStartPositionDisplayLabel(
  position: Pick<PictographData, "letter" | "startPosition">
): string | null {
  if (!position.letter || !position.startPosition) return null;

  const number = position.startPosition.match(/\d+$/)?.[0];
  return number ? `${position.letter}${number}` : position.letter;
}
