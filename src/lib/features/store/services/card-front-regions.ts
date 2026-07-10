/**
 * card-front-regions
 *
 * Computes the anatomy spotlight rects (word / start / steps / mandalas / QR)
 * for a printed choreo-card FRONT, in % of the DISPLAYED image, for ANY step
 * count. The marketing "What's on the Card" shuffle renders 8/12/16-count
 * cards, and the front layout reflows with the count (column layout at 8/12,
 * row layout at 16, different grid dims each), so the spotlight rects cannot
 * be hardcoded — they are derived from the same print layout math the renderer
 * uses (`calculateLayout` + `getCatalogLayoutPolicy` + `getMandalaPlacements`).
 *
 * Coordinate chain: grid cell (content space, 678x978) → framed canvas
 * (822x1122, content inset by the 72px border) → displayed image (object-fit:
 * cover into a 5:7 box crops ~1.25% off each horizontal edge).
 */
import { calculateLayout } from "$lib/shared/render/services/layout-calculator";
import { getCatalogLayoutPolicy } from "$lib/features/choreo-card/domain/catalog-layout-policy";
import { getMandalaPlacements } from "$lib/shared/sequence-viewer/services/get-mandala-placements";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// MPC poker card + frame geometry — must match build-front-compose-options.ts.
const CANVAS_W = 822;
const CANVAS_H = 1122;
const BORDER = 72; // round(bleed 36 * BORDER_SCALE 2.0)
const CONTENT_W = CANVAS_W - BORDER * 2; // 678
const CONTENT_H = CANVAS_H - BORDER * 2; // 978
// deckCard header/footer ratios (card-front-assembler.ts). Word header + the
// brand/element footer both always render for catalog cards.
const HEADER_H = Math.floor(CONTENT_W * 0.133);
const FOOTER_H = Math.floor(CONTENT_W * 0.067);

// object-fit: cover crop of an 822x1122 image into a 5:7 box. Image is wider
// than the box, so height fills and each horizontal edge loses this fraction.
const BOX_ASPECT = 5 / 7;
const IMG_ASPECT = CANVAS_W / CANVAS_H;
const X_CROP = (1 - BOX_ASPECT / IMG_ASPECT) / 2;

interface Grid {
  cols: number;
  rows: number;
  stepSize: number;
  offX: number;
  offY: number;
}

function grid(stepCount: number): Grid {
  const policy = getCatalogLayoutPolicy(stepCount);
  const [cols, rows] = calculateLayout(stepCount, true, policy);
  const availH = CONTENT_H - HEADER_H - FOOTER_H;
  const stepSize = Math.floor(Math.min(CONTENT_W / cols, availH / rows));
  const gridW = cols * stepSize;
  const gridH = rows * stepSize;
  const offX = Math.floor((CONTENT_W - gridW) / 2);
  const offY = HEADER_H + Math.floor((CONTENT_H - HEADER_H - FOOTER_H - gridH) / 2);
  return { cols, rows, stepSize, offX, offY };
}

/** Content-space rect (px within 678x978) for a span of grid cells (0-based,
 *  inclusive). */
function cellSpan(g: Grid, c0: number, r0: number, c1: number, r1: number): Rect {
  const x = c0 * g.stepSize + g.offX;
  const y = r0 * g.stepSize + g.offY;
  return {
    x,
    y,
    w: (c1 - c0 + 1) * g.stepSize,
    h: (r1 - r0 + 1) * g.stepSize,
  };
}

/** content px rect → displayed-image % rect (through the frame inset + cover
 *  crop). */
function toDisplay(r: Rect): Rect {
  const cx0 = (BORDER + r.x) / CANVAS_W;
  const cx1 = (BORDER + r.x + r.w) / CANVAS_W;
  const cy0 = (BORDER + r.y) / CANVAS_H;
  const cy1 = (BORDER + r.y + r.h) / CANVAS_H;
  const dx = (v: number) => ((v - X_CROP) / (1 - 2 * X_CROP)) * 100;
  return {
    x: dx(cx0),
    y: cy0 * 100,
    w: dx(cx1) - dx(cx0),
    h: (cy1 - cy0) * 100,
  };
}

/**
 * The five front spotlight regions for a card of `stepCount` steps, as % of the
 * displayed 5:7 image. Ids match the page's front legend + BACK_SELECTORS keys.
 */
export function computeFrontRegions(stepCount: number): Record<string, Rect> {
  const g = grid(stepCount);
  const policy = getCatalogLayoutPolicy(stepCount);
  const { cols, rows } = g;

  const { placements } = getMandalaPlacements({
    stepCount,
    cols,
    rows,
    includeStartPosition: true,
    showQRCode: true,
    blueVisible: true,
    redVisible: true,
    mandalaEnabled: true,
    startPositionLayout: policy,
  });

  // Mandala bounding box (placements are 1-based).
  let mand: Rect;
  if (placements.length) {
    const c0 = Math.min(...placements.map((p) => p.col)) - 1;
    const r0 = Math.min(...placements.map((p) => p.row)) - 1;
    const c1 = Math.max(...placements.map((p) => p.col)) - 1;
    const r1 = Math.max(...placements.map((p) => p.row)) - 1;
    mand = cellSpan(g, c0, r0, c1, r1);
  } else {
    mand = cellSpan(g, 0, 1, 0, 1);
  }

  let steps: Rect;
  let qr: Rect;
  if (policy === "column") {
    // Left column: start (row0) · mandalas · QR (last row). Steps fill cols 1+.
    steps = cellSpan(g, 1, 0, cols - 1, rows - 1);
    qr = cellSpan(g, 0, rows - 1, 0, rows - 1);
  } else {
    // Top row: start (col0) · mandalas · QR (last col). Steps fill rows 1+.
    steps = cellSpan(g, 0, 1, cols - 1, rows - 1);
    qr = cellSpan(g, cols - 1, 0, cols - 1, 0);
  }

  const start = cellSpan(g, 0, 0, 0, 0);

  // Word: the header band, inset horizontally so the spotlight hugs the glyphs
  // rather than the full card width.
  const word: Rect = { x: CONTENT_W * 0.12, y: 0, w: CONTENT_W * 0.76, h: HEADER_H };

  return {
    word: toDisplay(word),
    start: toDisplay(start),
    steps: toDisplay(steps),
    mandalas: toDisplay(mand),
    qr: toDisplay(qr),
  };
}
