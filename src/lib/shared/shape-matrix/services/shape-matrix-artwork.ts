/**
 * shape-matrix-artwork — the one owner of Shape Matrix mandala artwork.
 *
 * Both the matrix grid tiles and the detail hero's cold floor render the SAME
 * vector image: the left hand's flower merged with the right hand's flower,
 * painted by `renderCell`. Keeping the source here (cached per prop type and
 * flower pair) is what lets the hero literally BE the tile — and what makes
 * the shared-element transition between them a continuous object instead of
 * a crossfade between two different drawings.
 *
 * The hero is engine-aligned by scaling that same image with `alignScale`
 * (see mandala-hero.ts); the tile shows it unscaled. Geometry is otherwise
 * identical because renderMandalaSVG's extent math is shared by construction.
 */
import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import { flowerKey, type Flower } from "../domain/flower-signature";
import { renderCell, renderHeader } from "./shape-matrix-render";
import type { ShapeMatrixData } from "./shape-matrix-flowers";

/**
 * The single `view-transition-name` bridging a selected matrix tile and the
 * detail hero. Exactly one endpoint claims it at a time — the one the compact
 * layout currently shows — so the View Transitions API never sees a duplicate.
 */
export const SHAPE_MATRIX_ACTIVE_MANDALA_NAME = "shape-matrix-active-mandala";

/** Vector viewbox edge. The image is scale-free, so this only sets stroke ratio. */
export const SHAPE_MATRIX_ARTWORK_VIEWBOX_PX = 128;

export interface ShapeMatrixArtworkPainter {
  cell: typeof renderCell;
  header: typeof renderHeader;
}

export const CLUB_ARTWORK_PAINTER: ShapeMatrixArtworkPainter = {
  cell: renderCell,
  header: renderHeader,
};

const cellCaches = new WeakMap<ShapeMatrixArtworkPainter, Map<string, string>>();
const headerCaches = new WeakMap<
  ShapeMatrixArtworkPainter,
  Map<string, string>
>();

function cacheFor(
  store: WeakMap<ShapeMatrixArtworkPainter, Map<string, string>>,
  painter: ShapeMatrixArtworkPainter
): Map<string, string> {
  let cache = store.get(painter);
  if (!cache) {
    cache = new Map();
    store.set(painter, cache);
  }
  return cache;
}

/** The merged left-over-right tile for one matrix cell (cached). */
export function cellArtworkSrc(
  data: ShapeMatrixData,
  left: Flower,
  right: Flower,
  painter: ShapeMatrixArtworkPainter = CLUB_ARTWORK_PAINTER
): string {
  const key = `${data.propType}__${flowerKey(left)}__${flowerKey(right)}`;
  const cache = cacheFor(cellCaches, painter);
  let url = cache.get(key);
  if (!url) {
    url = painter.cell(
      data.left.get(flowerKey(left))!,
      data.right.get(flowerKey(right))!,
      SHAPE_MATRIX_ARTWORK_VIEWBOX_PX,
      data.clubTipDx
    );
    cache.set(key, url);
  }
  return url;
}

/** One axis-header flower (cached). */
export function headerArtworkSrc(
  data: ShapeMatrixData,
  flower: Flower,
  hand: "left" | "right",
  painter: ShapeMatrixArtworkPainter = CLUB_ARTWORK_PAINTER
): string {
  const key = `${data.propType}__${hand}__${flowerKey(flower)}`;
  const cache = cacheFor(headerCaches, painter);
  let url = cache.get(key);
  if (!url) {
    url = painter.header(
      (hand === "left" ? data.left : data.right).get(flowerKey(flower))!,
      hand,
      SHAPE_MATRIX_ARTWORK_VIEWBOX_PX,
      data.clubTipDx
    );
    cache.set(key, url);
  }
  return url;
}

/**
 * Artwork for already-merged paths (hosts that hold paths rather than a
 * matrix cell, e.g. the detail hero and the CAP demo's ghost). Same painter,
 * same viewbox, so it is pixel-for-pixel the tile a cell with those paths
 * would show.
 */
export function pathsArtworkSrc(paths: MandalaPaths, tipDx: number): string {
  return renderCell(
    { left: paths.left, right: [], purple: [] },
    { left: [], right: paths.right, purple: [] },
    SHAPE_MATRIX_ARTWORK_VIEWBOX_PX,
    tipDx
  );
}
