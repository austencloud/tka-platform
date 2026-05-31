/**
 * Column-count options for the card export Columns control.
 *
 * The value null represents "Auto". Numeric values are beat-column counts.
 * `columnOptionsFor` is the single source of truth shared by the desktop chip
 * group and the mobile inline stepper, so both offer the same set.
 */

const BASE_COLUMN_VALUES = [2, 3, 4, 5, 6, 7, 8] as const;

/**
 * Valid numeric column counts for a sequence of `stepCount` beats.
 * 4-beat sequences read awkwardly at 3 columns (3 + 1 ragged orphan row),
 * so 3 is hidden there.
 */
export function columnOptionsFor(stepCount: number): number[] {
  return BASE_COLUMN_VALUES.filter((v) => {
    if (v > stepCount) return false;
    if (stepCount === 4 && v === 3) return false;
    return true;
  });
}

export function nextColumnValue(
  current: number | null,
  stepCount: number,
): number | null {
  const opts: (number | null)[] = [null, ...columnOptionsFor(stepCount)];
  if (opts.length <= 1) return null;
  const i = opts.indexOf(current);
  if (i === -1) return null; // stale/out-of-range selection → Auto
  return opts[(i + 1) % opts.length] ?? null;
}

export function prevColumnValue(
  current: number | null,
  stepCount: number,
): number | null {
  const opts: (number | null)[] = [null, ...columnOptionsFor(stepCount)];
  if (opts.length <= 1) return null;
  const i = opts.indexOf(current);
  if (i === -1) return null;
  return opts[(i - 1 + opts.length) % opts.length] ?? null;
}
