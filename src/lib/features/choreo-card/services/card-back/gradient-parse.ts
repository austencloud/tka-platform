/**
 * gradient-parse.ts
 *
 * Parse a single CSS `linear-gradient(...)` declaration into the plain-data
 * `GradientSpec` the BackJob painter (P1.6) consumes (canvas
 * createLinearGradient + addColorStop). The card-back PRINT path is proof mode
 * — every background/border is a single `linear-gradient(<angle>deg, <color>
 * <pct>%, ...)` (see card-back-theme-visuals.getProofModeVisuals), so that is
 * the case this parser is built for.
 *
 * DOCUMENTED LIMITATION: the non-proof (dark) themes use multi-layer
 * backgrounds (e.g. rainbow stacks a rainbow `linear-gradient` over a base
 * `linear-gradient`). When multiple top-level gradients are present, this
 * parser extracts the LAST `linear-gradient(...)` (the base layer that paints
 * the card body) and does not throw. Radial/conic gradients are unsupported;
 * the same "last linear-gradient" fallback applies. The print path never hits
 * either case.
 */

import type { GradientSpec } from "./back-job";

/** Default CSS gradient angle when no `<angle>deg` prefix is present (CSS spec: to bottom = 180deg). */
const DEFAULT_ANGLE_DEG = 180;

/**
 * Parse a CSS `linear-gradient(...)` string into a `GradientSpec`.
 *
 * @param css A CSS value containing at least one `linear-gradient(...)`.
 *            If several top-level gradients are present, the LAST
 *            `linear-gradient(...)` is parsed (the base layer).
 * @returns A `GradientSpec` with the angle (default 180) and ordered stops.
 *          Stop offsets are 0..1; an explicit `%` sets the offset, otherwise
 *          stops are distributed evenly across the [0,1] range (CSS default).
 */
export function parseLinearGradient(css: string): GradientSpec {
  const inner = extractLastLinearGradientInner(css);
  if (inner === null) {
    // Not a linear-gradient at all — return a degenerate single-stop spec so
    // the painter still produces a flat fill rather than throwing.
    return { type: "linear", angleDeg: DEFAULT_ANGLE_DEG, stops: [] };
  }

  const parts = splitTopLevel(inner);

  let angleDeg = DEFAULT_ANGLE_DEG;
  let stopParts = parts;

  // A leading `<angle>deg` (or `to <side>`) part is NOT a color stop.
  const first = parts[0]?.trim() ?? "";
  const angleMatch = /^(-?[\d.]+)deg$/.exec(first);
  if (angleMatch) {
    angleDeg = parseFloat(angleMatch[1]!);
    stopParts = parts.slice(1);
  } else if (/^to\s+/i.test(first)) {
    angleDeg = sideToAngle(first);
    stopParts = parts.slice(1);
  }

  const stops = parseStops(stopParts);
  return { type: "linear", angleDeg, stops };
}

/**
 * Find the LAST top-level `linear-gradient(...)` and return its inner content
 * (between the parens), or null if there is none.
 */
function extractLastLinearGradientInner(css: string): string | null {
  const needle = "linear-gradient(";
  let searchFrom = 0;
  let lastInner: string | null = null;

  for (;;) {
    const idx = css.indexOf(needle, searchFrom);
    if (idx === -1) break;
    const openParen = idx + needle.length - 1;
    const close = matchParen(css, openParen);
    if (close === -1) break;
    lastInner = css.slice(openParen + 1, close);
    searchFrom = close + 1;
  }

  return lastInner;
}

/** Given the index of an `(`, return the index of its matching `)`, or -1. */
function matchParen(s: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split a comma-separated list at the TOP level (ignoring commas inside parens). */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out.map((p) => p.trim()).filter((p) => p.length > 0);
}

/**
 * Parse the color-stop parts into ordered { offset, color } entries.
 * Stops with explicit `%` get that offset (0..1). Stops without an explicit
 * position are distributed evenly across the remaining range, per CSS rules:
 * first defaults to 0, last to 1, interior evenly spaced.
 */
function parseStops(parts: string[]): { offset: number; color: string }[] {
  const raw = parts.map((part) => {
    const { color, pct } = splitColorAndPosition(part);
    return { color, offset: pct };
  });

  const n = raw.length;
  for (let i = 0; i < n; i++) {
    if (raw[i]!.offset === null) {
      if (i === 0) raw[i]!.offset = 0;
      else if (i === n - 1) raw[i]!.offset = 1;
      else raw[i]!.offset = n > 1 ? i / (n - 1) : 0;
    }
  }

  return raw.map((s) => ({ offset: s.offset as number, color: s.color }));
}

/**
 * Separate a color from a trailing position. The color may itself contain
 * spaces inside parens — e.g. `rgba(0, 0, 0, 0.5) 40%` — so split on the LAST
 * top-level whitespace run only when the tail looks like a `<pct>%` position.
 */
function splitColorAndPosition(part: string): { color: string; pct: number | null } {
  const trimmed = part.trim();

  // A trailing percentage position: capture it, strip it off the color.
  const pctMatch = /\s+(-?[\d.]+)%\s*$/.exec(trimmed);
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1]!) / 100;
    const color = trimmed.slice(0, pctMatch.index).trim();
    return { color, pct };
  }

  return { color: trimmed, pct: null };
}

/** Map a `to <side>` keyword direction to its CSS angle (deg). */
function sideToAngle(side: string): number {
  const s = side.toLowerCase().replace(/^to\s+/, "").trim();
  switch (s) {
    case "top": return 0;
    case "right": return 90;
    case "bottom": return 180;
    case "left": return 270;
    case "top right":
    case "right top": return 45;
    case "bottom right":
    case "right bottom": return 135;
    case "bottom left":
    case "left bottom": return 225;
    case "top left":
    case "left top": return 315;
    default: return DEFAULT_ANGLE_DEG;
  }
}
