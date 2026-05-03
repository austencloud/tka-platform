/**
 * Prop Type Configuration Service
 *
 * Handles pictograph data transformations for user-selected prop types.
 * With the unified PropType enum, prop types are now used directly without mapping.
 */

import type { PictographData } from "../../../shared/domain/models/PictographData";
import type { PropType } from "../../domain/enums/PropType";
export class PropTypeConfigurator {
  /**
   * Convert UI prop type to filename format.
   * With the unified PropType enum, this is now a simple passthrough.
   * The enum values ARE the filenames.
   */
  mapPropTypeToFilename(propType: string): string {
    // PropType enum values are already in the correct filename format
    return propType;
  }

  /**
   * Create pictograph data with all motions using the specified prop type.
   * This ensures beta offset logic and placement calculations see consistent prop types.
   */
  applyPropTypeToPictographData(
    pictographData: PictographData,
    userPropType: string
  ): PictographData {
    return {
      ...pictographData,
      motions: {
        red: pictographData.motions.red
          ? {
              ...pictographData.motions.red,
              propType: userPropType as PropType,
            }
          : pictographData.motions.red,
        blue: pictographData.motions.blue
          ? {
              ...pictographData.motions.blue,
              propType: userPropType as PropType,
            }
          : pictographData.motions.blue,
      },
    };
  }
}
