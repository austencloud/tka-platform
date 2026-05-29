/**
 * card-back-bitmaps-percard.ts
 *
 * Rasterizers for the card-back elements that VARY PER SEQUENCE and therefore
 * are NOT cached — each card has its own turn pattern, reversal pattern, step
 * count, and start position. Like the constant rasterizers (sibling
 * card-back-bitmaps-constant.ts), each element is rendered to an ImageBitmap
 * (worker-transferable) by mounting the EXISTING Svelte component offscreen via
 * `rasterizeComponent`, then composited later.
 *
 * Per-card elements covered here:
 *   - turn glyph              (TurnPatternGlyph)        bar chart of per-step turns
 *   - reversal glyph          (ReversalPatternGlyph)    reversal dot-columns
 *   - step count              (CardBackStepCount)       the big number
 *   - start-position pictograph (StartPositionPictograph) mini start pictograph
 *
 * RENDER SCALE — single source of truth (matches card-back-bitmaps-constant.ts
 * and card-back-layout.ts):
 *   Card back renders at 1644×2244. 1cqi = 1644 / 100 = 16.44px. Box sizes below
 *   are `<n>cqi * CQI`, lifted from CardBack.svelte / card-back-layout.ts.
 *   Elements are mounted inside a container whose inline-size = CARD_RENDER_WIDTH
 *   (1644) so cqi units resolve identically to the live card; the bitmap crop is
 *   the element's own layout box.
 *
 * PARITY: TurnPatternGlyph / ReversalPatternGlyph / StartPositionPictograph are
 * the REAL shared components CardBack.svelte mounts, with the same props. The
 * step-count number is the verbatim `.corner-label` markup+style, extracted into
 * CardBackStepCount.svelte (CardBack.svelte renders it inline, not as a
 * component). A pixel-diff harness verifies parity (P1.7).
 *
 * ASYNC PICTOGRAPH TIMING — the one tricky element:
 *   StartPositionPictograph kicks off an async `$effect` (pictographPreparer
 *   .prepareSingle) and only mounts PictographRenderer once `prepared` is set;
 *   PictographRenderer then loads grid/prop/arrow SVGs in its own children. A
 *   single rAF (rasterizeComponent's default) screenshots a blank box.
 *   Two-part fix:
 *     1. Pre-warm the prepare cache here by awaiting prepareSingle with the same
 *        options the component uses, so the component's internal $effect
 *        resolves from PictographPreparer's synchronous prepareCache on its
 *        first microtask instead of doing real async work.
 *     2. Tell rasterizeComponent to wait the same settle budget the production
 *        full-card renderer uses (card-back-dom-renderer.ts: 2 rAF +
 *        setTimeout(200)) so the downstream grid/prop/arrow SVG children are in
 *        the DOM before the snapshot.
 */

import TurnPatternGlyph from "../../components/card-back/TurnPatternGlyph.svelte";
import ReversalPatternGlyph from "../../components/card-back/ReversalPatternGlyph.svelte";
import CardBackStepCount from "../../components/card-back/CardBackStepCount.svelte";
import CardBackLoopRow from "../../components/card-back/CardBackLoopRow.svelte";
import type { TurnGlyphEntry } from "../../components/card-back/card-back-data";
import { rasterizeComponent } from "./rasterize-node";
import { getCanvas2DRenderer } from "$lib/shared/render/get-canvas-2d-renderer";
import type { DirectRenderOptions } from "$lib/shared/render/services/contracts/IDirectRenderer";
import type { RenderCanvas } from "$lib/shared/render/services/contracts/types";

// ── Render scale (matches card-back-bitmaps-constant.ts / card-back-layout.ts) ─
/** Card back render width in px (822 logical * scale 2). */
export const CARD_RENDER_WIDTH = 1644;
/** 1cqi in px at the card render width. */
const CQI = CARD_RENDER_WIDTH / 100; // 16.44

// Box sizes are derived per-call from the border-aware PerCardRenderCtx.cqi
// (glyph 10×6cqi, start-pos 12×12cqi, step-count slot 20×9cqi) — see each
// rasterizer. CQI / CARD_RENDER_WIDTH below back the DEFAULT_CTX fallback only.

// The start-position pictograph renders via Canvas2DDirectRenderer (the proven
// front-card pipeline): grid + props + arrows drawn directly to canvas on the
// main thread. No DOM mount, no async-paint timing — reliable per card (the
// mount+screenshot path rendered intermittently as SVG assets loaded late).

/**
 * Border-frame-aware render context, supplied by the job builder so the per-card
 * elements render at the SAME cqi basis as the live card (border-frame content
 * box, not the full card width) and inherit `--card-text-muted` / `--card-text`
 * (which the live card sets on `.back`; mounted bare, glyphs/pictograph borders
 * otherwise fall back to near-white and vanish on the white proof background).
 */
