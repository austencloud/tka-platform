export type OptionControlsPresentation =
  | "hidden"
  | "wide-inline"
  | "compact-inline"
  | "disclosed";

interface OptionControlsPresentationInput {
  hasControls: boolean;
  wideInlineEligible: boolean;
  containerHeight: number;
  canShowTurnRows: boolean;
}

// The compact 4×4 grid remains usable at 320px tall. Everything above that is
// available chrome: 88px for Options + Level, another 136px when both turn rows
// exist, and 16px so focus rings and the grid never touch the header seam.
const MIN_OPTION_SURFACE_HEIGHT = 320;
const COMPACT_HEADER_HEIGHT = 88;
const COMPACT_TURN_ROWS_HEIGHT = 136;
const INLINE_LAYOUT_BUFFER = 16;

export function minimumInlineControlsHeight(canShowTurnRows: boolean): number {
  return (
    MIN_OPTION_SURFACE_HEIGHT +
    COMPACT_HEADER_HEIGHT +
    INLINE_LAYOUT_BUFFER +
    (canShowTurnRows ? COMPACT_TURN_ROWS_HEIGHT : 0)
  );
}

export function selectOptionControlsPresentation({
  hasControls,
  wideInlineEligible,
  containerHeight,
  canShowTurnRows,
}: OptionControlsPresentationInput): OptionControlsPresentation {
  if (!hasControls) return "hidden";
  if (wideInlineEligible) return "wide-inline";

  return containerHeight >= minimumInlineControlsHeight(canShowTurnRows)
    ? "compact-inline"
    : "disclosed";
}
