const COLUMN_THRESHOLD = 5;

export function getDeckLayoutPolicy(stepCount: number): "row" | "column" {
  return stepCount >= COLUMN_THRESHOLD ? "column" : "row";
}
