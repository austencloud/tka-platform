/**
 * Theory tiles, painted by the Shape Matrix's own painter.
 *
 * The Matrix builds its geometry by realizing a flower as a real TKA sequence
 * and running it through the mandala calculator. A ratio like 4:9 has no
 * sequence to realize — that is the entire reason the Theory surface exists —
 * so its geometry comes from the QfT model instead.
 *
 * Everything downstream of the path stays shared: the same
 * `renderCell` / `renderHeader` guide painter, the same hand colours, the same
 * 2.5px stroke, the same purple overlap, the same extent fit. A Theory tile is
 * a Matrix tile whose curve was computed a different way, which is the point.
 */
import type {
  MandalaPaths,
  SVGPathData,
} from "$lib/shared/mandala/domain/mandala-types";
import {
  ENGINE_GRID_RADIUS,
  MANDALA_GRID_RADIUS,
} from "$lib/shared/mandala/domain/mandala-constants";
import {
  closedPathSampleCount,
  posesAt,
  revolutionsToClose,
} from "$lib/shared/notation/qft/qft-model";
import { renderCell, renderHeader } from "./shape-matrix-render";
import {
  theoryFlowerKey,
  theoryKnobs,
  type TheoryFlower,
} from "../domain/theory-flower";
import type { VtgMode } from "./shape-matrix-realizations";

/** Eight compass steps make one hand revolution in the QfT model. */
const STEPS_PER_REVOLUTION = 8;

/**
 * A path that never leaves one point is not a path. The 1:1 prospin isolation
 * collapses to the axis of rotation exactly, and a zero-length polyline is
 * dropped by the painter's degenerate-path guard — so the still point is drawn
 * as a small disc instead, the same fact the index thumbnails show.
 */
const STILL_POINT_SPAN = 0.5;
const STILL_POINT_RADIUS = MANDALA_GRID_RADIUS * 0.055;

/*
 * Timing and direction are relationships BETWEEN the hands, and a closed curve
 * keeps its shape when you start it somewhere else or run it backwards: a
 * two-petal rose rotated 180 degrees is the same two petals, and a circle
 * traced the other way is the same circle. Without a mark on it, a still tile
 * therefore cannot show split against together, or same against opposite.
 *
 * The mark is a chevron sitting on the curve at the downbeat, pointing the way
 * that hand travels. Timing swings it around the curve; direction turns it
 * around. Both readings are the ones a spinner actually needs, and the whole
 * pairing becomes legible in the grid rather than only in the animation.
 */
const START_MARK_SPAN = 0.085;
const START_MARK_WIDTH = 0.6;
/** How far along the curve to look for a stable heading, as a span fraction. */
const START_MARK_TANGENT = 0.05;

function propReachFor(clubTipDx: number): number {
  return (clubTipDx * MANDALA_GRID_RADIUS) / ENGINE_GRID_RADIUS;
}

function traceFlower(
  flower: TheoryFlower,
  hand: "left" | "right",
  mode: VtgMode,
  clubTipDx: number
): Array<{ x: number; y: number }> {
  const knobs = theoryKnobs(flower, hand, mode);
  const samples = closedPathSampleCount(knobs);
  const span = STEPS_PER_REVOLUTION * revolutionsToClose(knobs);
  const handRadius = MANDALA_GRID_RADIUS;
  const propRadius = propReachFor(clubTipDx);

  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= samples; i += 1) {
    // `posesAt` works in prop lengths with the hand orbit also at 1. The two
    // radii are separate here so the drawing carries the real prop reach of
    // the selected prop, the same one the Matrix tiles are drawn at.
    const pose = posesAt(knobs, (i / samples) * span);
    points.push({
      x: pose.hand.x * handRadius + (pose.head.x - pose.hand.x) * propRadius,
      y: pose.hand.y * handRadius + (pose.head.y - pose.hand.y) * propRadius,
    });
  }
  return points;
}

