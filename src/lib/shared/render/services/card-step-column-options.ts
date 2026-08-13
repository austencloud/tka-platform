const MIN_STEP_COLUMNS = 2;
const MAX_STEP_COLUMNS = 8;

/**
 * Canonical step-column counts for a card of this length.
 *
 * Exact divisors keep the step region rectangular: 16 steps can use 2, 4, or
 * 8 columns, while 12 can use 2, 3, 4, or 6. Prime counts above the eight-column
 * ceiling return no canonical option, leaving Auto responsible for the ragged
 * fallback.
 */
export function getCanonicalCardStepColumnCounts(stepCount: number): number[] {
  if (stepCount < MIN_STEP_COLUMNS) return [];

  const counts: number[] = [];
  const ceiling = Math.min(MAX_STEP_COLUMNS, stepCount);
  for (let columns = MIN_STEP_COLUMNS; columns <= ceiling; columns++) {
    if (stepCount % columns === 0) counts.push(columns);
  }
  return counts;
}
