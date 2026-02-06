/**
 * Turns Tuple Generator Contract
 *
 * Generates turns tuple strings for looking up special placement data.
 */

import type { PictographData } from "../../../../../shared/domain/models/PictographData";

export interface ITurnsTupleGenerator {
  /**
   * Generate turns tuple string matching the legacy turns_tuple_generator logic.
   *
   * Formats:
   * - TYPE1/TYPE2: "(blue_turns, red_turns)" e.g., "(0, 1.5)", "(1, 0.5)", "(fl, 0)"
   * - TYPE3: "(direction, shift_turns, dash_turns)" e.g., "(s, 0, 0.5)", "(cw, fl, 1)"
   * - TYPE4: "(direction, dash_turns, static_turns)" e.g., "(s, 0.5, 3)", "(cw, 0, 0.5)"
   *
   * @param pictographData Pictograph data containing motions and letter
   * @returns Turns tuple string for JSON lookup
   */
  generateTurnsTuple(pictographData: PictographData): string;
}
