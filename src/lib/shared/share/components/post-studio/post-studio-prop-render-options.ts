import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { SequenceExportOptions } from "$lib/shared/render/domain/models/sequence-export-options";

/**
 * Pins one Post Studio prop choice into every card-rendering override consumed
 * by the live card, DOM capture, and image compositor.
 */
export function withPostStudioPropType(
  options: Partial<SequenceExportOptions> | null | undefined,
  propType: PropType
): Partial<SequenceExportOptions> {
  return {
    ...(options ?? {}),
    propTypeOverride: propType,
    bluePropTypeOverride: propType,
    redPropTypeOverride: propType,
    visibilityOverrides: {
      ...(options?.visibilityOverrides ?? {}),
      bluePropType: propType,
      redPropType: propType,
    },
  };
}
