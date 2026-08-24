/**
 * getPreviewCacheKey — start-position layout collision
 *
 * Regression: the global ChoreoCard preview cache is a module-level Map shared
 * by every ChoreoCard instance. Its key captured the start-position LAYOUT
 * ("row"/"column") but NOT whether the start cell exists at all
 * (includeStartPosition). So the same sequence rendered with the start position
 * ON (viewer) and OFF (save panel) collided on one key. The onMount probe then
 * adopted cells laid out for the wrong mode while the reactive frame sized for
 * the current mode — reserving a phantom start row and spreading the step rows.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("$lib/shared/application/state/app-state.svelte", () => ({
  getSettings: () => ({ bluePropType: "staff", redPropType: "staff" }),
}));

import { getPreviewCacheKey } from "$lib/shared/choreo-card/services/choreo-card-cell-pipeline";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PreviewCellRenderOptions } from "$lib/shared/sequence-viewer/services/preview-cell-renderer";

function makeSequence(): SequenceData {
  return {
    id: "seq-1",
    word: "ABCD",
    steps: [
      { letter: "A", duration: 1, motions: { blue: {}, red: {} } },
      { letter: "B", duration: 1, motions: { blue: {}, red: {} } },
      { letter: "C", duration: 1, motions: { blue: {}, red: {} } },
      { letter: "D", duration: 1, motions: { blue: {}, red: {} } },
    ],
  } as unknown as SequenceData;
}

function makeOptions(): PreviewCellRenderOptions {
  return {
    size: 240,
    showStepNumbers: false,
    showNonRadialPoints: true,
    showTKA: true,
    showReversals: true,
    handPathMode: false,
    showBlueMotion: true,
    showRedMotion: true,
    showGrid: true,
  } as unknown as PreviewCellRenderOptions;
}

describe("getPreviewCacheKey — includeStartPosition", () => {
  it("produces DIFFERENT keys for start-on vs start-off (no cross-mode collision)", () => {
    const seq = makeSequence();
    const opts = makeOptions();

    const startOn = getPreviewCacheKey(seq, opts, null, false, "row", true);
    const startOff = getPreviewCacheKey(seq, opts, null, false, "row", false);

    expect(startOn).not.toBe(startOff);
  });

  it("is stable for identical inputs", () => {
    const seq = makeSequence();
    const opts = makeOptions();
    expect(getPreviewCacheKey(seq, opts, null, false, "row", true)).toBe(
      getPreviewCacheKey(seq, opts, null, false, "row", true)
    );
  });

  it("separates visible and invisible placeholder motions", () => {
    const visible = makeSequence();
    const hidden = makeSequence();
    (hidden.steps[0]!.motions.red as { isVisible?: boolean }).isVisible = false;

    expect(getPreviewCacheKey(visible, makeOptions(), null, false)).not.toBe(
      getPreviewCacheKey(hidden, makeOptions(), null, false)
    );
  });

  it("separates same-id transforms that only move motion locations", () => {
    const base = makeSequence();
    const transformed = makeSequence();
    Object.assign(base.steps[0]!.motions.blue!, {
      startLocation: "s",
      endLocation: "w",
    });
    Object.assign(transformed.steps[0]!.motions.blue!, {
      startLocation: "e",
      endLocation: "s",
    });

    expect(getPreviewCacheKey(base, makeOptions(), null, false)).not.toBe(
      getPreviewCacheKey(transformed, makeOptions(), null, false)
    );
  });
});
