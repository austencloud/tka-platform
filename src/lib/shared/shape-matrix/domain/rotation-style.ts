import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  MotionColor,
  MotionType,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export type RotationStyle = "iso" | "antispin" | "hybrid";

type SequenceStep = SequenceData["steps"][number];
type StepMotion = SequenceStep["motions"][keyof SequenceStep["motions"]];

const MOTION_KEY_BY_COLOR = {
  [MotionColor.BLUE]: "blue",
  [MotionColor.RED]: "red",
} as const satisfies Record<MotionColor, keyof SequenceStep["motions"]>;

/** Effective prop spin of one hand: float resolves to its prefloat pro/anti. */
function spin(motion: StepMotion): "pro" | "anti" | null {
  const type =
    motion.motionType === MotionType.FLOAT
      ? motion.prefloatMotionType
      : motion.motionType;
  if (type === MotionType.PRO) return "pro";
  if (type === MotionType.ANTI) return "anti";
  return null;
}

/** Bucket a sequence by the prop rotation style that drives its mandala. */
export function classifyRotationStyle(sequence: SequenceData): RotationStyle {
  for (const step of sequence.steps) {
    if (step.isBlank) continue;
    const blue = spin(step.motions[MOTION_KEY_BY_COLOR[MotionColor.BLUE]]);
    const red = spin(step.motions[MOTION_KEY_BY_COLOR[MotionColor.RED]]);
    if (!blue || !red) continue;
    if (blue === "pro" && red === "pro") return "iso";
    if (blue === "anti" && red === "anti") return "antispin";
    return "hybrid";
  }
  return "hybrid";
}
