export type TimingMode = "together" | "split" | "quarter";

export function quarterPhase(turns: number): number {
  return ((turns % 4) + 4) % 4;
}

/** Keep the marker on the short arc, including across the bottom of the circle. */
export function nearestQuarterTurn(current: number, target: number): number {
  const delta = quarterPhase(target - current);
  return current + (delta > 2 ? delta - 4 : delta);
}

export function timingFromPhases(left: number, right: number): TimingMode {
  const offset = quarterPhase(right - left);
  return offset === 0 ? "together" : offset === 2 ? "split" : "quarter";
}
