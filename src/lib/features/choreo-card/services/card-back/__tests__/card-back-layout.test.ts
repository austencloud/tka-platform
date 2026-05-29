/**
 * Tests for computeCardBackLayout().
 *
 * Concrete case: render dims 1644×2244 (scale-2 card back), cqi=16.44.
 * Expected values computed by hand from the CSS constants in CardBack.svelte.
 */

import { describe, it, expect } from "vitest";
import { computeCardBackLayout } from "../card-back-layout";
import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
import type { CardBackData } from "../../../components/card-back/card-back-data";

// ── Test fixtures ──────────────────────────────────────────────────────────

const DIMS = { width: 1644, height: 2244, cqi: 16.44 };

/**
 * Minimal CardBackData stub. Most fields are irrelevant to layout; only
 * loopComponents is used by computeCardBackLayout.
 */
function makeData(loopComponents: Set<LOOPComponent>): CardBackData {
  return {
    word: "TEST",
    stepCount: 8,
    level: {
      number: 1,
      name: "Base Motions",
      detail: "",
      reason: "All motions at 0 turns",
      gradient: "linear-gradient(135deg, #1a1a2e, #16213e)",
      textColor: "#ffffff",
    },
    anatomy: {
      positions: new Set(["alpha"]),
      motions: new Set(["shift"]),
      rotations: new Set(["cw"]),
      orientations: new Set(["in"]),
      turns: new Set(["0"]),
    },
    hasLoop: loopComponents.size > 0,
    loopComponents,
    rotationPeriod: undefined,
    loopLabel: null,
    loopExplanation: null,
    sliceName: null,
    sliceDetail: null,
    isRotated: false,
    startPosition: null,
    tndRatio: null,
    turnGlyphEntries: [{ blue: 0, red: 0 }],
    turnLabel: "0",
    startPositionLabel: null,
    reversalSequence: "----",
    reversalPeriod: 1,
    reversalLabel: "Cont.",
    handPathFamily: null,
    tkaDesignation: null,
    tndDesignation: null,
  };
}

// ── Main test suite ────────────────────────────────────────────────────────

