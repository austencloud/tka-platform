// pattern-strip-types.ts
import type { RhythmDef } from "$lib/shared/create/domain/rhythm/rhythm-catalog";

export type StripValue = number | "fl" | boolean;

/** Configures the editor for one drawer (turns/duration/reversals). 2-lane turns
 *  + reversals; duration uses lanes=1. */
export interface StripBinding {
  lanes: 1 | 2;
  rhythms: readonly RhythmDef[];
  /** Cell cycle list (e.g. turns [0,0.5,1,1.5,2,2.5,3,"fl"]; reversals [false,true]). */
  valueList: StripValue[];
  /**
   * Amount segmented options (active-beat magnitudes). Omit for binary strips
   * (reversals) — the AMOUNT row is hidden and `activeValue` is stamped instead.
   */
  amountList?: number[];
  /** Base/default value (0 turns, 1 duration, false reversal). */
  base: StripValue;
  format: (v: StripValue) => string;
  /** Lane colours for SegmentedControl + strip. */
  laneColors: ("blue" | "red" | "accent")[];
  laneLabels: string[];
  /** Cell interaction: numeric cycle (default) or boolean toggle. */
  cellKind?: "number" | "toggle";
  /** Fixed value stamped on active beats when there is no amount (reversals → true). */
  activeValue?: StripValue;
}
