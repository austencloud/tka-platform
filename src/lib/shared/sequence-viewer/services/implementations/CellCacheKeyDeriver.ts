/**
 * CellCacheKeyDeriver
 *
 * Derives deterministic cache keys for pictograph cell renders.
 * Extracted from PreviewCellRenderer so both PreviewCellRenderer and
 * CellPreWarmer generate identical keys, guaranteeing cache hits when
 * the pre-warmer has already rendered a cell.
 *
 * Key format: "lsp2-{djb2hash}" where the hash encodes all rendering
 * parameters that affect the final pixel output.
 *
 * Version history:
 * - lsp-: Original format. Contaminated by ImageComposer write-through
 *   that stored blobs WITH step numbers under "nonum" keys.
 * - lsp2-: Attempted fix. Still contaminated because Canvas2DDirectRenderer
 *   unconditionally baked step numbers from StepData into rendered blobs.
 * - lsp3-: Fixed. Canvas2DDirectRenderer no longer draws step numbers.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { PreviewCellRenderOptions } from "../contracts/IPreviewCellRenderer";
import type { ICellCacheKeyDeriver } from "../contracts/ICellCacheKeyDeriver";

export class CellCacheKeyDeriver implements ICellCacheKeyDeriver {
  deriveCacheKey(
    pictographData: PictographData,
    stepNumber: number | undefined,
    isDark: boolean,
    options: PreviewCellRenderOptions
  ): string {
    // Build a deterministic key from ALL rendering parameters.
    // Every setting that affects the final pixel output MUST be in this key,
    // otherwise the IndexedDB blob cache returns stale images.
    const blue = pictographData.motions?.blue;
    const red = pictographData.motions?.red;
    const keyParts = [
      pictographData.letter || "start",
      blue?.motionType || "none",
      blue?.startLocation || "",
      blue?.endLocation || "",
      blue?.turns ?? 0,
      blue?.startOrientation ?? "",
      blue?.endOrientation ?? "",
      blue?.rotationDirection ?? "",
      red?.motionType || "none",
      red?.startLocation || "",
      red?.endLocation || "",
      red?.turns ?? 0,
      red?.startOrientation ?? "",
      red?.endOrientation ?? "",
      red?.rotationDirection ?? "",
      options.bluePropType || "staff",
      options.catDogModeEnabled
        ? (options.redPropType || "staff")
        : (options.bluePropType || "staff"),
      isDark ? "dark" : "light",
      options.showStepNumbers ? (stepNumber ?? "none") : "nonum",
      options.size,
      // Visibility settings that change the rendered output
      options.showNonRadialPoints ? "nr1" : "nr0",
      options.handPointVisibility ?? "all",
      options.showTKA ? "tka1" : "tka0",
      options.showReversals ? "rev1" : "rev0",
    ];

    // djb2 hash
    const str = keyParts.join("|");
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    return `lsp3-${Math.abs(hash).toString(36)}`;
  }
}

// Singleton — no state, pure function, safe to share
export const cellCacheKeyDeriver = new CellCacheKeyDeriver();
