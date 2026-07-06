/**
 * Render-time paragraph grouping for the auto-populated proof pages.
 *
 * The proof extractor emits one `ProofRun` per text fragment — every visual line,
 * and every emphasis fragment within a line, is its own run. `groupRuns` clusters
 * those runs back into paragraph GROUPS (by their own coordinates) so the guide's
 * dev "Illustrator mode" can move + edit a paragraph as one unit, without touching
 * the GENERATED `proof-text.ts` and without changing the faithful printed output.
 *
 * Pure and unit-tested (`tests/unit/guide/proof-grouping.test.ts`). No DOM.
 */
import type { ProofRun } from "./proof-text";

export type GroupAlign = "left" | "center";

export type Group = {
  id: string;
  /** Owned copies of the member runs — mutating x/y repositions the group. */
  runs: ProofRun[];
  /** bbox top-left, proof points. */
  x0: number;
  y0: number;
  align: GroupAlign;
  /** center-x when align=center, else x0 (proof points). */
  anchorX: number;
  /** line-height ratio (median line gap ÷ dominant fs) for the collapsed block. */
  leading: number;
  /** dominant font size, proof points. */
  fs: number;
  /** combined html: runs styled + space-joined, lines joined by <br>. */
  html: string;
  /** ≥2 runs — a real paragraph / multi-emphasis line (gets the group handle). */
  multi: boolean;
};

const LINE_TOL = 4; // pt: runs within this Δy are the same visual line
const PARA_GAP_FACTOR = 1.5; // pt gap ≤ fs × this stays in the paragraph
const FS_TOL = 2; // pt: lines must share ~same font size to group
const CENTER_TOL = 5; // pt: multi-line centers within this ⇒ centered
const SHEET_CENTER = 306; // 612 / 2
const ONE_LINE_CENTER_TOL = 40; // pt: single line this close to center ⇒ centered
const ONE_LINE_MAX_W = 460; // pt: a full-width single line isn't a centered caption
const SPACE_GAP = 2; // pt: x-gap beyond this ⇒ insert a space between runs
const DEFAULT_LEADING = 1.2;

type Line = {
  runs: ProofRun[];
  y: number; // top (min y) of the line
  left: number;
  right: number;
  center: number;
  fs: number; // dominant fs (fs of the widest run)
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wrapRun(r: ProofRun): string {
  const t = escapeHtml(r.t);
  switch (r.s) {
    case "bold":
    case "heading":
      return `<strong>${t}</strong>`;
    case "italic":
      return `<em>${t}</em>`;
    case "bolditalic":
      return `<strong><em>${t}</em></strong>`;
    default:
      return t;
  }
}

function lineHtml(runs: ProofRun[]): string {
  let html = "";
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i]!;
    if (i > 0) {
      const prev = runs[i - 1]!;
      if (r.x - (prev.x + prev.w) > SPACE_GAP) html += " ";
    }
    html += wrapRun(r);
  }
  return html;
}

/** fs of the widest run — the body text, not a stray narrow emphasis fragment. */
function dominantFs(runs: ProofRun[]): number {
  let best = runs[0]!;
  for (const r of runs) if (r.w > best.w) best = r;
  return best.fs;
}

function buildLines(runs: ProofRun[]): Line[] {
  const sorted = [...runs].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  let cur: ProofRun[] = [];
  let refY = 0;
  for (const r of sorted) {
    if (cur.length === 0 || r.y - refY <= LINE_TOL) {
      if (cur.length === 0) refY = r.y;
      cur.push(r);
    } else {
      lines.push(finishLine(cur));
      cur = [r];
      refY = r.y;
    }
  }
  if (cur.length) lines.push(finishLine(cur));
  return lines;
}

function finishLine(runs: ProofRun[]): Line {
  const ordered = [...runs].sort((a, b) => a.x - b.x);
  const left = Math.min(...ordered.map((r) => r.x));
  const right = Math.max(...ordered.map((r) => r.x + r.w));
  const y = Math.min(...ordered.map((r) => r.y));
  return { runs: ordered, y, left, right, center: (left + right) / 2, fs: dominantFs(ordered) };
}

function alignOf(lines: Line[]): { align: GroupAlign; anchorX: number } {
  if (lines.length >= 2) {
    const mean = lines.reduce((s, l) => s + l.center, 0) / lines.length;
    const centered = lines.every((l) => Math.abs(l.center - mean) <= CENTER_TOL);
    return centered ? { align: "center", anchorX: mean } : { align: "left", anchorX: Math.min(...lines.map((l) => l.left)) };
  }
  const l = lines[0]!;
  const centered = Math.abs(l.center - SHEET_CENTER) <= ONE_LINE_CENTER_TOL && l.right - l.left < ONE_LINE_MAX_W;
  return centered ? { align: "center", anchorX: l.center } : { align: "left", anchorX: l.left };
}

function leadingOf(lines: Line[], fs: number): number {
  if (lines.length < 2) return DEFAULT_LEADING;
  const gaps = lines.slice(1).map((l, i) => l.y - lines[i]!.y).sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)]!;
  return Math.min(2, Math.max(1, median / fs));
}

/** Cluster a page's runs into paragraph groups. `runs` is not mutated. */
export function groupRuns(runs: ProofRun[], pageId: string): Group[] {
  if (runs.length === 0) return [];
  const lines = buildLines(runs);

  // Fold lines into paragraphs: small vertical gap + horizontal overlap + like fs.
  const paras: Line[][] = [];
  let cur: Line[] = [];
  let bbLeft = 0;
  let bbRight = 0;
  for (const line of lines) {
    if (cur.length === 0) {
      cur = [line];
      bbLeft = line.left;
      bbRight = line.right;
      continue;
    }
    const prev = cur[cur.length - 1]!;
    const yGap = line.y - prev.y;
    const overlaps = line.left <= bbRight && line.right >= bbLeft;
    const sameSize = Math.abs(line.fs - prev.fs) <= FS_TOL;
    if (yGap > 0 && yGap <= prev.fs * PARA_GAP_FACTOR && overlaps && sameSize) {
      cur.push(line);
      bbLeft = Math.min(bbLeft, line.left);
      bbRight = Math.max(bbRight, line.right);
    } else {
      paras.push(cur);
      cur = [line];
      bbLeft = line.left;
      bbRight = line.right;
    }
  }
  if (cur.length) paras.push(cur);

  return paras.map((plines, i) => {
    const memberRuns = plines.flatMap((l) => l.runs);
    const fs = dominantFs(memberRuns);
    const { align, anchorX } = alignOf(plines);
    return {
      id: `proof-${pageId}-g${i}`,
      runs: memberRuns,
      x0: Math.min(...plines.map((l) => l.left)),
      y0: Math.min(...plines.map((l) => l.y)),
      align,
      anchorX,
      leading: leadingOf(plines, fs),
      fs,
      html: plines.map((l) => lineHtml(l.runs)).join("<br>"),
      multi: memberRuns.length >= 2,
    };
  });
}
