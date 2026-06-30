import { describe, it, expect } from "vitest";
import { buildChoreoCardRenderKeys } from "./choreo-card-render-keys";

// Minimal inputs; the cast keeps the test focused on key STRING construction,
// which is what drifted between ChoreoCard's onMount init and its render $effect
// (onMount omitted showGrid from the gv segment, so the keys never matched and a
// spurious "grid-stable-image" crossfade fired once after every mount — the
// "blip out and in as a group" bug). A single builder used by both call sites
// makes that drift impossible; these tests lock its format.
const base = {
  sequence: { id: "s", steps: [{ letter: "A" }, { letter: "B" }] },
  bluePropType: "staff",
  redPropType: "staff",
  catDogModeEnabled: false,
  showStepNumbers: false,
  showNonRadial: true,
  handPointVis: "all",
  showTKA: true,
  showReversals: true,
  showTnD: false,
  showElemental: false,
  showPositions: false,
  showGrid: true,
  showBlueMotion: true,
  showRedMotion: true,
  includeStartPosition: true,
  effectiveColumns: 4,
  darkMode: true,
} as unknown as Parameters<typeof buildChoreoCardRenderKeys>[0];

describe("buildChoreoCardRenderKeys", () => {
  it("is deterministic for identical inputs", () => {
    expect(buildChoreoCardRenderKeys(base)).toEqual(buildChoreoCardRenderKeys(base));
  });

  it("folds showGrid into the image key (4-digit gv) — guards the onMount/effect drift", () => {
    const gridOn = buildChoreoCardRenderKeys({ ...base, showGrid: true });
    const gridOff = buildChoreoCardRenderKeys({ ...base, showGrid: false });
    // showGrid MUST change the image key, or a grid toggle won't re-render cells.
    expect(gridOn.imageKey).not.toBe(gridOff.imageKey);
    // The gv segment must carry all four image-visibility flags (TnD, Elemental,
    // Positions, Grid). The original bug was a 3-digit gv on one side.
    expect(gridOn.imageKey).toMatch(/-gv:[01]{4}$/);
    expect(gridOff.imageKey).toMatch(/-gv:[01]{4}$/);
  });

  it("renderKey reflects darkMode; gridStableKey ignores image-only props", () => {
    expect(buildChoreoCardRenderKeys({ ...base, darkMode: true }).renderKey).not.toBe(
      buildChoreoCardRenderKeys({ ...base, darkMode: false }).renderKey,
    );
    // showTKA is an image-only prop: it must NOT change gridStableKey (else a
    // glyph toggle would be misclassified as a grid-structure change).
    expect(buildChoreoCardRenderKeys({ ...base, showTKA: false }).gridStableKey).toBe(
      buildChoreoCardRenderKeys({ ...base, showTKA: true }).gridStableKey,
    );
  });

  it("contentKey embeds imageKey and renderKey embeds contentKey", () => {
    const k = buildChoreoCardRenderKeys(base);
    expect(k.contentKey.startsWith(k.imageKey)).toBe(true);
    expect(k.renderKey.startsWith(k.contentKey)).toBe(true);
  });
});
