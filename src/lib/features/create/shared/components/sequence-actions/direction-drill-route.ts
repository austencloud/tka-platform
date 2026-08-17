export type DirectionDrillRoute = "hub" | "reversals" | "absolute";

export function getDirectionDrillTitle(route: DirectionDrillRoute): string {
  switch (route) {
    case "reversals":
      return "Reversals";
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
      return "Say where each hand flips, then apply";
    case "absolute":
      return "Set CW or CCW across the sequence";
    default:
      return "Two ways to control prop spin";
  }
}

/** Nesting level, so the drill-down can animate back the way it came. */
export function getDirectionDrillDepth(route: DirectionDrillRoute): number {
  return route === "hub" ? 0 : 1;
}

export function getDirectionDrillParent(
  route: DirectionDrillRoute
): DirectionDrillRoute | null {
  if (route === "reversals" || route === "absolute") return "hub";
  return null;
}
