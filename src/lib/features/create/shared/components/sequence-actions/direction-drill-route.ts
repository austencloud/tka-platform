export type DirectionDrillRoute =
  | "hub"
  | "reversals"
  | "reversal-length"
  | "reversal-rhythm"
  | "reversal-result"
  | "absolute";

export type ReversalEditorStage = "overview" | "length" | "rhythm" | "result";

export function getDirectionDrillTitle(route: DirectionDrillRoute): string {
  switch (route) {
    case "reversals":
      return "Reversals";
    case "reversal-length":
      return "Reversal Length";
    case "reversal-rhythm":
      return "Reversal Rhythm";
    case "reversal-result":
      return "Reversal Result";
    case "absolute":
      return "Rotation Direction";
    default:
      return "Direction";
  }
}

/**
 * One line naming what the screen is for, rendered as the drill-down header's
 * subtitle. Each screen owns a single knob, so the subtitle is where the knob
 * explains itself — the body stays the control and nothing else.
 */
export function getDirectionDrillSubtitle(route: DirectionDrillRoute): string {
  switch (route) {
    case "reversals":
      return "Set where the props flip, then apply";
    case "reversal-length":
      return "How many steps before the pattern repeats";
    case "reversal-rhythm":
      return "Which steps in the cycle carry a flip";
    case "reversal-result":
      return "Tap a cell to flip that step's reversal";
    case "absolute":
      return "Set CW or CCW across the sequence";
    default:
      return "Two ways to control prop spin";
  }
}

/** Nesting level, so the drill-down can animate back the way it came. */
export function getDirectionDrillDepth(route: DirectionDrillRoute): number {
  if (route.startsWith("reversal-")) return 2;
  if (route === "hub") return 0;
  return 1;
}

export function getDirectionDrillParent(
  route: DirectionDrillRoute
): DirectionDrillRoute | null {
  if (route.startsWith("reversal-")) return "reversals";
  if (route === "reversals" || route === "absolute") return "hub";
  return null;
}

export function getReversalEditorStage(
  route: DirectionDrillRoute
): ReversalEditorStage {
  switch (route) {
    case "reversal-length":
      return "length";
    case "reversal-rhythm":
      return "rhythm";
    case "reversal-result":
      return "result";
    default:
      return "overview";
  }
}
