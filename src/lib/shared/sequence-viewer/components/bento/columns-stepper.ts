/**
 * Cycle helpers for the inline Columns stepper on the mobile card export
 * bento tile. The value null represents "Auto". Valid numeric values are
 * 2..stepCount (inclusive).
 */

export function nextColumnValue(
  current: number | null,
  stepCount: number,
): number | null {
  if (stepCount < 2) return null;
  if (current === null) return 2;
  if (current >= stepCount) return null;
  if (current < 2) return 2;
  return current + 1;
}

export function prevColumnValue(
  current: number | null,
  stepCount: number,
): number | null {
  if (stepCount < 2) return null;
  if (current === null) return stepCount;
  if (current <= 2) return null;
  return current - 1;
}
