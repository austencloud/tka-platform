import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { pickBestFitLayout } from "$lib/shared/render/services/container-aware-layout";
import { getCatalogLayoutPolicy } from "../domain/catalog-layout-policy";
import { getCardFrameContentInset } from "./card-front-frame";

export interface PhysicalCardLayoutInput {
  sequence: SequenceData;
  canvasWidth: number;
  canvasHeight: number;
  bleedPx: number;
  includeStartPosition: boolean;
  showHeader: boolean;
  showFooter: boolean;
  showQRCode: boolean;
}

export interface PhysicalCardLayout {
  startPositionLayout: "row" | "column";
  totalGridColumns?: number;
}

/**
 * Resolves the deterministic grid used by physical card renders. The shared
 * best-fit calculator owns the geometry; this adapter supplies the printable
 * area inside the card frame and preserves the catalog fallback.
 */
export function calculatePhysicalCardLayout(
  input: PhysicalCardLayoutInput
): PhysicalCardLayout {
  const {
    sequence,
    canvasWidth,
    canvasHeight,
    bleedPx,
    includeStartPosition,
    showHeader,
    showFooter,
    showQRCode,
  } = input;
  const frameInset = getCardFrameContentInset(bleedPx);
  const layout = pickBestFitLayout({
    stepCount: sequence.steps.length,
    stepDurations: sequence.steps.map((step) => step.duration ?? 1),
    includeStartPosition,
    containerWidth: canvasWidth - frameInset * 2,
    containerHeight: canvasHeight - frameInset * 2,
    showHeader,
    showFooter,
    showQRCode,
  });

  const startPositionLayout =
    layout?.startPlacement === "row" || layout?.startPlacement === "column"
      ? layout.startPlacement
      : getCatalogLayoutPolicy(sequence.steps.length);

  return {
    startPositionLayout,
    ...(layout ? { totalGridColumns: layout.cols } : {}),
  };
}
