import type { TurnValue } from "$lib/shared/create/domain/turn-pattern-data";
import { applyPendingTurnsToOption } from "$lib/shared/create/services/apply-turns-to-motion";
import type { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

export function applyTurnsToVariations(
  variations: readonly PictographData[],
  leftTurns: TurnValue,
  rightTurns: TurnValue,
  leftRotation: RotationDirection,
  rightRotation: RotationDirection
): PictographData[] {
  return variations.map((variation) =>
    applyPendingTurnsToOption(
      variation,
      leftTurns,
      rightTurns,
      leftRotation,
      rightRotation
    )
  );
}
