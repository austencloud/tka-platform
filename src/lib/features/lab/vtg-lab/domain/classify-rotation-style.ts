import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { MotionColor, MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export type RotationStyle = "iso" | "antispin" | "hybrid";

/** Effective prop spin of one hand: float resolves to its prefloat pro/anti. */
function spin(motion: { motionType?: string; prefloatMotionType?: string } | undefined): "pro" | "anti" | null {
  if (!motion) return null;
  const t = motion.motionType === MotionType.FLOAT ? motion.prefloatMotionType : motion.motionType;
  if (t === MotionType.PRO) return "pro";
  if (t === MotionType.ANTI) return "anti";
  return null; // static / dash / unknown — not a rotating shift
}

/**
 * Bucket a sequence by prop rotation style — what actually drives the mandala.
 * Reads the first step whose two hands both rotate (pro/anti). Both pro → iso,
 * both anti → antispin, mixed → hybrid. (VTG mode / hand arc is irrelevant here;
 * see tnd-deriver.ts — A/B/C share hand paths but differ in prop spin.)
 */
export function classifyRotationStyle(seq: SequenceData): RotationStyle {
  for (const step of seq.steps) {
    if ((step as { isBlank?: boolean }).isBlank) continue;
    const motions = step.motions as unknown as Partial<Record<string, { motionType?: string; prefloatMotionType?: string }>>;
    const b = spin(motions[MotionColor.BLUE]);
    const r = spin(motions[MotionColor.RED]);
    if (!b || !r) continue;
    if (b === "pro" && r === "pro") return "iso";
    if (b === "anti" && r === "anti") return "antispin";
    return "hybrid";
  }
  return "hybrid";
}
