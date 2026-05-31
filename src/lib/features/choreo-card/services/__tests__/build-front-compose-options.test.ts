import { describe, it, expect } from "vitest";
import { buildFrontComposeOptions } from "../build-front-compose-options";
import type { PrintRenderOptions } from "../types";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

const SEQ: SequenceData = {
  id: "seq-1",
  word: "ABC",
  author: "Tester",
  steps: [],
} as unknown as SequenceData;

const BASE_OPTS: PrintRenderOptions = {
  includeStartPosition: true,
  startPositionLayout: "row",
};

const FIXED_DATE = "2026-05-31T00:00:00.000Z";

describe("buildFrontComposeOptions", () => {
  it("computes deckCard content size = canvas - 2*round(bleed*2.0)", () => {
    const { composeOptions } = buildFrontComposeOptions(SEQ, BASE_OPTS, FIXED_DATE);
    // Defaults: 822x1122, bleed 36 → border = round(72) = 72 → content 678x978.
    expect(composeOptions.deckCard).toEqual({ contentWidth: 678, contentHeight: 978 });
  });

  it("honors explicit canvas/bleed dims", () => {
    const { composeOptions, frame } = buildFrontComposeOptions(
      SEQ,
      { ...BASE_OPTS, canvasWidth: 1644, canvasHeight: 2244, bleedPx: 72 },
      FIXED_DATE,
    );
    // border = round(72*2) = 144 → content 1356x1956.
    expect(composeOptions.deckCard).toEqual({ contentWidth: 1356, contentHeight: 1956 });
    expect(frame).toEqual({
      canvasWidth: 1644,
      canvasHeight: 2244,
      bleedPx: 72,
      accent: "#999999",
      dark: "#444444",
    });
  });

  it("threads the injected exportDate (parity determinism)", () => {
    const a = buildFrontComposeOptions(SEQ, BASE_OPTS, FIXED_DATE);
    const b = buildFrontComposeOptions(SEQ, BASE_OPTS, FIXED_DATE);
    expect(a.composeOptions.exportDate).toBe(FIXED_DATE);
    // Same inputs (incl. exportDate) → deep-equal options. This is the property
    // that guarantees main-vs-worker pixel parity.
    expect(a.composeOptions).toEqual(b.composeOptions);
    expect(a.frame).toEqual(b.frame);
  });

  it("derives accent/dark from tndElement when present", () => {
    const tndElement = {
      familyId: "split-same",
      name: "Water",
      element: "water",
      accentColor: "#3568a0",
      darkComplement: "#13284a",
      iconPath: "/images/elements/water-v2.png",
      cardTintOpacity: 0.12,
    } as unknown as PrintRenderOptions["tndElement"];
    const { composeOptions, frame } = buildFrontComposeOptions(
      SEQ,
      { ...BASE_OPTS, tndElement, iconPath: "/images/elements/water-v2.png", leftLabel: "Water" },
      FIXED_DATE,
    );
    expect(frame.accent).toBe("#3568a0");
    expect(frame.dark).toBe("#13284a");
    expect(composeOptions.accentColor).toBe("#3568a0");
    expect(composeOptions.accentTintOpacity).toBe(0.12);
    expect(composeOptions.iconPath).toBe("/images/elements/water-v2.png");
    // leftLabel set → showCreatorName true; iconPath set → showNotes true.
    expect(composeOptions.showCreatorName).toBe(true);
    expect(composeOptions.showNotes).toBe(true);
  });

  it("emits prop-type overrides only when provided", () => {
    const none = buildFrontComposeOptions(SEQ, BASE_OPTS, FIXED_DATE).composeOptions;
    expect(none.bluePropTypeOverride).toBeUndefined();
    expect(none.redPropTypeOverride).toBeUndefined();
  });
});
