/**
 * `repeat(auto-fill, minmax())` can't be trusted with a known, fixed item
 * count — it happily leaves one lonely tile stranded in its own row. This
 * picks the column count that avoids that: the largest count up to the cap
 * that doesn't leave exactly one item in the final row.
 */
export function fitColumns(count: number, maxCols: number): number {
  if (count <= 0) return 0;

  const cap = Math.max(1, Math.floor(maxCols));
  if (cap <= 1) return 1;

  for (let cols = cap; cols >= 2; cols--) {
    if (count % cols !== 1) return cols;
  }

  // No column count under the cap avoids the orphan (e.g. 7 items, cap 3).
  // The cap is still the right width; the wall absorbs the leftover by
  // spanning the second tile instead of shrinking further.
  return cap;
}
