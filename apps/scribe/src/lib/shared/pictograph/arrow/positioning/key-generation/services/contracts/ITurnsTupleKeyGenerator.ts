/**
 * Turns Tuple Key Generator Contract
 */

import type { PictographData } from "../../../../../shared/domain/models/PictographData";

export interface ITurnsTupleKeyGenerator {
  generateTurnsTuple(pictographData: PictographData): number[];
}
