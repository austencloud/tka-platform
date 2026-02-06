/**
 * Attribute Key Generator Contract
 */

import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import type { ArrowPlacementData } from "../../../placement/domain/ArrowPlacementData";

export interface IAttributeKeyGenerator {
  getKeyFromArrow(
    arrowData: ArrowPlacementData,
    pictographData: PictographData,
    color: string
  ): string;
}
