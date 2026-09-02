/**
 * shape-matrix-artwork — the one owner of Shape Matrix mandala artwork.
 *
 * Matrix tiles, axis headers, and the detail hero's cold floor are all
 * painted by the animation canvas's guide painter (shape-matrix-render.ts),
 * each at its own exact CSS-pixel size and device pixel ratio, so a still
 * mandala is the animator's mandala: same colors, same 2.5px stroke, same
 * purple overlap, same engine alignment for the hero. That is what lets the
 * shared-element transition morph a tile into the floor and the floor yield
 * to the live guide without anything visibly changing but position.
 *
 * Images are rasters, so they are cached per (painter, key, size, dpr) with a
 * bounded LRU; a resize repaints, a repeat visit is free.
 */
import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import { flowerKey, type Flower } from "../domain/flower-signature";
import {
  renderCell,
  renderEngineAligned,
  renderHeader,
} from "./shape-matrix-render";
import type { ShapeMatrixData } from "./shape-matrix-flowers";

/**
 * The single `view-transition-name` bridging a selected matrix tile and the
 * detail hero. Exactly one endpoint claims it at a time — the one the compact
 * layout currently shows — so the View Transitions API never sees a duplicate.
 */
export const SHAPE_MATRIX_ACTIVE_MANDALA_NAME = "shape-matrix-active-mandala";

export interface ShapeMatrixArtworkPainter {
  cell: (
    left: MandalaPaths,
    right: MandalaPaths,
    sizePx: number,
    tipDx: number
  ) => string;
  header: (
    paths: MandalaPaths,
    hand: "left" | "right",
    sizePx: number,
    tipDx: number
  ) => string;
}

export const CLUB_ARTWORK_PAINTER: ShapeMatrixArtworkPainter = {
  cell: renderCell,
  header: renderHeader,
};

/** Rasters are per size and DPR; keep the recent ones, drop the rest. */
const ARTWORK_CACHE_LIMIT = 512;

class ArtworkCache {
  private readonly entries = new Map<string, string>();

  get(key: string, paint: () => string): string {
    const hit = this.entries.get(key);
    if (hit !== undefined) {
      // Refresh recency.
      this.entries.delete(key);
      this.entries.set(key, hit);
      return hit;
    }
    const url = paint();
    if (!url) return url;
    this.entries.set(key, url);
    if (this.entries.size > ARTWORK_CACHE_LIMIT) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    return url;
  }
}

const caches = new WeakMap<ShapeMatrixArtworkPainter, ArtworkCache>();

function cacheFor(painter: ShapeMatrixArtworkPainter): ArtworkCache {
  let cache = caches.get(painter);
  if (!cache) {
    cache = new ArtworkCache();
    caches.set(painter, cache);
  }
  return cache;
}

function currentDpr(): number {
  return typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1;
}

/** The merged left-over-right tile for one matrix cell at `sizePx`. */
export function cellArtworkSrc(
  data: ShapeMatrixData,
  left: Flower,
  right: Flower,
  sizePx: number,
  painter: ShapeMatrixArtworkPainter = CLUB_ARTWORK_PAINTER
): string {
  const size = Math.round(sizePx);
  if (!(size > 0)) return "";
  const key = `cell|${data.propType}|${flowerKey(left)}|${flowerKey(right)}|${size}|${currentDpr()}`;
  return cacheFor(painter).get(key, () =>
    painter.cell(
      data.left.get(flowerKey(left))!,
      data.right.get(flowerKey(right))!,
      size,
      data.clubTipDx
    )
  );
}

/** One axis-header flower at `sizePx`. */
export function headerArtworkSrc(
  data: ShapeMatrixData,
  flower: Flower,
  hand: "left" | "right",
  sizePx: number,
  painter: ShapeMatrixArtworkPainter = CLUB_ARTWORK_PAINTER
): string {
  const size = Math.round(sizePx);
  if (!(size > 0)) return "";
  const key = `head|${data.propType}|${hand}|${flowerKey(flower)}|${size}|${currentDpr()}`;
  return cacheFor(painter).get(key, () =>
    painter.header(
      (hand === "left" ? data.left : data.right).get(flowerKey(flower))!,
      hand,
      size,
      data.clubTipDx
    )
  );
}

const pathsIds = new WeakMap<MandalaPaths, number>();
let nextPathsId = 1;

function pathsId(paths: MandalaPaths): number {
  let id = pathsIds.get(paths);
  if (id === undefined) {
    id = nextPathsId++;
    pathsIds.set(paths, id);
  }
  return id;
}

/**
 * Engine-aligned artwork for already-merged paths (the detail hero floor).
 * Painted for a square of `sizePx` — the SAME square the AnimatorCanvas
 * renders into — so the floor's strokes and the live guide's strokes are the
 * same pixels.
 */
export function pathsArtworkSrc(paths: MandalaPaths, sizePx: number): string {
  const size = Math.round(sizePx);
  if (!(size > 0)) return "";
  const key = `paths|${pathsId(paths)}|${size}|${currentDpr()}`;
  return cacheFor(CLUB_ARTWORK_PAINTER).get(key, () =>
    renderEngineAligned(paths, size)
  );
}