describe("computeCardBackLayout", () => {
  const { width, height, cqi } = DIMS;

  // ── topLeftGlyph ─────────────────────────────────────────────────────────
  // .corner.top-left { top: 3.2cqi; left: 3.2cqi; }
  // .glyph-box { width: 10cqi; height: 6cqi; }
  describe("topLeftGlyph", () => {
    it("has exact pixel position from CSS", () => {
      const layout = computeCardBackLayout(makeData(new Set()), DIMS);
      expect(layout.topLeftGlyph.x).toBeCloseTo(3.2 * cqi, 5);  // 52.608
      expect(layout.topLeftGlyph.y).toBeCloseTo(3.2 * cqi, 5);  // 52.608
      expect(layout.topLeftGlyph.w).toBeCloseTo(10 * cqi, 5);   // 164.4
      expect(layout.topLeftGlyph.h).toBeCloseTo(6 * cqi, 5);    // 98.64
    });
  });

  // ── topRightGlyph ────────────────────────────────────────────────────────
  // .corner.top-right { top: 3.2cqi; right: 3.2cqi; }
  // .glyph-box { width: 10cqi; height: 6cqi; }
  // x = width - 3.2cqi - 10cqi = 1644 - 52.608 - 164.4 = 1426.992
  describe("topRightGlyph", () => {
    it("is right-aligned at 3.2cqi margin", () => {
      const layout = computeCardBackLayout(makeData(new Set()), DIMS);
      expect(layout.topRightGlyph.x).toBeCloseTo(width - 3.2 * cqi - 10 * cqi, 5); // 1426.992
      expect(layout.topRightGlyph.y).toBeCloseTo(3.2 * cqi, 5);
      expect(layout.topRightGlyph.w).toBeCloseTo(10 * cqi, 5);
      expect(layout.topRightGlyph.h).toBeCloseTo(6 * cqi, 5);
    });
  });

  // ── mandala ──────────────────────────────────────────────────────────────
  // .content inset: 10cqi 3.2cqi 30cqi
  //   → contentTop=10cqi, contentH=height-40cqi, contentW=width-6.4cqi
  // .mandala-anchor 72cqi×72cqi, flex-centered in content
  describe("mandala", () => {
    it("is 72cqi square", () => {
      const layout = computeCardBackLayout(makeData(new Set()), DIMS);
      expect(layout.mandala.w).toBeCloseTo(72 * cqi, 5); // 1183.68
      expect(layout.mandala.h).toBeCloseTo(72 * cqi, 5);
    });

    it("is horizontally centered (x = width/2 - 36cqi)", () => {
      const layout = computeCardBackLayout(makeData(new Set()), DIMS);
      expect(layout.mandala.x).toBeCloseTo(width / 2 - 36 * cqi, 5); // 822 - 591.84 = 230.16
    });

    it("is vertically centered within .content", () => {
      const layout = computeCardBackLayout(makeData(new Set()), DIMS);
      const contentCenterY = 10 * cqi + (height - 40 * cqi) / 2;
      expect(layout.mandala.y).toBeCloseTo(contentCenterY - 36 * cqi, 5);
    });
  });

  // ── loopRow (3 active components) ────────────────────────────────────────
  // .loop-row { bottom:28cqi; left:3cqi; right:3cqi; gap:6cqi }
  // .loop-icon-cell { width:9cqi; height:9cqi }
  describe("loopRow with 3 components", () => {
    const threeComponents = new Set([
      LOOPComponent.ROTATED,
      LOOPComponent.MIRRORED,
      LOOPComponent.FLIPPED,
    ]);

    it("produces exactly 3 items", () => {
      const layout = computeCardBackLayout(makeData(threeComponents), DIMS);
      expect(layout.loopRow.items).toHaveLength(3);
    });

    it("each item is 9cqi × 9cqi", () => {
      const layout = computeCardBackLayout(makeData(threeComponents), DIMS);
      for (const item of layout.loopRow.items) {
        expect(item.w).toBeCloseTo(9 * cqi, 5); // 147.96
        expect(item.h).toBeCloseTo(9 * cqi, 5);
      }
    });

    it("items are at the correct Y (bottom:28cqi)", () => {
      const layout = computeCardBackLayout(makeData(threeComponents), DIMS);
      const expectedY = height - 28 * cqi - 9 * cqi; // 2244 - 460.32 - 147.96 = 1635.72
      for (const item of layout.loopRow.items) {
        expect(item.y).toBeCloseTo(expectedY, 5);
      }
    });

    it("items are separated by 6cqi gaps", () => {
      const layout = computeCardBackLayout(makeData(threeComponents), DIMS);
      const items = layout.loopRow.items;
      const gap = items[1]!.x - (items[0]!.x + items[0]!.w);
      expect(gap).toBeCloseTo(6 * cqi, 5); // 98.64
    });

    it("group is horizontally centered (first+last icon centers average to width/2)", () => {
      const layout = computeCardBackLayout(makeData(threeComponents), DIMS);
      const items = layout.loopRow.items;
      const firstCenter = items[0]!.x + items[0]!.w / 2;
      const lastCenter = items[items.length - 1]!.x + items[items.length - 1]!.w / 2;
      const avg = (firstCenter + lastCenter) / 2;
      expect(avg).toBeCloseTo(width / 2, 4); // ≈ 822
    });
  });

  // ── loopRow with 0 components ─────────────────────────────────────────────
  describe("loopRow with 0 active components", () => {
    it("produces empty items array", () => {
      const layout = computeCardBackLayout(makeData(new Set()), DIMS);
      expect(layout.loopRow.items).toHaveLength(0);
    });
  });

  // ── levelBadge ───────────────────────────────────────────────────────────
  // .level-badge-slot { bottom:18cqi; } DifficultyBadge size="7cqi"
  describe("levelBadge", () => {
    it("is horizontally centered", () => {
      const layout = computeCardBackLayout(makeData(new Set()), DIMS);
      expect(layout.levelBadge.x).toBeCloseTo(width / 2 - 3.5 * cqi, 5); // 822 - 57.54 = 764.46
    });

    it("is positioned at bottom:18cqi", () => {
      const layout = computeCardBackLayout(makeData(new Set()), DIMS);
      const expectedY = height - 18 * cqi - 7 * cqi; // 2244 - 295.92 - 115.08 = 1833
      expect(layout.levelBadge.y).toBeCloseTo(expectedY, 5);
    });

    it("is 7cqi × 7cqi", () => {
      const layout = computeCardBackLayout(makeData(new Set()), DIMS);
      expect(layout.levelBadge.w).toBeCloseTo(7 * cqi, 5); // 115.08
      expect(layout.levelBadge.h).toBeCloseTo(7 * cqi, 5);
    });
  });

  // ── startPos ─────────────────────────────────────────────────────────────
  // .corner.bottom-left { bottom:2cqi; left:3.2cqi; }
  // .start-pos-picto { width:12cqi; height:12cqi; }
  describe("startPos", () => {
    it("is at left:3.2cqi, bottom:2cqi", () => {
      const layout = computeCardBackLayout(makeData(new Set()), DIMS);
      expect(layout.startPos.x).toBeCloseTo(3.2 * cqi, 5);    // 52.608
      expect(layout.startPos.y).toBeCloseTo(height - 2 * cqi - 12 * cqi, 5); // 2013.84
    });

    it("is 12cqi × 12cqi", () => {
      const layout = computeCardBackLayout(makeData(new Set()), DIMS);
      expect(layout.startPos.w).toBeCloseTo(12 * cqi, 5); // 197.28
      expect(layout.startPos.h).toBeCloseTo(12 * cqi, 5);
    });
  });

  // ── stepCount ────────────────────────────────────────────────────────────
  // .corner.bottom-right { bottom:2cqi; right:3.2cqi; }
  // .corner-label { font-size:9cqi; line-height:1; }
  describe("stepCount", () => {
    it("is right-aligned at 3.2cqi margin", () => {
      const layout = computeCardBackLayout(makeData(new Set()), DIMS);
      // x + w = width - 3.2cqi
      expect(layout.stepCount.x + layout.stepCount.w).toBeCloseTo(width - 3.2 * cqi, 5);
    });

    it("has height equal to font-size (9cqi, line-height:1)", () => {
      const layout = computeCardBackLayout(makeData(new Set()), DIMS);
      expect(layout.stepCount.h).toBeCloseTo(9 * cqi, 5); // 147.96
    });

    it("is at bottom:2cqi", () => {
      const layout = computeCardBackLayout(makeData(new Set()), DIMS);
      expect(layout.stepCount.y + layout.stepCount.h).toBeCloseTo(height - 2 * cqi, 5);
    });
  });

  // ── url ──────────────────────────────────────────────────────────────────
  // .url-slot { bottom:2.8cqi; left:0; right:0; }
  describe("url", () => {
    it("spans full width", () => {
      const layout = computeCardBackLayout(makeData(new Set()), DIMS);
      expect(layout.url.x).toBeCloseTo(0, 5);
      expect(layout.url.w).toBeCloseTo(width, 5);
    });

    it("is positioned near bottom:2.8cqi", () => {
      const layout = computeCardBackLayout(makeData(new Set()), DIMS);
      // y should be above the bottom:2.8cqi anchor
      expect(layout.url.y).toBeLessThan(height - 2.8 * cqi);
      // y+h should sit above or at the bottom anchor (url-slot bottom edge ≈ bottom+height)
      expect(layout.url.y + layout.url.h).toBeCloseTo(height - 2.8 * cqi, 0);
    });
  });

  // ── loopRow canonical order ───────────────────────────────────────────────
  // Verify that items follow LOOP_DISPLAY_ORDER (ROTATED, MIRRORED, FLIPPED, ...)
  // when a superset is passed.
  describe("loopRow ordering", () => {
    it("follows canonical display order (ROTATED before FLIPPED before REWOUND)", () => {
      const outOfOrderComponents = new Set([
        LOOPComponent.REWOUND,
        LOOPComponent.ROTATED,
        LOOPComponent.FLIPPED,
      ]);
      const layout = computeCardBackLayout(makeData(outOfOrderComponents), DIMS);
      // 3 items should be ordered: ROTATED (i=0), FLIPPED (i=2), REWOUND (i=5) in display order
      // → indices 0, 1, 2 in the output correspond to display-order positions 0, 2, 5
      expect(layout.loopRow.items).toHaveLength(3);
      // Each successive item must have a greater x than the previous
      const items = layout.loopRow.items;
      expect(items[1]!.x).toBeGreaterThan(items[0]!.x);
      expect(items[2]!.x).toBeGreaterThan(items[1]!.x);
    });
  });
});
