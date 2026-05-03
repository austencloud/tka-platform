/**
 * Poi Sequence Validator
 *
 * Validates entire sequences for poi legality.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { PoiConstraintValidator } from "./PoiConstraintValidator";
import type {
  PoiValidationResult,
  PoiConstraintViolation,
} from "../../domain/poi-models";

export class PoiSequenceValidator {
  constructor(
    private readonly constraintValidator: PoiConstraintValidator
  ) {}

  validateSequence(sequence: readonly PictographData[]): PoiValidationResult {
    const violations: PoiConstraintViolation[] = [];

    for (let i = 0; i < sequence.length; i++) {
      const pictograph = sequence[i];
      if (!pictograph) continue;

      const blueMotion = pictograph.motions?.blue;
      const redMotion = pictograph.motions?.red;

      // Validate blue motion if it's poi
      if (blueMotion?.propType === PropType.POI) {
        const blueResult = this.constraintValidator.validateMotion(blueMotion);
        violations.push(...blueResult.violations);

        // Check transition from previous beat
        if (i > 0) {
          const prevPictograph = sequence[i - 1];
          const prevBlue = prevPictograph?.motions?.blue;
          if (prevBlue?.propType === PropType.POI) {
            const transitionResult = this.constraintValidator.validateTransition(
              prevBlue,
              blueMotion
            );
            violations.push(...transitionResult.violations);
          }
        }
      }

      // Validate red motion if it's poi
      if (redMotion?.propType === PropType.POI) {
        const redResult = this.constraintValidator.validateMotion(redMotion);
        violations.push(...redResult.violations);

        // Check transition from previous beat
        if (i > 0) {
          const prevPictograph = sequence[i - 1];
          const prevRed = prevPictograph?.motions?.red;
          if (prevRed?.propType === PropType.POI) {
            const transitionResult = this.constraintValidator.validateTransition(
              prevRed,
              redMotion
            );
            violations.push(...transitionResult.violations);
          }
        }
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  validatePictograph(pictograph: PictographData): PoiValidationResult {
    return this.validateSequence([pictograph]);
  }
}