export interface PerCardRenderCtx {
  /** Border-frame content-box inline size in px (= card width − 2·borderPx). */
  containerWidth: number;
  /** 1cqi in px against the border-frame content box. */
  cqi: number;
  /** Proof/theme muted text color (CardBack sets this as --card-text-muted). */
  textMutedColor: string;
  /** Proof/theme text color (CardBack sets this as --card-text). */
  textColor: string;
}

/** Fallback context (full-width cqi, dark proof text) when none is supplied. */
const DEFAULT_CTX: PerCardRenderCtx = {
  containerWidth: CARD_RENDER_WIDTH,
  cqi: CQI,
  textMutedColor: "rgba(0, 0, 0, 0.55)",
  textColor: "#111111",
};

/** CSS custom props to inject so bare-mounted components match the live card. */
function ctxCssVars(ctx: PerCardRenderCtx): Record<string, string> {
  return { "--card-text-muted": ctx.textMutedColor, "--card-text": ctx.textColor };
}

// ── Test-injectable rasterize indirection (matches the constant sibling) ───────

interface RasterizeFnOpts {
  containerWidth?: number;
  settleFrames?: number;
  settleMs?: number;
  cssVars?: Record<string, string>;
  align?: "none" | "end-center";
  naturalHeight?: boolean;
}

/**
 * The function the rasterizers use to actually produce a bitmap. Indirection
 * exists so tests can inject a fake (real rasterization can't run in jsdom).
 */
type RasterizeFn = (
  Comp: unknown,
  props: Record<string, unknown>,
  w: number,
  h: number,
  opts?: RasterizeFnOpts,
) => Promise<ImageBitmap>;

let rasterize: RasterizeFn = rasterizeComponent;

/** Test-only: swap the underlying rasterize implementation. */
export function __setRasterizeFnForTest(fn: RasterizeFn | null): void {
  rasterize = fn ?? rasterizeComponent;
}

/**
 * Render-a-pictograph indirection (for the start position). Defaults to the
 * shared Canvas2DDirectRenderer singleton, lazily initialized once. Injectable
 * so tests assert the call without running the real (asset-loading) renderer.
 */
type RenderPictoFn = (
  pictograph: unknown,
  options: DirectRenderOptions,
) => Promise<RenderCanvas>;

let directRendererReady: Promise<void> | null = null;
const defaultRenderPicto: RenderPictoFn = async (pictograph, options) => {
  const renderer = getCanvas2DRenderer();
  directRendererReady ??= renderer.initialize();
  await directRendererReady;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderer.renderPictograph(pictograph as any, options);
};

let renderPicto: RenderPictoFn = defaultRenderPicto;

/** Test-only: swap the underlying renderPictograph implementation. */
export function __setRenderPictoFnForTest(fn: RenderPictoFn | null): void {
  renderPicto = fn ?? defaultRenderPicto;
}

