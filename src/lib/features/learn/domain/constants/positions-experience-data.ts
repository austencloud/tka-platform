/**
 * Positions Concept Experience data constants
 */

export type HandPosition = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export interface PositionExample {
  left: HandPosition;
  right: HandPosition;
}

export const ALPHA_EXAMPLES: readonly PositionExample[] = [
  { left: "N", right: "S" },
  { left: "E", right: "W" },
  { left: "NE", right: "SW" },
  { left: "NW", right: "SE" },
] as const;

export const BETA_EXAMPLES: readonly PositionExample[] = [
  { left: "N", right: "N" },
  { left: "E", right: "E" },
  { left: "SW", right: "SW" },
  { left: "NE", right: "NE" },
] as const;

export const GAMMA_EXAMPLES: readonly PositionExample[] = [
  { left: "N", right: "E" },
  { left: "N", right: "W" },
  { left: "S", right: "E" },
  { left: "NE", right: "SE" },
] as const;

export interface PositionInfo {
  name: string;
  icon: string;
  summary: string;
  angle: string;
  color: string;
  description: string;
  examples: string;
}

export const POSITION_INFO: Record<"alpha" | "beta" | "gamma", PositionInfo> = {
  alpha: {
    name: "Alpha",
    icon: "fa-arrows-left-right",
    summary: "Hands at opposite points on the grid",
    angle: "180°",
    color: "#FF6B6B",
    description: "Hands form a straight line through the center",
    examples: "N↔S, E↔W, NE↔SW, NW↔SE",
  },
  beta: {
    name: "Beta",
    icon: "fa-circle-dot",
    summary: "Hands at the same point on the grid",
    angle: "0°",
    color: "#4ECDC4",
    description: "Both hands occupy the identical position",
    examples: "Both at N, both at E, both at SW",
  },
  gamma: {
    name: "Gamma",
    icon: "fa-rotate-right",
    summary: "Hands at right angles (90°) to each other",
    angle: "90°",
    color: "#FFE66D",
    description: "Hands are perpendicular to each other",
    examples: "N+E, N+W, S+E, S+W, NE+NW",
  },
};
