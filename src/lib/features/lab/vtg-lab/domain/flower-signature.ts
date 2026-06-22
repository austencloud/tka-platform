import { TURN_VALUES } from "$lib/features/choreo-card/domain/turn-pattern-parser";

export type FlowerStyle = "pro" | "anti";
export type FlowerOri = "in" | "out";
/** Anchor of the downbeat: diamond = cardinal, box = 45°-rotated interradial. */
export type FlowerGrid = "diamond" | "box";

export interface Flower {
  readonly style: FlowerStyle;
  readonly turns: number;
  readonly ori: FlowerOri;
  readonly grid: FlowerGrid;
  readonly petals: number;
}

const ORIS: FlowerOri[] = ["in", "out"];
const STYLES: FlowerStyle[] = ["pro", "anti"];
const GRIDS: FlowerGrid[] = ["diamond", "box"];

/**
 * Box mode rotates the whole flower 45°. That rotation lands back on the
 * diamond placement only when the petal star is 45°-symmetric, i.e. petals
 * divisible by 8 (the 0-petal static point and the 8-petal antispin). For
 * those, box ≡ diamond — a duplicate worth collapsing.
 */
export function gridIsRedundant(f: Pick<Flower, "petals" | "grid">): boolean {
  return f.grid === "box" && f.petals % 8 === 0;
}

/** Petals: prospin = 2·turns, antispin = 2·turns + 2. */
export function flowerPetals(f: Pick<Flower, "style" | "turns">): number {
  return f.style === "pro" ? 2 * f.turns : 2 * f.turns + 2;
}

/** Deck-compatible turn token: integers bare, halves as X.5 (matches formatTurn). */
function fmtTurn(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Uniform per-hand turn pattern string, e.g. "0.5|0.5". */
export function flowerTurnPattern(f: Pick<Flower, "turns">): string {
  const t = fmtTurn(f.turns);
  return `${t}|${t}`;
}

export function flowerKey(f: Pick<Flower, "style" | "turns" | "ori" | "grid">): string {
  return `${f.style}-${fmtTurn(f.turns)}-${f.ori}-${f.grid}`;
}

/**
 * VTG spin ratio for a turn count: (2·turns + 1):1. The numerator is the same
 * for prospin and antispin at a given turn — the style sets the petal count
 * (prospin = P−1, antispin = P+1) — so the ratio labels the axis and the
 * blue/red style is read from the axis itself. E.g. 0.5t → "2:1" (antispin =
 * 3-petal triquetra). Turns are multiples of 0.5, so 2·turns is always integer.
 */
export function ratioLabel(turns: number): string {
  return `${2 * turns + 1}:1`;
}

export function flowerLabel(f: Flower): string {
  return `${ratioLabel(f.turns)} ${f.ori} ${f.grid} · ${f.petals}p`;
}

/**
 * The 56-flower axis (2 styles × 7 turns × 2 orientations × 2 grid anchors),
 * ordered by TURNS ascending with pro/anti alternating inside each turn step:
 * pro(in,out) then anti(in,out) at 0 turns, then the same at 0.5, 1, … This
 * makes complexity climb in one direction along the axis instead of restarting
 * simple→complex per style, which left a discontinuity seam mid-grid.
 * Tie-break: pro before anti, in before out, diamond before its 45° box twin.
 */
export function buildFlowerAxis(): Flower[] {
  const out: Flower[] = [];
  for (const turns of TURN_VALUES)
    for (const style of STYLES)
      for (const ori of ORIS)
        for (const grid of GRIDS)
          out.push({ style, turns, ori, grid, petals: flowerPetals({ style, turns }) });
  const styleRank = (s: FlowerStyle) => (s === "pro" ? 0 : 1);
  const oriRank = (o: FlowerOri) => (o === "in" ? 0 : 1);
  const gridRank = (g: FlowerGrid) => (g === "diamond" ? 0 : 1);
  return out.sort(
    (a, b) =>
      a.turns - b.turns ||
      styleRank(a.style) - styleRank(b.style) ||
      oriRank(a.ori) - oriRank(b.ori) ||
      gridRank(a.grid) - gridRank(b.grid),
  );
}
