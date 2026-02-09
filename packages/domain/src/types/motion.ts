export type MotionTypeName = "static" | "shift" | "dash" | "hash" | "float";

export interface MotionTypeDefinition {
  name: string;
  description: string;
  gridMovement: string;
  distance: string;
  keyFact: string;
  level?: number;
}
