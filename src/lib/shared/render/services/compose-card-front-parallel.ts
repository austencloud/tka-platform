import type { SequenceData } from "../../foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import type { PictographData } from "../../pictograph/shared/domain/models/PictographData";
import type { PreparedPictographData } from "../../pictograph/shared/domain/models/PreparedPictographData";
import type { SequenceExportOptions } from "../domain/models/sequence-export-options";
import type { PropType } from "../../pictograph/prop/domain/enums/PropType";
import type { RenderCanvas, RenderContext2D } from "./types";
import { createStartPositionFromBeatStart } from "$lib/shared/create/services/sequence-transforms";
import { getImageComposer } from "../get-image-composer";
import { createRenderCanvas } from "./create-render-canvas";
import {
  computeCardFrontLayout,
  paintCardFrontBackground,
  paintCardFrontChrome,
  buildCellLayerOptions,
} from "./card-front-assembler";
import type { CardFrontWorkerPool } from "./card-front-worker-pool";

/**
 * Replica of ImageComposer.applyPropTypeOverride (private). Pure shallow clone
 * that stamps the resolved prop type onto each color's motion. Kept local so the
 * parallel path applies the exact same per-cell prop override the serial path does.
 */
function applyPropTypeOverride<T extends StepData | PictographData | StartPositionData>(
  data: T,
  propType?: PropType,
  bluePropType?: PropType,
  redPropType?: PropType
): T {
  const finalBlueProp = bluePropType ?? propType;
  const finalRedProp = redPropType ?? propType;

  return {
    ...data,
    motions: {
      blue:
        data.motions.blue && finalBlueProp
          ? { ...data.motions.blue, propType: finalBlueProp }
          : data.motions.blue,
      red:
        data.motions.red && finalRedProp
          ? { ...data.motions.red, propType: finalRedProp }
          : data.motions.red,
    },
  };
}

interface ParallelCell {
  data: StepData | StartPositionData;
  col: number;
  row: number;
  stepNumber: number | undefined;
  duration: number;
}

/**
 * Parallel card-front renderer. Identical render contract to
 * ImageComposer.composeSequenceImage: same layout, same cell selection, same
 * step numbers, same prop overrides, same duration badges, same chrome — but the
 * per-cell pictograph rasters are fanned out to the CardFrontWorkerPool instead
 * of rendered serially on the main thread. The assembler (layout/background/
 * chrome) and the duration badge stay on the main thread via the shared
 * ImageComposer instance, so output is pixel-equivalent to the serial path.
 *
 * Throws if the pool is not ready so the caller can fall back to
 * composeSequenceImage. Individual cells that fail in their worker fall back to
 * the composer's main-thread layer compositor.
 */
