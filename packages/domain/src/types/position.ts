export type PositionName = "alpha" | "beta" | "gamma" | "zeta" | "eta" | "tau" | "terra";

export interface PositionDefinition {
  name: string;
  symbol: string;
  angle: string;
  description: string;
  gridDescription: string;
  examples: string[];
  level: number;
  keyFact: string;
}
