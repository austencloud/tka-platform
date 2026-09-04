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
  renderExtentFit,
  renderHeader,
} from "./shape-matrix-render";
import type { ShapeMatrixData } from "./shape-matrix-flowers";

/**
 * The single `view-transition-name` bridging a selected matrix tile and the
 * detail hero. Exactly one endpoint claims it at a time — the one the compact
 * layout currently shows — so the View Transitions API never sees a duplicate.
 */
export const SHAPE_MATRIX_ACTIVE_MANDALA_NAME = "shape-matrix-active-mandala";

/**
 * The shared-element name of the rectangle around that mandala: the selected
 * matrix tile's box and the detail hero stage (header band, canvas region,
 * and its corner annotations). The mandala is a named descendant, so it is
 * left out of this rectangle's snapshot and travels as its own picture on
 * top: the whole stage flies between the tile and the detail view, and the
 * mandala rides it.
 */
export const SHAPE_MATRIX_ACTIVE_STAGE_NAME = "shape-matrix-active-stage";

/**
 * The three frames around the flying stage: the element and prop-relationship
 * chips above it, the pictograph carousel below it, and the playback control
 * bar at the foot. None of them is part of the rectangle that flies, so each
 * carries its own name during the morph and settles into its landed position
 * on a staggered wave. Without a name they are trapped in the page's single
 * root snapshot, which is painted complete for the whole flight and then
 * swapped for the live DOM: the pop this exists to remove.
 */
export const SHAPE_MATRIX_MODES_NAME = "shape-matrix-modes";
export const SHAPE_MATRIX_STRIP_NAME = "shape-matrix-strip";
export const SHAPE_MATRIX_CONTROLS_NAME = "shape-matrix-controls";

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
 * Extent-fit artwork for already-merged paths (the detail hero floor), the
 * tile's own fit. The hero paints it in a box of `engineExtentBoxRatio`
 * times the animator's square, which puts the strokes on the same pixels
 * the live guide draws in that square.
 */
export function pathsArtworkSrc(
  paths: MandalaPaths,
  sizePx: number,
  tipDx: number
): string {
  const size = Math.round(sizePx);
  if (!(size > 0)) return "";
  const key = `paths|${pathsId(paths)}|${size}|${tipDx}|${currentDpr()}`;
  return cacheFor(CLUB_ARTWORK_PAINTER).get(key, () =>
    renderExtentFit(paths, size, tipDx)
  );
}

/**
 * Every mounted ShapeMatrixMandalaArt registers its measure function here.
 * A shared-element morph flips the view inside a View Transition's update
 * callback, where rendering is suppressed: the endpoint's ResizeObserver
 * will not report until the browser next renders, which is AFTER the
 * new-state capture. `measureMandalaArt` forces layout and re-measures every
 * instance right then, so the destination paints at its real size before the
 * capture instead of being captured at 0x0.
 */
const artMeasurers = new Set<() => void>();

export function registerMandalaArtMeasurer(measure: () => void): () => void {
  artMeasurers.add(measure);
  return () => {
    artMeasurers.delete(measure);
  };
}

export function measureMandalaArt(): void {
  for (const measure of artMeasurers) measure();
}
