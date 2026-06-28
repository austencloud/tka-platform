import { describe, it, expect, vi, beforeEach } from "vitest";

// Controlled stand-ins for the two singleton managers the builder reads.
const ic = {
  includeStartPosition: true,
  addStepNumbers: true,
  addWord: true,
  addDifficultyLevel: true,
  showLoopGlyph: true,
  showCreatorName: true,
  showNotes: false,
  showBirthday: false,
  showQRCode: true,
  showMandala: true,
  _cols: 4 as number | null,
  _layout: "row" as "row" | "column",
  getColumnCountForStepCount: () => ic._cols,
  getStartPositionLayoutForStepCount: () => ic._layout,
};
const vm = { getGridVisibility: () => true };

vi.mock("$lib/shared/share/state/image-composition-state.svelte", () => ({
  getImageCompositionManager: () => ic,
}));
vi.mock("$lib/shared/pictograph/shared/state/visibility-state.svelte", () => ({
  getVisibilityStateManager: () => vm,
}));

import { buildCardRenderOptions } from "$lib/shared/share/services/card-render-options";

const seq = { steps: [{ letter: "A" }, { letter: "B" }, { letter: "C" }] } as any;

describe("buildCardRenderOptions", () => {
  beforeEach(() => {
    ic._cols = 4;
    ic.includeStartPosition = true;
    ic.addDifficultyLevel = true;
    ic.showLoopGlyph = true;
  });

  it("threads every panel toggle into the render options (no hand-path)", () => {
    const o = buildCardRenderOptions(seq, { darkMode: false, userName: "X" });
    expect(o.showLoopGlyph).toBe(true);
    expect(o.addDifficultyLevel).toBe(true);
    expect(o.addReversalSymbols).toBe(true);
    expect(o.visibilityOverrides?.showMandala).toBe(true);
    expect(o.visibilityOverrides?.showQRCode).toBe(true);
    expect(o.visibilityOverrides?.showGrid).toBe(true);
    expect(o.visibilityOverrides?.handPathMode).toBe(false);
    // Normal cards leave TKA/reversal visibility to the global vm fallback.
    expect(o.visibilityOverrides?.showTKA).toBeUndefined();
  });

  it("adds the start column to the step-column count", () => {
    ic._cols = 4;
    ic.includeStartPosition = true;
    expect(buildCardRenderOptions(seq, { darkMode: false, userName: "" }).columnCount).toBe(5);
    ic.includeStartPosition = false;
    expect(buildCardRenderOptions(seq, { darkMode: false, userName: "" }).columnCount).toBe(4);
    ic._cols = null;
    expect(buildCardRenderOptions(seq, { darkMode: false, userName: "" }).columnCount).toBeUndefined();
  });

  it("honors an explicit columnCount override (still +1 for the start column)", () => {
    expect(
      buildCardRenderOptions(seq, { darkMode: false, userName: "", columnCount: 6 }).columnCount
    ).toBe(7);
    expect(
      buildCardRenderOptions(seq, { darkMode: false, userName: "", columnCount: null }).columnCount
    ).toBeUndefined();
  });

  it("forces QR off for a one-count card even when the global QR toggle is on", () => {
    // showQRCode is on globally, but a single beat + start has no spare cell —
    // a QR would land on the start position. One-count cards never carry a QR.
    const oneStep = { steps: [{ letter: "A" }] } as any;
    expect(ic.showQRCode).toBe(true);
    const o = buildCardRenderOptions(oneStep, { darkMode: false, userName: "" });
    expect(o.visibilityOverrides?.showQRCode).toBe(false);
    // Multi-count cards are unaffected.
    expect(buildCardRenderOptions(seq, { darkMode: false, userName: "" }).visibilityOverrides?.showQRCode).toBe(true);
  });

  it("suppresses difficulty, LOOP glyph, reversals and TKA in hand-path mode", () => {
    const o = buildCardRenderOptions(seq, { darkMode: false, userName: "", isHandPath: true });
    expect(o.addDifficultyLevel).toBe(false);
    expect(o.showLoopGlyph).toBe(false);
    expect(o.addReversalSymbols).toBe(false);
    expect(o.visibilityOverrides?.handPathMode).toBe(true);
    expect(o.visibilityOverrides?.showTKA).toBe(false);
    expect(o.visibilityOverrides?.showReversals).toBe(false);
    // Mandala is NOT hand-path suppressed (matches the preview).
    expect(o.visibilityOverrides?.showMandala).toBe(true);
  });
});
