// Injects the card's effective prop types into a step's motions so the arrow
// override key the inspect editor writes (keyed by motionData.propType) equals
// the key the card-front bake reads. Sequence StepData is prop-agnostic; the
// bake applies prop types from render options (bluePropType ?? settings), so
// the editor must edit against those same prop types or a fan/club card would
// edit the "staff" key and show no change on re-bake. Pure; never mutates input.
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

export function withEffectivePropTypes(
  step: StepData,
  bluePropType: PropType,
  redPropType: PropType,
): StepData {
  const motions = step.motions;
  if (!motions) return step;
  const blue = motions[MotionColor.BLUE];
  const red = motions[MotionColor.RED];
  return {
    ...step,
    motions: {
      ...motions,
      ...(blue && { [MotionColor.BLUE]: { ...blue, propType: bluePropType } }),
      ...(red && { [MotionColor.RED]: { ...red, propType: redPropType } }),
    },
  } as StepData;
}
