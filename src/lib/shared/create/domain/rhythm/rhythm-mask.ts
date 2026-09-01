/**
 * Pure rhythm-mask engine. Decodes a rhythm symbol unit, tiles it to a period,
 * and answers the derived-highlight match questions. No framework deps.
 */
import type { RhythmDef } from "./rhythm-catalog";

export interface HandMask {
  readonly left: boolean;
  readonly right: boolean;
}

/** Decode the i-th beat of a tiled per-hand symbol unit. */
export function maskAt(sym: string, i: number): HandMask {
  const s = sym[i % sym.length];
  return { left: s === "P" || s === "B", right: s === "P" || s === "R" };
}

/** Single-lane: is beat i active (any non-dash symbol)? */
export function activeAt(sym: string, i: number): boolean {
  return sym[i % sym.length] !== "-";
}

/**
 * One hand's share of a per-hand rhythm, tiled to a period.
 *
 * A rhythm names what the PAIR does — "Blue Book" is left-only, "Alternating"
 * is the two hands trading off. A sentence about one hand can only offer that
 * hand's half of it, so this projects the symbol onto a single lane: left takes
 * every P and B, right takes every P and R.
 */
export function laneMaskFor(sym: string, laneIndex: number, period: number): boolean[] {
  return Array.from({ length: period }, (_, i) => {
    const m = maskAt(sym, i);
    return laneIndex === 0 ? m.left : m.right;
  });
}

/** Divisors of n, ascending, capped at `cap` (valid pattern periods). */
export function divisorsUpTo(n: number, cap = 8): number[] {
  const out: number[] = [];
  for (let p = 1; p <= Math.min(n, cap); p++) if (n % p === 0) out.push(p);
  return out;
}

/** The single value shared by all non-base entries, else null. */
export function uniformActive<T>(arr: readonly T[], base: T): T | null {
  let v: T | null = null;
  for (const x of arr) {
    if (x === base) continue;
    if (v === null) v = x;
    else if (x !== v) return null;
  }
  return v;
}

/** True when every entry equals base. */
export function allBase<T>(arr: readonly T[], base: T): boolean {
  return arr.every((x) => x === base);
}

/** Tile an array to a target length by modulo. */
export function tilePeriod<T>(arr: readonly T[], targetLen: number): T[] {
  return Array.from({ length: targetLen }, (_, i) => arr[i % arr.length]!);
}

/** Resize to a new period, tiling existing values, filling gaps. */
export function resizePeriod<T>(arr: readonly T[], newPeriod: number, fill: T): T[] {
  return Array.from({ length: newPeriod }, (_, i) => arr[i % arr.length] ?? fill);
}

/** Does the per-hand strip exactly match the rhythm (and have ≥1 active beat)? */
export function perHandRhythmMatches<T>(
  sym: string,
  left: readonly T[],
  right: readonly T[],
  base: T,
): boolean {
  const period = left.length;
  let any = false;
  for (let i = 0; i < period; i++) {
    const m = maskAt(sym, i);
    if ((left[i] !== base) !== m.left) return false;
    if ((right[i] !== base) !== m.right) return false;
    if (m.left || m.right) any = true;
  }
  return any;
}

/** Single-lane match (≥1 active beat). */
export function singleLaneRhythmMatches<T>(
  sym: string,
  values: readonly T[],
  base: T,
): boolean {
  const period = values.length;
  let any = false;
  for (let i = 0; i < period; i++) {
    const isActive = values[i] !== base;
    if (isActive !== activeAt(sym, i)) return false;
    if (activeAt(sym, i)) any = true;
  }
  return any;
}

/** Stamp a per-hand rhythm into fresh strip arrays using per-hand amounts. */
export function stampPerHand<T>(
  rhythm: RhythmDef,
  period: number,
  leftAmount: T,
  rightAmount: T,
  base: T,
): { left: T[]; right: T[] } {
  const left: T[] = [];
  const right: T[] = [];
  for (let i = 0; i < period; i++) {
    const m = maskAt(rhythm.sym, i);
    left.push(m.left ? leftAmount : base);
    right.push(m.right ? rightAmount : base);
  }
  return { left, right };
}

/** Stamp a single-lane rhythm into a fresh array using one amount. */
export function stampSingle<T>(
  rhythm: RhythmDef,
  period: number,
  amount: T,
  base: T,
): T[] {
  return Array.from({ length: period }, (_, i) =>
    activeAt(rhythm.sym, i) ? amount : base,
  );
}
