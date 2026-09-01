/**
 * Prop Type Configurator — plain function module.
 *
 * Handles pictograph data transformations for user-selected prop types.
 * With the unified PropType enum, prop types are used directly without mapping.
 */

import type { PictographData } from "../../shared/domain/models/pictograph-data";
import type { PropType } from "../domain/enums/prop-type";

/**
 * Convert UI prop type to filename format.
 * With the unified PropType enum this is a simple passthrough —
 * enum values ARE the filenames.
 */
export function mapPropTypeToFilename(propType: string): string {
  return propType;
}

/**
 * Create pictograph data with all motions using the specified prop type.
 * Ensures beta offset logic and placement calculations see consistent prop types.
 */
export function applyPropTypeToPictographData(
  pictographData: PictographData,
  userPropType: string
): PictographData {
  return {
    ...pictographData,
    motions: {
      right: pictographData.motions.right
        ? {
            ...pictographData.motions.right,
            propType: userPropType as PropType,
          }
        : pictographData.motions.right,
      left: pictographData.motions.left
        ? {
            ...pictographData.motions.left,
            propType: userPropType as PropType,
          }
        : pictographData.motions.left,
    },
  };
}
