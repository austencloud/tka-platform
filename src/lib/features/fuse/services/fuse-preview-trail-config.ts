import { TrackingMode } from "$lib/shared/animation-engine/domain/types/trail-types";
import {
  setCellWide,
  type TipEffectMap,
} from "$lib/shared/animation-engine/services/tip-effect-resolver";
import { pairTipEnds } from "$lib/shared/pictograph/prop/domain/prop-tip-ends";

/**
 * Trail settings choose where the live overlay captures a prop. The effect map
 * separately turns that overlay on, so Fuse needs both even though it has no
 * trail controls of its own.
 */
export const FUSE_PREVIEW_TIP_EFFECT_MAP: TipEffectMap = setCellWide(
  {},
  "trails"
);

export function resolveFusePreviewTrackingMode(
  bluePropType: string | undefined,
  redPropType: string | undefined
): TrackingMode {
  return pairTipEnds(bluePropType, redPropType) === 2
    ? TrackingMode.BOTH_ENDS
    : TrackingMode.RIGHT_END;
}
