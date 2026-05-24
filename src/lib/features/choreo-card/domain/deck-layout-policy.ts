export function getDeckLayoutPolicy(stepCount: number): "row" | "column" {
  if (stepCount === 8) return "column";
  return "row";
}