/** Trace a rounded-rect path (for the start-pos box clip + border). */
function roundRectPath(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ── Turn glyph (per-card) ──────────────────────────────────────────────────

/**
 * Rasterize the turn-pattern bar chart for `entries` into a glyph-box-sized
 * bitmap (10cqi × 6cqi). Mounts the real TurnPatternGlyph with the same
 * `entries` prop CardBack.svelte passes (`d.turnGlyphEntries`).
 */
export function rasterizeTurnGlyph(
  entries: TurnGlyphEntry[],
  ctx: PerCardRenderCtx = DEFAULT_CTX,
): Promise<ImageBitmap> {
  return rasterize(
    TurnPatternGlyph,
    { entries },
    Math.round(10 * ctx.cqi),
    Math.round(6 * ctx.cqi),
    { containerWidth: ctx.containerWidth, align: "end-center", cssVars: ctxCssVars(ctx) },
  );
}

// ── Reversal glyph (per-card) ──────────────────────────────────────────────

/**
 * Rasterize the reversal-pattern dot columns into a glyph-box-sized bitmap
 * (10cqi × 6cqi). Mounts the real ReversalPatternGlyph with the same
 * `sequence` / `period` props CardBack.svelte passes (`d.reversalSequence`,
 * `d.reversalPeriod`).
 */
export function rasterizeReversalGlyph(
  sequence: string,
  period: number,
  ctx: PerCardRenderCtx = DEFAULT_CTX,
): Promise<ImageBitmap> {
  return rasterize(
    ReversalPatternGlyph,
    { sequence, period },
    Math.round(10 * ctx.cqi),
    Math.round(6 * ctx.cqi),
    { containerWidth: ctx.containerWidth, align: "end-center", cssVars: ctxCssVars(ctx) },
  );
}

// ── Loop row (per-card) ────────────────────────────────────────────────────

/** One loop column: icon kind + fa class + color + label. */
export interface LoopRowCol {
  kind: "swap" | "checkerboard" | "fa";
  fa?: string;
  color: string;
  label: string;
}

/**
 * Rasterize the entire loop-component row (icons + labels) as ONE centered
 * bitmap spanning the content-box width. Rendered at natural height so the
 * icon-cell (9cqi) + gap + label (2.2cqi) all fit. The builder places this at
 * the loop-row Y (bottom:28cqi), full inner width, so the flex row stays
 * centered exactly as the live card.
 */
export function rasterizeLoopRow(
  cols: LoopRowCol[],
  ctx: PerCardRenderCtx = DEFAULT_CTX,
): Promise<ImageBitmap> {
  return rasterize(
    CardBackLoopRow,
    { cols },
    ctx.containerWidth,
    Math.round(12 * ctx.cqi), // fallback height; naturalHeight measures the real row
    { containerWidth: ctx.containerWidth, cssVars: ctxCssVars(ctx), naturalHeight: true },
  );
}

// ── Step count (per-card) ──────────────────────────────────────────────────

/**
 * Rasterize the big step-count number into its right-aligned slot bitmap
 * (20cqi × 9cqi). Renders the verbatim `.corner-label` markup via
 * CardBackStepCount.
 *
 * @param textMutedColor Theme muted text color (CardBack inherits this onto
 *   `.back` as `--card-text-muted`). Defaults to the white-theme value.
 */
export function rasterizeStepCount(
  count: number,
  ctx: PerCardRenderCtx = DEFAULT_CTX,
): Promise<ImageBitmap> {
  return rasterize(
    CardBackStepCount,
    { count, textMutedColor: ctx.textMutedColor },
    Math.round(20 * ctx.cqi),
    Math.round(9 * ctx.cqi),
    { containerWidth: ctx.containerWidth, align: "end-center", cssVars: ctxCssVars(ctx) },
  );
}

// ── Start-position pictograph (per-card) ───────────────────────────────────

/**
 * Rasterize the mini start-position pictograph into a 12cqi × 12cqi bitmap.
 *
 * Renders the pictograph via Canvas2DDirectRenderer (DOM-free, reliable) at the
 * 1.3× zoom StartPositionPictograph applies (`.picto-zoom { scale(1.3) }`),
 * composited into the box with the rounded border + overflow-clip, matching
 * CardBack's `.start-pos-picto` (border 0.3cqi `--card-text-muted`, radius 1cqi).
 * Visibility mirrors StartPositionPictograph's PictographRenderer props.
 *
 * @param pictographData The start position data (SequenceData.startPosition).
 * @param darkMode Theme dark-mode flag (CardBack passes `isDarkTheme`).
 */
export async function rasterizeStartPosPictograph(
  pictographData: unknown,
  darkMode: boolean,
  ctx: PerCardRenderCtx = DEFAULT_CTX,
): Promise<ImageBitmap> {
  const box = Math.round(12 * ctx.cqi);
  const borderW = Math.max(1, Math.round(0.3 * ctx.cqi));
  const radius = 1 * ctx.cqi;
  const pictoSize = Math.round(box * 1.3); // .picto-zoom scale(1.3)

  const picto = await renderPicto(pictographData, {
    size: pictoSize,
    visibility: {
      darkMode,
      showTKA: false,
      showTnD: false,
      showElemental: false,
      showPositions: false,
      showReversals: false,
      showNonRadialPoints: false,
      handPointVisibility: "all",
    },
  });

  const out = new OffscreenCanvas(box, box);
  const octx = out.getContext("2d") as OffscreenCanvasRenderingContext2D;
  const inset = borderW / 2;
  // Clip to the rounded box (overflow:hidden) and draw the 1.3× pictograph
  // centered so the zoom overflows + clips at the edges, like the live card.
  octx.save();
  roundRectPath(octx, inset, inset, box - borderW, box - borderW, radius);
  octx.clip();
  octx.drawImage(
    picto as unknown as CanvasImageSource,
    (box - pictoSize) / 2,
    (box - pictoSize) / 2,
    pictoSize,
    pictoSize,
  );
  octx.restore();
  // Border on the edge.
  octx.lineWidth = borderW;
  octx.strokeStyle = ctx.textMutedColor;
  roundRectPath(octx, inset, inset, box - borderW, box - borderW, radius);
  octx.stroke();

  return createImageBitmap(out);
}
