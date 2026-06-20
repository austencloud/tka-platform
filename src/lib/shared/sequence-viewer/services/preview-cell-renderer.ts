/**
 * Preview Cell Renderer
 *
 * Renders individual pictograph cells with two-layer caching:
 * 1. IndexedDB (PictographBlobCache) - persists across sessions
 * 2. WorkerRenderPool / LayerCompositor - off-thread rendering
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { LayerRenderOptions, LayerVisibility } from "../../render/services/types";
import type { BrowseViewMode } from "$lib/shared/browse/domain/browse-view-mode";

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
  handPointVisibility?: "all" | "active" | "none";

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
import { pictographPreparer } from "$lib/shared/pictograph/shared/services/pictograph-preparer";
import { pictographBlobCache } from "$lib/shared/render/services/pictograph-blob-cache";
import { getWorkerRenderPool } from "$lib/shared/render/services/worker-render-pool";
import { deriveCacheKey } from "./cell-cache-key-deriver";
import { compositeStepNumberOnBlob } from "./step-number-compositor";

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
  // The base pictograph is cached NUMBER-FREE (step number forced off) so blobs
  // are shared across beats and the persistent cache never bloats per-number.
  // The step number is composited on top afterwards (see compositeStepNumberOnBlob)
  // so it lands in the displayed image — dissolving in lockstep with the cell
  // during crossfades — without ever entering the base cache key.
  const baseOptions: PreviewCellRenderOptions =
    options.showStepNumbers ? { ...options, showStepNumbers: false } : options;
  const cacheKey = deriveCacheKey(pictographData, undefined, isDark, baseOptions);

  // Solo / motion-solo views keep their repositioned location label as a live
  // overlay (CellRenderer), so don't bake a number into those.
  const isMotionSoloCell =
    (options.showBlueMotion === true && options.showRedMotion === false) ||
    (options.showRedMotion === true && options.showBlueMotion === false);
  const wantNumber =
    !!options.showStepNumbers &&
    stepNumber != null &&
    stepNumber !== -1 &&
    options.browseViewMode?.granularity !== "solo" &&
    !isMotionSoloCell;

  try {
    const cachedBlob = await pictographBlobCache.get(cacheKey);
    if (cachedBlob) {
      return wantNumber
        ? URL.createObjectURL(
            await compositeStepNumberOnBlob(cachedBlob, stepNumber!, options.size, isDark, options.widthMultiplier ?? 1),
          )
        : URL.createObjectURL(cachedBlob);
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
  // Render the base number-free (the worker never bakes the number), then
  // composite the number on top below.
  const blob = await pool.render(prepared, renderOptions, visibility, undefined);

  pictographBlobCache.set(cacheKey, blob).catch(() => {});

  return wantNumber
    ? URL.createObjectURL(
        await compositeStepNumberOnBlob(blob, stepNumber!, options.size, isDark, options.widthMultiplier ?? 1),
      )
    : URL.createObjectURL(blob);
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
  const cacheKey = deriveCacheKey(pictographData, stepNumber, isDark, options);
  return pictographBlobCache.delete(cacheKey);
}
