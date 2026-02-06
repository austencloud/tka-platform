/**
 * Position Identification Quiz data constants
 */

export type PositionType = "alpha" | "beta" | "gamma";
export type HandPosition = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export interface PositionQuestion {
  left: HandPosition;
  right: HandPosition;
  type: PositionType;
}

export interface PositionTypeInfo {
  icon: string;
  label: string;
  color: string;
}

export const POSITION_TYPE_INFO: Record<PositionType, PositionTypeInfo> = {
  alpha: { icon: "fa-arrows-left-right", label: "Alpha", color: "#FF6B6B" },
  beta: { icon: "fa-circle-dot", label: "Beta", color: "#4ECDC4" },
  gamma: { icon: "fa-rotate-right", label: "Gamma", color: "#FFE66D" },
};

export const ALPHA_POSITIONS: { left: HandPosition; right: HandPosition }[] = [
  { left: "N", right: "S" },
  { left: "E", right: "W" },
  { left: "NE", right: "SW" },
  { left: "NW", right: "SE" },
];

export const BETA_POSITIONS: { left: HandPosition; right: HandPosition }[] = [
  { left: "N", right: "N" },
  { left: "E", right: "E" },
  { left: "S", right: "S" },
  { left: "NW", right: "NW" },
];

export const GAMMA_POSITIONS: { left: HandPosition; right: HandPosition }[] = [
  { left: "N", right: "E" },
  { left: "N", right: "W" },
  { left: "S", right: "E" },
  { left: "S", right: "W" },
  { left: "NE", right: "SE" },
  { left: "NE", right: "NW" },
];

export function generatePositionQuestions(): PositionQuestion[] {
  const questions: PositionQuestion[] = [];

  // Add 3 of each type
  for (let i = 0; i < 3; i++) {
    const alphaIdx = Math.floor(Math.random() * ALPHA_POSITIONS.length);
    questions.push({ ...ALPHA_POSITIONS[alphaIdx]!, type: "alpha" });

    const betaIdx = Math.floor(Math.random() * BETA_POSITIONS.length);
    questions.push({ ...BETA_POSITIONS[betaIdx]!, type: "beta" });

    const gammaIdx = Math.floor(Math.random() * GAMMA_POSITIONS.length);
    questions.push({ ...GAMMA_POSITIONS[gammaIdx]!, type: "gamma" });
  }

  // Shuffle
  return questions.sort(() => Math.random() - 0.5);
}
