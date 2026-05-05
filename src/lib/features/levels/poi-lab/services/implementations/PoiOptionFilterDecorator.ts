/**
 * Poi Option Filter Decorator
 *
 * Filters pictograph options to only include poi-legal moves.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { validateMotion, validateTransition } from "../poi-constraint-validator";

export class PoiOptionFilterDecorator {
  constructor() {}

  filterPoiLegalOptions(
    options: readonly PictographData[],
    previousPictograph: PictographData | null
  ): PictographData[] {
    return options.filter((option) => {
      const blueMotion = option.motions?.blue;
      const redMotion = option.motions?.red;

      const blueIsPoi = blueMotion?.propType === PropType.POI;
      const redIsPoi = redMotion?.propType === PropType.POI;

      // If neither motion is poi, option passes through
      if (!blueIsPoi && !redIsPoi) {
        return true;
      }

      // Validate blue poi motion
      if (blueIsPoi && blueMotion) {
        const blueResult = validateMotion(blueMotion);
        if (!blueResult.isValid) {
          return false;
        }

        // Check transition if we have a previous pictograph
        const prevBlue = previousPictograph?.motions?.blue;
        if (prevBlue?.propType === PropType.POI) {
          const transitionResult = validateTransition(
            prevBlue,
            blueMotion
          );
          if (!transitionResult.isValid) {
            return false;
          }
        }
      }

      // Validate red poi motion
      if (redIsPoi && redMotion) {
        const redResult = validateMotion(redMotion);
        if (!redResult.isValid) {
          return false;
        }

        // Check transition if we have a previous pictograph
        const prevRed = previousPictograph?.motions?.red;
        if (prevRed?.propType === PropType.POI) {
          const transitionResult = validateTransition(
            prevRed,
            redMotion
          );
          if (!transitionResult.isValid) {
            return false;
          }
        }
      }

      return true;
    });
  }
}
