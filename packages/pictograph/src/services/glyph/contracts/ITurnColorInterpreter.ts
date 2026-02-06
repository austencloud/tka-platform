/**
 * ITurnColorInterpreter - Contract for turn color interpretation
 *
 * Determines which color (blue or red) to apply to top and bottom turn numbers
 * based on the letter type and motion arrangement.
 */

import type { PictographData } from "@tka/types";

export type TurnNumberColor = string;

export interface TurnColors {
  top: TurnNumberColor;
  bottom: TurnNumberColor;
}

export interface ITurnColorInterpreter {
  interpretTurnColors(
    letter: string | null | undefined,
    pictographData?: PictographData
  ): TurnColors;
}
