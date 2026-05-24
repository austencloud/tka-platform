export function getDeckLayoutPolicy(stepCount: number): "row" | "column" {
  if (stepCount === 8 || stepCount === 12) return "column";
  return "row";
}