/** The chevron at the downbeat, or null when the curve is too short to aim. */
function startMark(
  points: Array<{ x: number; y: number }>,
  span: number
): SVGPathData | null {
  const start = points[0];
  if (!start) return null;
  const reach = span * START_MARK_TANGENT;
  const ahead = points.find(
    (point) => Math.hypot(point.x - start.x, point.y - start.y) >= reach
  );
  if (!ahead) return null;

  const dx = ahead.x - start.x;
  const dy = ahead.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;

  const ux = dx / length;
  const uy = dy / length;
  const size = span * START_MARK_SPAN;
  const wing = size * START_MARK_WIDTH;
  const tipX = start.x + ux * size;
  const tipY = start.y + uy * size;
  const at = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`;
  return {
    d:
      `M${at(start.x - uy * wing, start.y + ux * wing)} ` +
      `L${at(tipX, tipY)} ` +
      `L${at(start.x + uy * wing, start.y - ux * wing)}`,
    tipIndex: 1,
  };
}

function toPathData(points: Array<{ x: number; y: number }>): SVGPathData[] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  if (Math.max(maxX - minX, maxY - minY) < STILL_POINT_SPAN) {
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const r = STILL_POINT_RADIUS;
    return [
      {
        d:
          `M${(cx - r).toFixed(2)},${cy.toFixed(2)} ` +
          `a${r.toFixed(2)},${r.toFixed(2)} 0 1,0 ${(r * 2).toFixed(2)},0 ` +
          `a${r.toFixed(2)},${r.toFixed(2)} 0 1,0 ${(-r * 2).toFixed(2)},0 Z`,
        tipIndex: 0,
      },
    ];
  }

  const d = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`
    )
    .join(" ");
  const mark = startMark(points, Math.max(maxX - minX, maxY - minY));
  return mark ? [{ d, tipIndex: 0 }, mark] : [{ d, tipIndex: 0 }];
}

export function theoryFlowerPaths(
  flower: TheoryFlower,
  hand: "left" | "right",
  mode: VtgMode,
  clubTipDx: number
): MandalaPaths {
  const traced = toPathData(traceFlower(flower, hand, mode, clubTipDx));
  return hand === "left"
    ? { left: traced, right: [], purple: [] }
    : { left: [], right: traced, purple: [] };
}

/** Rasters are per size and DPR; keep the recent ones, drop the rest. */
const ARTWORK_CACHE_LIMIT = 512;
const artwork = new Map<string, string>();
const geometry = new Map<string, MandalaPaths>();

function remember(key: string, paint: () => string): string {
  const hit = artwork.get(key);
  if (hit !== undefined) {
    artwork.delete(key);
    artwork.set(key, hit);
    return hit;
  }
  const url = paint();
  if (!url) return url;
  artwork.set(key, url);
  if (artwork.size > ARTWORK_CACHE_LIMIT) {
    const oldest = artwork.keys().next().value;
    if (oldest !== undefined) artwork.delete(oldest);
  }
  return url;
}

function pathsFor(
  flower: TheoryFlower,
  hand: "left" | "right",
  mode: VtgMode,
  clubTipDx: number
): MandalaPaths {
  const key = `${hand}:${theoryFlowerKey(flower)}:${mode}:${clubTipDx}`;
  const cached = geometry.get(key);
  if (cached) return cached;
  const built = theoryFlowerPaths(flower, hand, mode, clubTipDx);
  geometry.set(key, built);
  return built;
}

function currentDpr(): number {
  return typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1;
}

export function theoryHeaderArtworkSrc(
  flower: TheoryFlower,
  hand: "left" | "right",
  mode: VtgMode,
  clubTipDx: number,
  sizePx: number
): string {
  const size = Math.round(sizePx);
  const dpr = currentDpr();
  const key = `h:${hand}:${theoryFlowerKey(flower)}:${mode}:${size}:${dpr}`;
  return remember(key, () =>
    renderHeader(pathsFor(flower, hand, mode, clubTipDx), hand, size, clubTipDx)
  );
}

export function theoryCellArtworkSrc(
  left: TheoryFlower,
  right: TheoryFlower,
  mode: VtgMode,
  clubTipDx: number,
  sizePx: number
): string {
  const size = Math.round(sizePx);
  const dpr = currentDpr();
  const key =
    `c:${theoryFlowerKey(left)}__${theoryFlowerKey(right)}` +
    `:${mode}:${size}:${dpr}`;
  return remember(key, () =>
    renderCell(
      pathsFor(left, "left", mode, clubTipDx),
      pathsFor(right, "right", mode, clubTipDx),
      size,
      clubTipDx
    )
  );
}
