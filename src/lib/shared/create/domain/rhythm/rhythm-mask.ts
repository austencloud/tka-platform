/**
 * Pure rhythm-mask engine. Decodes a rhythm symbol unit, tiles it to a period,
 * and answers the derived-highlight match questions. No framework deps.
 */
import type { RhythmDef } from "./rhythm-catalog";

export interface HandMask {
  readonly blue: boolean;
  readonly red: boolean;
}

/** Decode the i-th beat of a tiled per-hand symbol unit. */
export function maskAt(sym: string, i: number): HandMask {
  const s = sym[i % sym.length];
  return { blue: s === "P" || s === "B", red: s === "P" || s === "R" };
}

/** Single-lane: is beat i active (any non-dash symbol)? */
export function activeAt(sym: string, i: number): boolean {
  return sym[i % sym.length] !== "-";
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
  blue: readonly T[],
  red: readonly T[],
  base: T,
): boolean {
  const period = blue.length;
  let any = false;
  for (let i = 0; i < period; i++) {
    const m = maskAt(sym, i);
    if ((blue[i] !== base) !== m.blue) return false;
    if ((red[i] !== base) !== m.red) return false;
    if (m.blue || m.red) any = true;
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
  blueAmount: T,
  redAmount: T,
  base: T,
): { blue: T[]; red: T[] } {
  const blue: T[] = [];
  const red: T[] = [];
  for (let i = 0; i < period; i++) {
    const m = maskAt(rhythm.sym, i);
    blue.push(m.blue ? blueAmount : base);
    red.push(m.red ? redAmount : base);
  }
  return { blue, red };
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
