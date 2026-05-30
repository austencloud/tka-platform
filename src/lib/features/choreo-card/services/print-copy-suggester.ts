// Pure copy-count math for the element-grouped print layout. Under strict page
// isolation each element group of size `k` prints onto ceil(k·N / P) sheets at N
// copies, so "minimize empty space" is a 1-D search over the copy-count subspace.
// No DOM — fully unit-testable. Shared by the deck-viewer copies control.

export interface CopyWaste {
  /** Total sheets across all groups at this copy count. */
  sheets: number;
  /** Empty cells (padding) summed across every group's final partial sheet. */
  blanks: number;
  /** blanks / (sheets · cardsPerPage), 0..1. */
  wastePct: number;
}

export interface CopySuggestion extends CopyWaste {
  copies: number;
  /** blanks === 0 — every sheet is completely full. */
  perfect: boolean;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

/** Sheets + blank cells for `copies` copies of a deck whose element groups have
 *  sizes `groupSizes`, printed `cardsPerPage` per sheet with strict page
 *  isolation (a group never shares a sheet with another color). */
export function copyWaste(groupSizes: number[], cardsPerPage: number, copies: number): CopyWaste {
  const n = Math.max(1, Math.floor(copies || 1));
  let sheets = 0;
  for (const k of groupSizes) sheets += Math.ceil((k * n) / cardsPerPage);
  const cards = groupSizes.reduce((sum, k) => sum + k, 0) * n;
  const blanks = sheets * cardsPerPage - cards;
  return { sheets, blanks, wastePct: sheets > 0 ? blanks / (sheets * cardsPerPage) : 0 };
}

/** Smallest copy count with zero blanks: lcm over distinct group sizes k of
 *  (cardsPerPage / gcd(cardsPerPage, k)). 1 for an empty deck. */
export function minZeroWasteCopies(groupSizes: number[], cardsPerPage: number): number {
  const distinct = [...new Set(groupSizes)].filter((k) => k > 0);
  let n = 1;
  for (const k of distinct) n = lcm(n, cardsPerPage / gcd(cardsPerPage, k));
  return n;
}

/** The Pareto-improving ladder of copy counts: each entry strictly beats the
 *  waste% of every smaller count, walking N = 1 up to the first perfect fit.
 *  Always starts at 1; the last entry is the zero-waste count. When the ladder
 *  exceeds `limit`, keep copies=1 plus the lowest-waste tail (the perfect fit
 *  always survives). */
export function suggestCopyCounts(
  groupSizes: number[],
  cardsPerPage: number,
  opts: { limit?: number; maxN?: number } = {},
): CopySuggestion[] {
  const limit = opts.limit ?? 5;
  if (groupSizes.length === 0) {
    const w = copyWaste([], cardsPerPage, 1);
    return [{ copies: 1, ...w, perfect: true }];
  }

  const nMin = minZeroWasteCopies(groupSizes, cardsPerPage);
  const maxN = Math.min(opts.maxN ?? nMin, nMin, 64);

  const ladder: CopySuggestion[] = [];
  let bestWaste = Infinity;
  for (let n = 1; n <= maxN; n++) {
    const w = copyWaste(groupSizes, cardsPerPage, n);
    if (w.wastePct < bestWaste - 1e-9) {
      bestWaste = w.wastePct;
      ladder.push({ copies: n, ...w, perfect: w.blanks === 0 });
    }
  }

  if (ladder.length <= limit) return ladder;
  const head = ladder[0]!; // copies === 1
  const tail = ladder.slice(ladder.length - (limit - 1));
  return [head, ...tail.filter((s) => s.copies !== head.copies)];
}
