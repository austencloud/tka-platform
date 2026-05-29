/**
 * Preview Cell Renderer
 *
 * Renders individual pictograph cells with two-layer caching:
 * 1. IndexedDB (PictographBlobCache) - persists across sessions
 * 2. WorkerRenderPool / LayerCompositor - off-thread rendering
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { LayerRenderOptions, LayerVisibility } from "../../render/services/contracts/types";
import type { BrowseViewMode } from "$lib/shared/browse/domain/BrowseViewMode";

/**
 * Options for rendering a preview cell.
 * All visibility and prop settings that affect the rendered output.
 */
export interface PreviewCellRenderOptions {
  /** Render size in pixels (e.g., 480 for high-res) - this is the height; width = size * widthMultiplier */
  size: number;

  /** Width multiplier for duration-expanded cells (1 = square, 2 = double-wide). Default: 1 */
  widthMultiplier?: number;

  /** Blue hand prop type override */
  bluePropType?: PropType;

  /** Red hand prop type override (used when catDogModeEnabled) */
  redPropType?: PropType;

  /** When true, red hand uses redPropType; otherwise uses bluePropType */
  catDogModeEnabled?: boolean;

  /** Whether to render step numbers on the pictograph */
  showStepNumbers?: boolean;

  // Visibility settings (from user preferences)

  /** Show non-radial (corner) grid points */
  showNonRadialPoints?: boolean;

  /** Hand point visibility mode */
  handPointVisibility?: "all" | "active";

  /** Show TKA letter glyph */
  showTKA?: boolean;

  /** Show reversal indicators */
  showReversals?: boolean;

  /** Show TnD glyph (bottom-right category badge) */
  showTnD?: boolean;

  /** Show elemental glyph (paired with TnD, same corner) */
  showElemental?: boolean;

  /** Show start/end position letters (alpha/beta/gamma labels) */
  showPositions?: boolean;

  /** When true, renders hand path visualization: HAND props, float arrows for shifts,
   *  no TKA overlay, no reversals. Shows pure spatial trajectory. */
  handPathMode?: boolean;

  /** Browse view mode (props/hands x combined/solo x blue/red).
   *  Affects cache keys so the same sequence renders differently per mode. */
  browseViewMode?: BrowseViewMode;

  /** Show blue motion (prop + arrow). When false, renderer skips blue entirely. Default: true. */
  showBlueMotion?: boolean;

  /** Show red motion (prop + arrow). When false, renderer skips red entirely. Default: true. */
  showRedMotion?: boolean;
}
import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
import { pictographBlobCache } from "$lib/shared/render/services/pictograph-blob-cache";
import { getWorkerRenderPool } from "$lib/shared/render/services/worker-render-pool";
import { cellCacheKeyDeriver } from "./implementations/CellCacheKeyDeriver";

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
    showTnD: suppressOverlays ? false : (options.showTnD ?? false),
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
