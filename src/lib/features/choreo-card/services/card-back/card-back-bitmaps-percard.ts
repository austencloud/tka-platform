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
import StartPositionPictograph from "../../components/card-back/StartPositionPictograph.svelte";
import CardBackStepCount from "../../components/card-back/CardBackStepCount.svelte";
import type { TurnGlyphEntry } from "../../components/card-back/card-back-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { rasterizeComponent } from "./rasterize-node";

// ── Render scale (matches card-back-bitmaps-constant.ts / card-back-layout.ts) ─
/** Card back render width in px (822 logical * scale 2). */
export const CARD_RENDER_WIDTH = 1644;
/** 1cqi in px at the card render width. */
const CQI = CARD_RENDER_WIDTH / 100; // 16.44

// ── Element box sizes (lifted from CardBack.svelte / card-back-layout.ts) ──────
// .glyph-box { width: 10cqi; height: 6cqi } — shared by turn + reversal glyphs.
const GLYPH_BOX_W = 10 * CQI;
const GLYPH_BOX_H = 6 * CQI;
// .start-pos-picto { width: 12cqi; height: 12cqi } (CardBack :global override).
const START_POS_SIZE = 12 * CQI;
// .corner-label { font-size: 9cqi; line-height: 1 } in a 20cqi right-aligned slot.
const STEP_COUNT_W = 20 * CQI;
const STEP_COUNT_H = 9 * CQI;

// Settle budget for the async pictograph — mirrors card-back-dom-renderer.ts
// (2 rAF + 200ms) so the renderer's grid/prop/arrow SVG children are painted.
const PICTO_SETTLE_FRAMES = 2;
const PICTO_SETTLE_MS = 200;

// ── Test-injectable rasterize indirection (matches the constant sibling) ───────

interface RasterizeFnOpts {
  containerWidth?: number;
  settleFrames?: number;
  settleMs?: number;
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
 * The prepare function StartPositionPictograph's $effect uses. Indirection lets
 * tests assert the pre-warm happens with the right options without running the
 * real (async, DOM-touching) preparer.
 */
type PrepareFn = (
  data: PictographData,
  options: { themeMode: "dark" | "light" },
) => Promise<unknown>;

/**
 * Default prepare: lazy-imports PictographPreparer so this module's static
 * import graph stays light. The preparer's dependency chain (arrow/prop loaders
 * → firebase/protobufjs) crashes vitest on import, and tests inject a fake
 * prepare anyway, so deferring the import to call time keeps the suite loadable.
 */
const defaultPrepare: PrepareFn = async (data, options) => {
  const { pictographPreparer } = await import(
    "$lib/shared/pictograph/shared/services/implementations/PictographPreparer"
  );
  return pictographPreparer.prepareSingle(data, options);
};

let prepare: PrepareFn = defaultPrepare;

/** Test-only: swap the underlying prepare implementation. */
export function __setPrepareFnForTest(fn: PrepareFn | null): void {
  prepare = fn ?? defaultPrepare;
}

// ── Turn glyph (per-card) ──────────────────────────────────────────────────

/**
 * Rasterize the turn-pattern bar chart for `entries` into a glyph-box-sized
 * bitmap (10cqi × 6cqi). Mounts the real TurnPatternGlyph with the same
 * `entries` prop CardBack.svelte passes (`d.turnGlyphEntries`).
 */
export function rasterizeTurnGlyph(
  entries: TurnGlyphEntry[],
  w: number = Math.round(GLYPH_BOX_W),
  h: number = Math.round(GLYPH_BOX_H),
): Promise<ImageBitmap> {
  return rasterize(
    TurnPatternGlyph,
    { entries },
    w,
    h,
    { containerWidth: CARD_RENDER_WIDTH },
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
  w: number = Math.round(GLYPH_BOX_W),
  h: number = Math.round(GLYPH_BOX_H),
): Promise<ImageBitmap> {
  return rasterize(
    ReversalPatternGlyph,
    { sequence, period },
    w,
    h,
    { containerWidth: CARD_RENDER_WIDTH },
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
  w: number = Math.round(STEP_COUNT_W),
  h: number = Math.round(STEP_COUNT_H),
  textMutedColor?: string,
): Promise<ImageBitmap> {
  const props: Record<string, unknown> = { count };
  if (textMutedColor !== undefined) props.textMutedColor = textMutedColor;
  return rasterize(
    CardBackStepCount,
    props,
    w,
    h,
    { containerWidth: CARD_RENDER_WIDTH },
  );
}

// ── Start-position pictograph (per-card, async prep) ───────────────────────

/**
 * Rasterize the mini start-position pictograph into a 12cqi × 12cqi bitmap.
 *
 * Mounts the real StartPositionPictograph with the same props CardBack.svelte
 * passes (`pictographData={sequence.startPosition}` + `darkMode`). To beat the
 * component's async prep, the prepare cache is pre-warmed here with the same
 * options the component's `$effect` uses, and the screenshot waits the
 * production settle budget (see ASYNC PICTOGRAPH TIMING in the module header).
 *
 * @param pictographData The start position data (SequenceData.startPosition),
 *   structurally a PictographData — passed straight through, as CardBack does.
 * @param darkMode Theme dark-mode flag (CardBack passes `isDarkTheme`).
 */
export async function rasterizeStartPosPictograph(
  pictographData: unknown,
  darkMode: boolean,
  w: number = Math.round(START_POS_SIZE),
  h: number = Math.round(START_POS_SIZE),
): Promise<ImageBitmap> {
  // 1) Pre-warm the prepare cache so the component's internal $effect resolves
  //    synchronously from PictographPreparer.prepareCache. Mirror the exact
  //    options StartPositionPictograph uses: { themeMode: darkMode ? dark : light }.
  try {
    await prepare(pictographData as PictographData, {
      themeMode: darkMode ? "dark" : "light",
    });
  } catch {
    // Component has its own try/catch fallback (renders raw data on failure);
    // proceed and let it handle the failure path identically to the live card.
  }

  // 2) Mount + screenshot with the production settle budget so the renderer's
  //    grid/prop/arrow SVG children are in the DOM before the snapshot.
  return rasterize(
    StartPositionPictograph,
    { pictographData, darkMode },
    w,
    h,
    {
      containerWidth: CARD_RENDER_WIDTH,
      settleFrames: PICTO_SETTLE_FRAMES,
      settleMs: PICTO_SETTLE_MS,
    },
  );
}
