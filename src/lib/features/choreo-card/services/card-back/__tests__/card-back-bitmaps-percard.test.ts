/**
 * Tests for the PER-CARD card-back element rasterizers.
 *
 * These rasterizers are NOT cached (they vary per sequence), so unlike the
 * constant sibling there's no cache behavior to test. Instead — since real DOM
 * rasterization (modern-screenshot + createImageBitmap) does not run in
 * vitest/jsdom — we inject a fake rasterize function via
 * __setRasterizeFnForTest and assert each rasterizer CALLS THROUGH with the
 * right component, props, and box sizes. The start-position pictograph also
 * pre-warms the prepare cache; a fake prepare fn (via __setPrepareFnForTest)
 * lets us assert the pre-warm options and the settle budget passed downstream.
 *
 * The real visual/parity check happens in the browser harness (P1.7).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The four card-back components are mocked to light identity stubs. Two reasons:
//   1. StartPositionPictograph's real subtree (PictographRenderer →
//      arrow/prop/grid services → firebase/protobufjs) crashes vitest at import
//      time (`util.Long.fromNumber is not a function`). vi.mock is hoisted and
//      applies module-graph-wide, so the production rasterizer module (which
//      statically imports these components) gets the SAME stubbed references —
//      meaning `call.Comp === <stub>` is a valid identity assertion.
//   2. These tests never render; they verify the rasterizer calls THROUGH with
//      the right component + props + sizes. Real markup is irrelevant here
//      (parity is checked by the P1.7 browser harness).
const stubs = vi.hoisted(() => ({
  TurnPatternGlyph: { __stub: "TurnPatternGlyph" },
  ReversalPatternGlyph: { __stub: "ReversalPatternGlyph" },
  StartPositionPictograph: { __stub: "StartPositionPictograph" },
  CardBackStepCount: { __stub: "CardBackStepCount" },
}));
const {
  TurnPatternGlyph,
  ReversalPatternGlyph,
  StartPositionPictograph,
  CardBackStepCount,
} = stubs;

vi.mock("../../../components/card-back/TurnPatternGlyph.svelte", () => ({
  default: stubs.TurnPatternGlyph,
}));
vi.mock("../../../components/card-back/ReversalPatternGlyph.svelte", () => ({
  default: stubs.ReversalPatternGlyph,
}));
vi.mock("../../../components/card-back/StartPositionPictograph.svelte", () => ({
  default: stubs.StartPositionPictograph,
}));
vi.mock("../../../components/card-back/CardBackStepCount.svelte", () => ({
  default: stubs.CardBackStepCount,
}));

import {
  rasterizeTurnGlyph,
  rasterizeReversalGlyph,
  rasterizeStepCount,
  rasterizeStartPosPictograph,
  CARD_RENDER_WIDTH,
  __setRasterizeFnForTest,
  __setRenderPictoFnForTest,
} from "../card-back-bitmaps-percard";

const CQI = CARD_RENDER_WIDTH / 100; // 16.44

interface RasterizeCall {
  Comp: unknown;
  props: Record<string, unknown>;
  w: number;
  h: number;
  opts?: { containerWidth?: number; settleFrames?: number; settleMs?: number };
}

interface RenderPictoCall {
  pictograph: unknown;
  options: { size: number; visibility: Record<string, unknown> };
}

// jsdom has no OffscreenCanvas / createImageBitmap; stub them so the pictograph
// rasterizer's compositing step runs without error (the real composite is
// verified in the browser harness).
function stubCanvasGlobals() {
  const fakeCtx = {
    save: vi.fn(), restore: vi.fn(), clip: vi.fn(), beginPath: vi.fn(),
    moveTo: vi.fn(), arcTo: vi.fn(), closePath: vi.fn(), stroke: vi.fn(),
    drawImage: vi.fn(), lineWidth: 0, strokeStyle: "",
  };
  vi.stubGlobal("OffscreenCanvas", class {
    constructor(public width: number, public height: number) {}
    getContext() { return fakeCtx; }
  });
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1, height: 1, close: vi.fn() })));
}

describe("card-back-bitmaps-percard rasterizers", () => {
  let rasterizeCalls: RasterizeCall[];
  let renderPictoCalls: RenderPictoCall[];

  beforeEach(() => {
    rasterizeCalls = [];
    renderPictoCalls = [];
    __setRasterizeFnForTest(async (Comp, props, w, h, opts) => {
      rasterizeCalls.push({ Comp, props, w, h, opts });
      return { close: vi.fn() } as unknown as ImageBitmap;
    });
    __setRenderPictoFnForTest(async (pictograph, options) => {
      renderPictoCalls.push({ pictograph, options: options as RenderPictoCall["options"] });
      return { width: options.size, height: options.size } as unknown as OffscreenCanvas;
    });
    stubCanvasGlobals();
  });

  afterEach(() => {
    __setRasterizeFnForTest(null);
    __setRenderPictoFnForTest(null);
    vi.unstubAllGlobals();
  });

  describe("rasterizeTurnGlyph", () => {
    it("mounts TurnPatternGlyph with the entries prop", async () => {
      const entries = [
        { blue: 1, red: 0 },
        { blue: 0.5, red: 1.5, blueFloat: true },
      ];
      await rasterizeTurnGlyph(entries);

      expect(rasterizeCalls).toHaveLength(1);
      const call = rasterizeCalls[0]!;
      expect(call.Comp).toBe(TurnPatternGlyph);
      expect(call.props).toEqual({ entries });
    });

    it("rasterizes at the glyph-box size (10cqi × 6cqi) with card-width container", async () => {
      await rasterizeTurnGlyph([{ blue: 0, red: 0 }]);
      const call = rasterizeCalls[0]!;
      expect(call.w).toBe(Math.round(10 * CQI));
      expect(call.h).toBe(Math.round(6 * CQI));
      expect(call.opts?.containerWidth).toBe(CARD_RENDER_WIDTH);
    });

    it("uses the border-aware ctx cqi for box size + container", async () => {
      const ctx = { containerWidth: 1529, cqi: 15.29, textMutedColor: "rgba(0,0,0,0.55)", textColor: "#111" };
      await rasterizeTurnGlyph([{ blue: 0, red: 0 }], ctx);
      const call = rasterizeCalls[0]!;
      expect(call.w).toBe(Math.round(10 * 15.29));
      expect(call.h).toBe(Math.round(6 * 15.29));
      expect(call.opts?.containerWidth).toBe(1529);
    });
  });

  describe("rasterizeReversalGlyph", () => {
    it("mounts ReversalPatternGlyph with sequence + period props", async () => {
      await rasterizeReversalGlyph("RBRB", 4);

      expect(rasterizeCalls).toHaveLength(1);
      const call = rasterizeCalls[0]!;
      expect(call.Comp).toBe(ReversalPatternGlyph);
      expect(call.props).toEqual({ sequence: "RBRB", period: 4 });
    });

    it("rasterizes at the glyph-box size (10cqi × 6cqi) with card-width container", async () => {
      await rasterizeReversalGlyph("----", 1);
      const call = rasterizeCalls[0]!;
      expect(call.w).toBe(Math.round(10 * CQI));
      expect(call.h).toBe(Math.round(6 * CQI));
      expect(call.opts?.containerWidth).toBe(CARD_RENDER_WIDTH);
    });
  });

  describe("rasterizeStepCount", () => {
    it("mounts CardBackStepCount with the count prop", async () => {
      await rasterizeStepCount(8);

      expect(rasterizeCalls).toHaveLength(1);
      const call = rasterizeCalls[0]!;
      expect(call.Comp).toBe(CardBackStepCount);
      // default ctx supplies the proof muted color
      expect(call.props).toEqual({ count: 8, textMutedColor: "rgba(0, 0, 0, 0.55)" });
    });

    it("rasterizes at the step-count slot size (20cqi × 9cqi)", async () => {
      await rasterizeStepCount(16);
      const call = rasterizeCalls[0]!;
      expect(call.w).toBe(Math.round(20 * CQI));
      expect(call.h).toBe(Math.round(9 * CQI));
      expect(call.opts?.containerWidth).toBe(CARD_RENDER_WIDTH);
    });

    it("forwards the ctx textMutedColor into the step-count props", async () => {
      const ctx = { containerWidth: 1529, cqi: 15.29, textMutedColor: "rgba(0,0,0,0.6)", textColor: "#111" };
      await rasterizeStepCount(8, ctx);
      const call = rasterizeCalls[0]!;
      expect(call.props).toEqual({ count: 8, textMutedColor: "rgba(0,0,0,0.6)" });
    });
  });

  describe("rasterizeStartPosPictograph", () => {
    const pictographData = { letter: "A", motions: {} };

    it("renders the pictograph via the Canvas2D pipeline (not a DOM mount)", async () => {
      await rasterizeStartPosPictograph(pictographData, true);
      expect(renderPictoCalls).toHaveLength(1);
      expect(rasterizeCalls).toHaveLength(0); // no mount+screenshot
      expect(renderPictoCalls[0]!.pictograph).toBe(pictographData);
    });

    it("renders at the 1.3× zoomed start-pos size", async () => {
      await rasterizeStartPosPictograph(pictographData, false, {
        containerWidth: 1529, cqi: 15.29, textMutedColor: "rgba(0,0,0,0.55)", textColor: "#111",
      });
      const box = Math.round(12 * 15.29);
      expect(renderPictoCalls[0]!.options.size).toBe(Math.round(box * 1.3));
    });

    it("passes the StartPositionPictograph visibility flags", async () => {
      await rasterizeStartPosPictograph(pictographData, true);
      const v = renderPictoCalls[0]!.options.visibility;
      expect(v.darkMode).toBe(true);
      expect(v.handPointVisibility).toBe("all");
      expect(v.showTKA).toBe(false);
      expect(v.showReversals).toBe(false);
      expect(v.showPositions).toBe(false);
    });

    it("returns an ImageBitmap", async () => {
      const bmp = await rasterizeStartPosPictograph(pictographData, false);
      expect(bmp).toBeTruthy();
    });
  });
});
