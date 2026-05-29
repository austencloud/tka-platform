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
  __setPrepareFnForTest,
} from "../card-back-bitmaps-percard";

const CQI = CARD_RENDER_WIDTH / 100; // 16.44

interface RasterizeCall {
  Comp: unknown;
  props: Record<string, unknown>;
  w: number;
  h: number;
  opts?: { containerWidth?: number; settleFrames?: number; settleMs?: number };
}

interface PrepareCall {
  data: unknown;
  options: { themeMode: "dark" | "light" };
}

describe("card-back-bitmaps-percard rasterizers", () => {
  let rasterizeCalls: RasterizeCall[];
  let prepareCalls: PrepareCall[];

  beforeEach(() => {
    rasterizeCalls = [];
    prepareCalls = [];
    __setRasterizeFnForTest(async (Comp, props, w, h, opts) => {
      rasterizeCalls.push({ Comp, props, w, h, opts });
      return { close: vi.fn() } as unknown as ImageBitmap;
    });
    __setPrepareFnForTest(async (data, options) => {
      prepareCalls.push({ data, options });
      return {};
    });
  });

  afterEach(() => {
    __setRasterizeFnForTest(null);
    __setPrepareFnForTest(null);
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

    it("honors explicit width/height overrides", async () => {
      await rasterizeTurnGlyph([{ blue: 0, red: 0 }], 200, 120);
      const call = rasterizeCalls[0]!;
      expect(call.w).toBe(200);
      expect(call.h).toBe(120);
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
      expect(call.props).toEqual({ count: 8 });
    });

    it("rasterizes at the step-count slot size (20cqi × 9cqi)", async () => {
      await rasterizeStepCount(16);
      const call = rasterizeCalls[0]!;
      expect(call.w).toBe(Math.round(20 * CQI));
      expect(call.h).toBe(Math.round(9 * CQI));
      expect(call.opts?.containerWidth).toBe(CARD_RENDER_WIDTH);
    });

    it("forwards an explicit textMutedColor", async () => {
      await rasterizeStepCount(8, undefined, undefined, "rgba(0,0,0,0.6)");
      const call = rasterizeCalls[0]!;
      expect(call.props).toEqual({ count: 8, textMutedColor: "rgba(0,0,0,0.6)" });
    });
  });

  describe("rasterizeStartPosPictograph", () => {
    const pictographData = { letter: "A", motions: {} };

    it("mounts StartPositionPictograph with pictographData + darkMode props", async () => {
      await rasterizeStartPosPictograph(pictographData, true);

      expect(rasterizeCalls).toHaveLength(1);
      const call = rasterizeCalls[0]!;
      expect(call.Comp).toBe(StartPositionPictograph);
      expect(call.props).toEqual({ pictographData, darkMode: true });
    });

    it("rasterizes at the start-pos size (12cqi × 12cqi)", async () => {
      await rasterizeStartPosPictograph(pictographData, false);
      const call = rasterizeCalls[0]!;
      expect(call.w).toBe(Math.round(12 * CQI));
      expect(call.h).toBe(Math.round(12 * CQI));
      expect(call.opts?.containerWidth).toBe(CARD_RENDER_WIDTH);
    });

    it("pre-warms the prepare cache with the matching themeMode (dark)", async () => {
      await rasterizeStartPosPictograph(pictographData, true);
      expect(prepareCalls).toHaveLength(1);
      expect(prepareCalls[0]!.data).toBe(pictographData);
      expect(prepareCalls[0]!.options).toEqual({ themeMode: "dark" });
    });

    it("pre-warms with light themeMode when darkMode is false", async () => {
      await rasterizeStartPosPictograph(pictographData, false);
      expect(prepareCalls[0]!.options).toEqual({ themeMode: "light" });
    });

    it("pre-warms BEFORE mounting the component", async () => {
      const order: string[] = [];
      __setPrepareFnForTest(async () => {
        order.push("prepare");
        return {};
      });
      __setRasterizeFnForTest(async () => {
        order.push("rasterize");
        return { close: vi.fn() } as unknown as ImageBitmap;
      });
      await rasterizeStartPosPictograph(pictographData, true);
      expect(order).toEqual(["prepare", "rasterize"]);
    });

    it("passes the production settle budget (2 frames + 200ms) downstream", async () => {
      await rasterizeStartPosPictograph(pictographData, true);
      const call = rasterizeCalls[0]!;
      expect(call.opts?.settleFrames).toBe(2);
      expect(call.opts?.settleMs).toBe(200);
    });

    it("still rasterizes when pre-warm throws (component handles the fallback)", async () => {
      __setPrepareFnForTest(async () => {
        throw new Error("prepare failed");
      });
      await rasterizeStartPosPictograph(pictographData, true);
      expect(rasterizeCalls).toHaveLength(1);
    });
  });
});