export async function composeCardFrontParallel(
  sequence: SequenceData,
  options: Partial<SequenceExportOptions>,
  pool: CardFrontWorkerPool
): Promise<RenderCanvas> {
  if (!pool.isReady()) throw new Error("CardFrontWorkerPool not ready");
  if (!sequence.steps || sequence.steps.length === 0) {
    throw new Error("Sequence must have at least one beat");
  }

  const composer = getImageComposer();
  await composer.preloadHeaderGlyphs();

  const visibility = await composer.resolveVisibilitySettings(options);
  const layout = computeCardFrontLayout(sequence, options, visibility);

  const canvas = createRenderCanvas(layout.canvasWidth, layout.canvasHeight);
  const ctx = canvas.getContext("2d") as RenderContext2D;
  paintCardFrontBackground(ctx as CanvasRenderingContext2D, layout, options);

  const { options: cellOpts, visibility: cellVis } = buildCellLayerOptions(
    layout.stepSize,
    visibility
  );

  const { pictographPreparer } = await import(
    "../../pictograph/shared/services/pictograph-preparer"
  );
  const themeMode = visibility.darkMode ? "dark" : "light";
  const prepare = (data: StepData | StartPositionData): Promise<PreparedPictographData> =>
    pictographPreparer.prepareSingle(data as unknown as PictographData, {
      themeMode,
      bluePropType: visibility.bluePropType,
      redPropType: visibility.redPropType,
      handPathMode: visibility.handPathMode ?? false,
      showBlueMotion: visibility.showBlueMotion,
      showRedMotion: visibility.showRedMotion,
    });

  // --- Build the cell list, mirroring composeSequenceImage EXACTLY -----------
  const hasPropOverride =
    options.propTypeOverride ||
    options.bluePropTypeOverride ||
    options.redPropTypeOverride;

  const cells: ParallelCell[] = [];

  // Start position cell. composeSequenceImage derives it from the first step
  // (createStartPositionFromBeatStart) when includeStartPosition is set and the
  // sequence has no explicit startPosition. It renders at col 0, row 0,
  // stepNumber 0 (which the renderer draws as "Start"), duration 1.
  let derivedStartPosition: StartPositionData | null = null;
  const firstStep = sequence.steps[0];
  if (options.includeStartPosition && !sequence.startPosition && firstStep) {
    derivedStartPosition = createStartPositionFromBeatStart(firstStep);
  }
  const effectiveStartPosition = sequence.startPosition ?? derivedStartPosition;
  const hasStartPosition = options.includeStartPosition && effectiveStartPosition;

  if (hasStartPosition && effectiveStartPosition) {
    const startStepNumber = options.addStepNumbers ? 0 : undefined;
    const startPositionData = hasPropOverride
      ? applyPropTypeOverride(
          effectiveStartPosition,
          options.propTypeOverride,
          options.bluePropTypeOverride,
          options.redPropTypeOverride
        )
      : effectiveStartPosition;
    cells.push({
      data: startPositionData,
      col: 0,
      row: 0,
      stepNumber: startStepNumber,
      duration: 1,
    });
  }

  const { startRow, startColumn, stepsPerRow } = layout;

  for (let i = 0; i < sequence.steps.length; i++) {
    const beat = sequence.steps[i];
    if (!beat) continue;
    const col = startColumn + (i % stepsPerRow);
    const row = startRow + Math.floor(i / stepsPerRow);
    const stepNumber = options.addStepNumbers ? i + 1 : undefined;
    const stepData = hasPropOverride
      ? applyPropTypeOverride(
          beat,
          options.propTypeOverride,
          options.bluePropTypeOverride,
          options.redPropTypeOverride
        )
      : beat;
    cells.push({
      data: stepData,
      col,
      row,
      stepNumber,
      duration: beat.duration ?? 1,
    });
  }

  // --- Prepare + fan out concurrently; per-cell main-thread fallback ----------
  const bitmaps = await Promise.all(
    cells.map(async (cell) => {
      const prepared = await prepare(cell.data);
      try {
        return await pool.composeCell(prepared, cellOpts, cellVis, cell.stepNumber);
      } catch (e) {
        console.warn("[composeCardFrontParallel] cell fell back to main thread:", e);
        return composer.composeCellMainThread(prepared, cellOpts, cellVis, cell.stepNumber);
      }
    })
  );

  cells.forEach((cell, i) => {
    const x = cell.col * layout.stepSize + layout.gridOffsetX;
    const y = cell.row * layout.stepSize + layout.gridOffsetY;
    ctx.drawImage(bitmaps[i]!, x, y, layout.stepSize, layout.stepSize);
    if (Math.abs(cell.duration - 1) > 0.001) {
      composer.drawDurationBadgePublic(
        ctx as CanvasRenderingContext2D,
        cell.duration,
        x,
        y,
        layout.stepSize,
        layout.isDarkMode
      );
    }
  });

  await paintCardFrontChrome(
    canvas,
    ctx as CanvasRenderingContext2D,
    layout,
    sequence,
    options,
    visibility,
    composer.buildChromeDeps(sequence, layout, options)
  );

  return canvas;
}
