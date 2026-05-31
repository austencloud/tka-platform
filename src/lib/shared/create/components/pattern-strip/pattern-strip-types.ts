// pattern-strip-types.ts
import type { RhythmDef } from "$lib/shared/create/domain/rhythm/rhythm-catalog";

export type StripValue = number | "fl";

/** Configures the editor for one drawer (turns/duration). 2-lane turns shown;
 *  duration uses lanes=1. */
export interface StripBinding {
  lanes: 1 | 2;
  rhythms: readonly RhythmDef[];
  /** Cell cycle list (e.g. turns [0,0.5,1,1.5,2,2.5,3,"fl"]; duration [1,1.25,1.5,2,4]). */
  valueList: StripValue[];
  /** Amount segmented options (active-beat magnitudes). */
  amountList: number[];
  /** Base/default value (0 turns, 1 duration). */
  base: StripValue;
  format: (v: StripValue) => string;
  /** Lane colours for SegmentedControl + strip. */
  laneColors: ("blue" | "red" | "accent")[];
  laneLabels: string[];
}
