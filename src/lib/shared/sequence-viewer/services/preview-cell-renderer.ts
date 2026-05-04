/**
 * Preview Cell Renderer
 *
 * Renders individual pictograph cells with two-layer caching:
 * 1. IndexedDB (PictographBlobCache) - persists across sessions
 * 2. WorkerRenderPool / LayerCompositor - off-thread rendering
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { PreviewCellRenderOptions } from "./contracts/types";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { LayerRenderOptions, LayerVisibility } from "../../render/services/contracts/types";
import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
import { pictographBlobCache } from "$lib/shared/render/services/implementations/PictographBlobCache";
import { getWorkerRenderPool } from "$lib/shared/render/services/implementations/WorkerRenderPool";
import { cellCacheKeyDeriver } from "./implementations/CellCacheKeyDeriver";
import type { BrowseViewMode } from "$lib/features/browse/shared/domain/BrowseViewMode";

function filterSoloMotions(
  data: PictographData,
  viewMode: BrowseViewMode
): PictographData {
  const keepColor = viewMode.color;
  const motions = { ...data.motions };
  if (keepColor === "blue") {
    delete motions.red;
  } else {
    delete motions.blue;
  }
  return { ...data, motions };
}

/**
 * Render a single pictograph and return a blob URL.
 * IMPORTANT: Callers must call URL.revokeObjectURL() on returned URLs when done.
 */
export async function renderCell(
  pictographData: PictographData,
  stepNumber: number | undefined,
  isDark: boolean,
  options: PreviewCellRenderOptions
): Promise<string> {
  const cacheKey = cellCacheKeyDeriver.deriveCacheKey(pictographData, stepNumber, isDark, options);

  try {
    const cachedBlob = await pictographBlobCache.get(cacheKey);
    if (cachedBlob) {
      return URL.createObjectURL(cachedBlob);
    }
  } catch {
    // Cache miss or error, proceed to render
  }

  const viewMode = options.browseViewMode;
  const isHandsView = viewMode?.subject === "hands";
  const isSoloView = viewMode?.granularity === "solo";

  const isHandPath = (options.handPathMode ?? false) || isHandsView;
  const effectiveBlueProp = isHandPath ? PropType.HAND : options.bluePropType;
  const effectiveRedProp = isHandPath
    ? PropType.HAND
    : (options.catDogModeEnabled ? options.redPropType : options.bluePropType);

  const soloFiltered = isSoloView
    ? filterSoloMotions(pictographData, viewMode!)
    : pictographData;

  const dataForRender = soloFiltered;

  const prepared = await pictographPreparer.prepareSingle(dataForRender, {
    themeMode: isDark ? "dark" : "light",
    bluePropType: effectiveBlueProp,
    redPropType: effectiveRedProp,
    handPathMode: isHandPath,
    showBlueMotion: options.showBlueMotion,
    showRedMotion: options.showRedMotion,
  });

  const isMotionSolo =
    (options.showBlueMotion === true && options.showRedMotion === false) ||
    (options.showRedMotion === true && options.showBlueMotion === false);
  const suppressOverlays = isHandPath || isSoloView || isMotionSolo;

  const renderOptions: LayerRenderOptions = {
    size: options.size,
    widthMultiplier: options.widthMultiplier,
    darkMode: isDark,
    showNonRadialPoints: options.showNonRadialPoints ?? true,
    handPointVisibility: options.handPointVisibility ?? "all",
    bluePropType: effectiveBlueProp,
    redPropType: effectiveRedProp,
    showBlueMotion: options.showBlueMotion,
    showRedMotion: options.showRedMotion,
    showVTG: suppressOverlays ? false : (options.showVTG ?? false),
    showElemental: suppressOverlays ? false : (options.showElemental ?? false),
    showPositions: suppressOverlays ? false : (options.showPositions ?? false),
  };

  const visibility: LayerVisibility = {
    showTKA: suppressOverlays ? false : (options.showTKA ?? true),
    showReversals: suppressOverlays ? false : (options.showReversals ?? true),
  };

  const pool = getWorkerRenderPool();
  const resolvedStepNumber = options.showStepNumbers ? stepNumber : undefined;
  const blob = await pool.render(prepared, renderOptions, visibility, resolvedStepNumber);

  pictographBlobCache.set(cacheKey, blob).catch(() => {});

  return URL.createObjectURL(blob);
}

/**
 * Delete a specific cell's cached blob from IndexedDB.
 */
export async function deleteCellCache(
  pictographData: PictographData,
  stepNumber: number | undefined,
  isDark: boolean,
  options: PreviewCellRenderOptions
): Promise<boolean> {
  const cacheKey = cellCacheKeyDeriver.deriveCacheKey(pictographData, stepNumber, isDark, options);
  return pictographBlobCache.delete(cacheKey);
}
