export type GridModeName = "diamond" | "box" | "skewed" | "centric";

export interface GridModeDefinition {
  name: string;
  description: string;
  points: string[];
  positions: string[];
  keyFact: string;
  level?: number;
}
