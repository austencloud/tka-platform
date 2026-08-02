import { describe, it, expect } from "vitest";
import {
  buildGalleryRenderInput,
  buildGalleryVisibility,
  type GalleryCompositionSource,
} from "$lib/shared/browse/services/gallery-render-input";
import type { InfoCellChoice } from "$lib/shared/sequence-viewer/services/info-cell-display";

// Pure fake of the slice buildGalleryVisibility reads. Mirrors the real
// ImageCompositionStateManager getters the live gallery card passes.
function source(overrides: Partial<{
  showQRCode: boolean;
  showMandala: boolean;
  layout: "row" | "column";
  choice: InfoCellChoice;
}> = {}): GalleryCompositionSource {
  const { showQRCode = true, showMandala = true, layout = "row", choice = "qr" } = overrides;
  return {
    showQRCode,
    showMandala,
    getStartPositionLayoutForStepCount: () => layout,
    getInfoCellChoiceForStepCount: () => choice,
  };
}

function seq(stepCount: number) {
  return { steps: Array.from({ length: stepCount }, (_, i) => ({ letter: String(i) })) } as any;
}

// 4-count, row layout, start included -> exactly one info cell -> contention.
const four = seq(4);
// 8-count row layout -> 3 info cells -> no contention (both QR + mandala fit).
const eight = seq(8);

describe("buildGalleryVisibility — per-length QR/mandala choice", () => {
  it("honors choice 'mandala' on a single-info-cell 4-count (QR off, mandala on)", () => {
    const v = buildGalleryVisibility({
      sequence: four,
      compositionManager: source({ choice: "mandala" }),
      isAuthenticated: true,
      allowQR: true,
    } as any);
    expect(v?.showQRCode).toBe(false);
    expect(v?.showMandala).toBe(true);
  });

  it("keeps the warmed cache class for choice 'qr' (QR on, mandala STAYS on)", () => {
    // The renderer reserves the one info cell for the QR (getMandalaPlacements
    // returns EMPTY), so the image is QR-only regardless of the mandala flag.
    // showMandala MUST stay true here or the key drifts off the warmer's
    // usesDefaults `_qr` bake (June 2026 cache-starvation class of bug).
    const v = buildGalleryVisibility({
      sequence: four,
      compositionManager: source({ choice: "qr" }),
      isAuthenticated: true,
      allowQR: true,
    } as any);
    expect(v?.showQRCode).toBe(true);
    expect(v?.showMandala).toBe(true);
  });

  it("choice 'none' suppresses both on the contended cell", () => {
    const v = buildGalleryVisibility({
      sequence: four,
      compositionManager: source({ choice: "none" }),
      isAuthenticated: true,
      allowQR: true,
    } as any);
    expect(v?.showQRCode).toBe(false);
    expect(v?.showMandala).toBe(false);
  });

  it("ignores the choice on a multi-info-cell card (no contention — both fit)", () => {
    const v = buildGalleryVisibility({
      sequence: eight,
      compositionManager: source({ choice: "mandala" }),
      isAuthenticated: true,
      allowQR: true,
    } as any);
    expect(v?.showQRCode).toBe(true);
    expect(v?.showMandala).toBe(true);
  });

  it("guest gets no QR; a 'qr' pick degrades to mandala", () => {
    const v = buildGalleryVisibility({
      sequence: four,
      compositionManager: source({ choice: "qr" }),
      isAuthenticated: false,
      allowQR: true,
    } as any);
    expect(v?.showQRCode).toBe(false);
    expect(v?.showMandala).toBe(true);
  });
});

describe("buildGalleryRenderInput — portable card provenance", () => {
  it("keeps personal names out of gallery rasters", () => {
    const input = buildGalleryRenderInput({
      sequence: {
        ...four,
        id: "sequence-id",
        name: "IIECCK",
        word: "IIECCK",
        ownerId: "christof-id",
        ownerDisplayName: "Christofborkott",
      },
      userName: "Austen Cloud",
      showCreatorName: true,
      showBirthday: true,
      compositionManager: source(),
      isAuthenticated: true,
    } as any);

    expect(input).not.toHaveProperty("userName");
    expect(input).not.toHaveProperty("showCreatorName");
    expect(input).not.toHaveProperty("showBirthday");
  });
});
