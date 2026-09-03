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
 *
 * Each hand is drawn in its own frame, with no pairing in it. That is the
 * Matrix's rule too: a tile is the blue hand's shape against the red hand's,
 * and timing and direction belong to the realization chosen beside the
 * animation rather than to the shape.
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
  theorySoloKnobs,
  type TheoryFlower,
} from "../domain/theory-flower";

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

function propReachFor(clubTipDx: number): number {
  return (clubTipDx * MANDALA_GRID_RADIUS) / ENGINE_GRID_RADIUS;
}

function traceFlower(
  flower: TheoryFlower,
  clubTipDx: number
): Array<{ x: number; y: number }> {
  const knobs = theorySoloKnobs(flower);
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
  return [{ d, tipIndex: 0 }];
}

export function theoryFlowerPaths(
  flower: TheoryFlower,
  hand: "left" | "right",
  clubTipDx: number
): MandalaPaths {
  const traced = toPathData(traceFlower(flower, clubTipDx));
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
  clubTipDx: number
): MandalaPaths {
  const key = `${hand}:${theoryFlowerKey(flower)}:${clubTipDx}`;
  const cached = geometry.get(key);
  if (cached) return cached;
  const built = theoryFlowerPaths(flower, hand, clubTipDx);
  geometry.set(key, built);
  return built;
}

function currentDpr(): number {
  return typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1;
}

export function theoryHeaderArtworkSrc(
  flower: TheoryFlower,
  hand: "left" | "right",
  clubTipDx: number,
  sizePx: number
): string {
  const size = Math.round(sizePx);
  const dpr = currentDpr();
  const key = `h:${hand}:${theoryFlowerKey(flower)}:${size}:${dpr}`;
  return remember(key, () =>
    renderHeader(pathsFor(flower, hand, clubTipDx), hand, size, clubTipDx)
  );
}

export function theoryCellArtworkSrc(
  left: TheoryFlower,
  right: TheoryFlower,
  clubTipDx: number,
  sizePx: number
): string {
  const size = Math.round(sizePx);
  const dpr = currentDpr();
  const key =
    `c:${theoryFlowerKey(left)}__${theoryFlowerKey(right)}:${size}:${dpr}`;
  return remember(key, () =>
    renderCell(
      pathsFor(left, "left", clubTipDx),
      pathsFor(right, "right", clubTipDx),
      size,
      clubTipDx
    )
  );
}
