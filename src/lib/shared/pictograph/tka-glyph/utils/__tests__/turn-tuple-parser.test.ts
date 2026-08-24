import { describe, it, expect } from "vitest";
import {
  parseTurnsTuple,
  getTurnNumberImagePath,
  getTurnNumberWidth,
  getHalfMarkWidth,
  HALF_MARK_IMAGE_PATH,
  MARK_GAP,
  getSlotUnitWidth,
  getSlotOffsetX,
} from "../turn-tuple-parser";

describe("quarter-turn number", () => {
  it("preserves 0.25 in both turn slots", () => {
    const result = parseTurnsTuple("(0.25, 0.25)");

    expect(result.top).toBe(0.25);
    expect(result.bottom).toBe(0.25);
  });

  it("resolves the dedicated glyph and its natural width", () => {
    expect(getTurnNumberImagePath(0.25)).toBe("/images/numbers/0.25.svg");
    expect(getTurnNumberWidth(0.25)).toBe(120);
  });
});

// Coverage for the halved-motion token ("/" suffix) added in
// docs/superpowers/specs/2026-07-16-half-notation-canon-design.md. The
// numeric/direction parsing itself predates this change and is only
// re-asserted here as a regression check that "/" doesn't leak into
// existing tuple shapes.
describe("parseTurnsTuple - halved-motion token", () => {
  it("parses a halved top slot in a 2-part tuple", () => {
    const result = parseTurnsTuple("(1.5/, 2)");
    expect(result.top).toBe(1.5);
    expect(result.topHalved).toBe(true);
    expect(result.bottom).toBe(2);
    expect(result.bottomHalved).toBe(false);
  });

  it("parses both slots halved with a direction prefix", () => {
    const result = parseTurnsTuple("(s, 1/, 2/)");
    expect(result.direction).toBe("s");
    expect(result.top).toBe(1);
    expect(result.topHalved).toBe(true);
    expect(result.bottom).toBe(2);
    expect(result.bottomHalved).toBe(true);
  });

  it("halved 0-turn still reports top=0 with topHalved true (mark-alone slot)", () => {
    const result = parseTurnsTuple("(0/, 0)");
    expect(result.top).toBe(0);
    expect(result.topHalved).toBe(true);
    expect(result.bottom).toBe(0);
    expect(result.bottomHalved).toBe(false);
  });

  it("parses a halved float slot", () => {
    const result = parseTurnsTuple("(fl/, 2)");
    expect(result.top).toBe("fl");
    expect(result.topHalved).toBe(true);
  });

  it("regression: unhalved 3-part direction tuple parses exactly as before", () => {
    const result = parseTurnsTuple("(s, 1, 2)");
    expect(result).toEqual({
      direction: "s",
      top: 1,
      bottom: 2,
      topOpenClose: null,
      bottomOpenClose: null,
      topHalved: false,
      bottomHalved: false,
    });
  });

  it("regression: unhalved 2-part tuple with a float slot parses exactly as before", () => {
    const result = parseTurnsTuple("(1.5, fl)");
    expect(result).toEqual({
      direction: null,
      top: 1.5,
      bottom: "fl",
      topOpenClose: null,
      bottomOpenClose: null,
      topHalved: false,
      bottomHalved: false,
    });
  });

  it("regression: 5-part both-rotating-hands tuple still parses direction and open/close", () => {
    const result = parseTurnsTuple("(s, 1, 1, op, cl)");
    expect(result.direction).toBe("s");
    expect(result.top).toBe(1);
    expect(result.bottom).toBe(1);
    expect(result.topOpenClose).toBe("op");
    expect(result.bottomOpenClose).toBe("cl");
    expect(result.topHalved).toBe(false);
    expect(result.bottomHalved).toBe(false);
  });

  it("a halved slot still honors the open/close binding in the 3-part no-direction form", () => {
    const result = parseTurnsTuple("(0, 1/, op)");
    expect(result.top).toBe(0);
    expect(result.bottom).toBe(1);
    expect(result.bottomHalved).toBe(true);
    expect(result.bottomOpenClose).toBe("op");
  });

  it("junk with a trailing slash still degrades to 0/not-halved-false safely", () => {
    // "/" alone (no digits) isn't a valid halved token - parseTurnValue's
    // existing fallback still applies to the stripped text.
    const result = parseTurnsTuple("(garbage/, 2)");
    expect(result.top).toBe(0);
    expect(result.topHalved).toBe(true);
  });
});

describe("half-mark asset helpers", () => {
  it("exposes the standalone mark asset path", () => {
    expect(HALF_MARK_IMAGE_PATH).toBe("/images/numbers/half.svg");
  });

  it("exposes the mark's viewBox width", () => {
    expect(getHalfMarkWidth()).toBe(16);
  });
});

// Shared layout math (getSlotUnitWidth/getSlotOffsetX) - the single source of
// truth TurnsColumn.svelte, canvas-2d-glyph-renderer.ts, and
// export-glyph-prerenderer.ts all import instead of re-deriving the
// gap/width/centering arithmetic three times.
describe("getSlotUnitWidth", () => {
  it("returns the number's own width when not halved", () => {
    expect(getSlotUnitWidth(30, false)).toBe(30);
    expect(getSlotUnitWidth(80, false)).toBe(80);
  });

  it("adds gap + mark width when halved", () => {
    // 30 (number) + 8 (MARK_GAP) + 16 (mark) = 54
    expect(getSlotUnitWidth(30, true)).toBe(30 + MARK_GAP + getHalfMarkWidth());
    expect(getSlotUnitWidth(30, true)).toBe(54);
  });
});

describe("getSlotOffsetX", () => {
  it("centers an unhalved slot exactly like plain (columnWidth - width) / 2", () => {
    expect(getSlotOffsetX(80, 30, false)).toBe((80 - 30) / 2);
  });

  it("is zero when the halved slot's unit equals the column width", () => {
    // top halved (unit 54) is the widest slot -> column is 54 -> offset 0
    expect(getSlotOffsetX(54, 30, true)).toBe(0);
  });

  it("shrinks the offset for a halved slot vs. an unhalved slot of the same own width, given the same column", () => {
    const columnWidth = 60;
    const unhalvedOffset = getSlotOffsetX(columnWidth, 30, false);
    const halvedOffset = getSlotOffsetX(columnWidth, 30, true);
    expect(halvedOffset).toBeLessThan(unhalvedOffset);
  });
});
