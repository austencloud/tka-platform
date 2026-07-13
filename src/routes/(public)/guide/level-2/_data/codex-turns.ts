/**
 * Level 2 turn-codex cell builder.
 *
 * The Level 2 codex pages (old p17–34) are grids of every letter of a type, each
 * shown with a specific turn tuple applied — e.g. p17 is "1|0": one turn on one
 * hand. Rather than hand-author 32 pictographs per page, we reuse the same data
 * path the interactive codex reader uses:
 *
 *   codexData(id)                      → canonical 0-turn PictographData (home orient.)
 *   applyPendingTurnsToOption(...)     → the canonical turn transform (correct end
 *                                        orientation + correct `*_N.0.svg` turn arrows)
 *
 * Slot → hand mapping follows PADS (get_domain_topic "glyph-anatomy"): the HIGH
 * slot is Pro (for a pro/anti hybrid) or the left/blue hand (when both hands share
 * a motion type); the LOW slot is Anti / the right/red hand. So a `¹` cell = turn
 * on the high-slot hand, a `₁` cell = turn on the low-slot hand.
 *
 * Known gap (flag for the accuracy pass): S and T are pro|pro / anti|anti with a
 * leader/follower asymmetry, so their true high slot is the LEADER, not simply
 * blue. We treat them as blue-high here; confirm S/T slot assignment against the
 * original artboard.
 */
import { codexData } from "../../codex/_data/codex-groups";
import { applyPendingTurnsToOption } from "$lib/shared/create/services/apply-turns-to-motion";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import { MotionType, MotionColor, RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

const CW = RotationDirection.CLOCKWISE;

/** Which hand owns the high slot for this pictograph (PADS: pro > anti; else blue). */
function highSlotColor(base: PictographData): MotionColor {
  const b = base.motions?.blue?.motionType;
  const r = base.motions?.red?.motionType;
  if (b && r && b !== r) return b === MotionType.PRO ? MotionColor.BLUE : MotionColor.RED;
  return MotionColor.BLUE; // matching-type: left/blue high (S/T leader exception — see header)
}

export type Slot = "high" | "low";

/**
 * Build a turn-annotated codex cell.
 * @param letter   base letter id WITHOUT the variation suffix, e.g. "A", "Σ", "Θ-"
 * @param highTurns turns placed on the HIGH slot
 * @param lowTurns  turns placed on the LOW slot
 */
export function codexTurnData(letter: string, highTurns: number, lowTurns: number): PictographData | null {
  const base = codexData(`${letter}-0`);
  if (!base) return null;
  const high = highSlotColor(base);
  const highIsBlue = high === MotionColor.BLUE;
  const blueTurns = highIsBlue ? highTurns : lowTurns;
  const redTurns = highIsBlue ? lowTurns : highTurns;
  return applyPendingTurnsToOption(base, blueTurns, redTurns, CW, CW);
}

/** Single-slot convenience for the 1|0-style pages: turn on high (`¹`) or low (`₁`). */
export function codexSlotData(letter: string, slot: Slot, turns = 1): PictographData | null {
  return codexTurnData(letter, slot === "high" ? turns : 0, slot === "low" ? turns : 0);
}
