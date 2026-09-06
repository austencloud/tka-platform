export type TimingMode = "together" | "split" | "quarter";
export type Rotation = 1 | -1;
export type Placement = "alpha" | "beta" | "gamma" | "between";

/** A cycle starts at the downbeat and advances in time, regardless of rotation. */
export function cycle(value: number): number {
  return ((value % 1) + 1) % 1;
}
/** A downbeat briefly lights its stationary dot; no position implies timing. */
export function downbeatPulse(elapsed: number, offset: number): number {
  return Math.max(0, 1 - cycle(elapsed - offset) / 0.15);
}
export function spatialPhase(phase: number, rotation: Rotation): number {
  return cycle(phase * rotation);
}
export function timePhase(position: number, rotation: Rotation): number {
  return cycle(position * rotation);
}
export function cycleSeparation(left: number, right: number): number {
  const distance = cycle(right - left);
  return Math.min(distance, 1 - distance);
}
export function timingFromPhases(
  left: number,
  right: number
): TimingMode | "offset" {
  const gap = cycleSeparation(left, right);
  if (gap < 0.000001) return "together";
  if (Math.abs(gap - 0.5) < 0.000001) return "split";
  if (Math.abs(gap - 0.25) < 0.000001) return "quarter";
  return "offset";
}
/** Placement consumes spatial coordinates, never downbeat phase. */
export function placementFromPositions(left: number, right: number): Placement {
  const gap = cycleSeparation(left, right);
  if (gap < 0.000001) return "beta";
  if (Math.abs(gap - 0.5) < 0.000001) return "alpha";
  if (Math.abs(gap - 0.25) < 0.000001) return "gamma";
  return "between";
}
/** Actual downbeat crossings in the displayed two-cycle interval. */
export function downbeatEvents(offset: number): number[] {
  const first = cycle(-offset);
  return first < 0.000001 ? [0, 1, 2] : [first, first + 1];
}
export function nextDownbeat(time: number, offsets: readonly number[]): number {
  return (
    time +
    Math.min(
      ...offsets.map((offset) => {
        const remaining = cycle(-(time + offset));
        return remaining < 0.000001 ? 1 : remaining;
      })
    )
  );
}
