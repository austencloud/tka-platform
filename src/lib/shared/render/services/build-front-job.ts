import type { SequenceData } from "../../foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import type { PreparedPictographData } from "../../pictograph/shared/domain/models/PreparedPictographData";
import type { SequenceExportOptions } from "../domain/models/sequence-export-options";
import type {
  FrontJob,
  FrontJobCell,
  FrontJobMandala,
  FrontJobQr,
} from "./front-job";
import { createStartPositionFromBeatStart } from "$lib/shared/create/services/sequence-transforms";
import {
  computeCardFrontLayout,
  buildCellLayerOptions,
} from "./card-front-assembler";
import { findEmptyCellForQR } from "./cell-border-renderer";
import { getImageComposer } from "../get-image-composer";
import { getMandalaPlacements } from "../../sequence-viewer/services/getMandalaPlacements";
import {
  LIGHT_MOTION_BLUE_STROKE,
  LIGHT_MOTION_RED_STROKE,
  LIGHT_MOTION_BLUE_FILL,
  LIGHT_MOTION_RED_FILL,
  LIGHT_MOTION_PURPLE_STROKE,
  LIGHT_MOTION_PURPLE_FILL,
  DARK_MOTION_BLUE_STROKE,
  DARK_MOTION_RED_STROKE,
  DARK_MOTION_BLUE_FILL,
  DARK_MOTION_RED_FILL,
  DARK_MOTION_PURPLE_STROKE,
  DARK_MOTION_PURPLE_FILL,
} from "../../mandala/domain/mandala-constants";

/**
 * QR colors mirror image-composer.renderQRCode, which calls
 * QRCodeGenerator.generateAsImage → qr-code-styling "modern" preset:
 *   dark module  = "#1a1a2e", light bg = "#ffffff", ECC "M".
 * In dark mode it swaps to white modules on a transparent background. The worker
 * paints the matrix via drawQrMatrix using exactly these colors so the rendered
 * QR matches the main-thread one at the layout layer.
 */
const QR_DARK_LIGHT = { dark: "#1a1a2e", light: "#ffffff" } as const;
const QR_DARK_DARKMODE = { dark: "#ffffff", light: "#00000000" } as const;
const QR_ECC: "L" | "M" | "Q" | "H" = "M";

/**
 * MAIN THREAD. Resolve a sequence + export options into a plain-data FrontJob
 * (visibility, prepared cells, mandala paths+placements, QR url, header word,
 * footer) for paintFrontJob to render in a worker. Mirrors composeSequenceImage's
 * main-thread resolution; reuses compose-card-front-parallel's cell/visibility
 * logic verbatim (the same resolveVisibilitySettings + effective prop-type
 * resolution + computeCardFrontLayout + cell list + prepareSingle).
 *
 * Transferable fields (for composeFront / the pool in Task 8): the prepared cell
 * data is structured-cloned (no Transferables); `footer.iconBitmap`, when set, is
 * a Transferable ImageBitmap that the pool MUST include in the postMessage
 * transfer list. Everything else (paths, placements, palette, strings, layout) is
 * plain structured-cloneable data.
 */
export async function buildFrontJob(
  sequence: SequenceData,
  options: Partial<SequenceExportOptions>,
): Promise<FrontJob> {
  if (!sequence.steps || sequence.steps.length === 0) {
    throw new Error("Sequence must have at least one beat");
  }

  const composer = getImageComposer();
  await composer.preloadHeaderGlyphs();

  // --- Visibility (mirror compose-card-front-parallel) -----------------------
  const visibility = await composer.resolveVisibilitySettings(options);
  const layout = computeCardFrontLayout(sequence, options, visibility);

  // Per-color prop-type overrides flow into prop-asset selection (renderPictographAt's
  // finalVisibilitySettings). Layout is geometry-only so it keeps `visibility`.
  const effectiveBluePropType = options.bluePropTypeOverride ?? options.propTypeOverride;
  const effectiveRedPropType = options.redPropTypeOverride ?? options.propTypeOverride;
  const cellVisibility = {
    ...visibility,
    bluePropType: effectiveBluePropType ?? visibility.bluePropType,
    redPropType: effectiveRedPropType ?? visibility.redPropType,
  };

  const { options: cellOptions, visibility: cellLayerVisibility } = buildCellLayerOptions(
    layout.stepSize,
    cellVisibility,
  );

  // --- Cells: start cell + step cells (mirror compose-card-front-parallel EXACTLY)
  const { pictographPreparer } = await import(
    "../../pictograph/shared/services/pictograph-preparer"
  );
  const themeMode = visibility.darkMode ? "dark" : "light";
  const prepare = (data: StepData | StartPositionData): Promise<PreparedPictographData> =>
    pictographPreparer.prepareSingle(data, {
      themeMode,
      bluePropType: cellVisibility.bluePropType,
      redPropType: cellVisibility.redPropType,
      handPathMode: cellVisibility.handPathMode ?? false,
      showBlueMotion: cellVisibility.showBlueMotion,
      showRedMotion: cellVisibility.showRedMotion,
    });

  interface PlannedCell {
    data: StepData | StartPositionData;
    col: number;
    row: number;
    stepNumber: number | undefined;
    duration: number;
  }
  const planned: PlannedCell[] = [];

  let derivedStartPosition: StartPositionData | null = null;
  const firstStep = sequence.steps[0];
  if (options.includeStartPosition && !sequence.startPosition && firstStep) {
    derivedStartPosition = createStartPositionFromBeatStart(firstStep);
  }
  const effectiveStartPosition = sequence.startPosition ?? derivedStartPosition;
  const hasStartPosition = options.includeStartPosition && effectiveStartPosition;

  if (hasStartPosition && effectiveStartPosition) {
    planned.push({
      data: effectiveStartPosition,
      col: 0,
      row: 0,
      stepNumber: options.addStepNumbers ? 0 : undefined,
      duration: 1,
    });
  }

  const { startRow, startColumn, stepsPerRow } = layout;
  for (let i = 0; i < sequence.steps.length; i++) {
    const beat = sequence.steps[i];
    if (!beat) continue;
    planned.push({
      data: beat,
      col: startColumn + (i % stepsPerRow),
      row: startRow + Math.floor(i / stepsPerRow),
      stepNumber: options.addStepNumbers ? i + 1 : undefined,
      duration: beat.duration ?? 1,
    });
  }

  const cells: FrontJobCell[] = await Promise.all(
    planned.map(async (c): Promise<FrontJobCell> => ({
      prepared: await prepare(c.data),
      col: c.col,
      row: c.row,
      stepNumber: c.stepNumber,
      duration: c.duration,
    })),
  );

  // --- Mandala (mirror image-composer.renderMandalas resolution) -------------
  const mandala = await resolveMandala(
    sequence,
    options,
    layout,
    effectiveBluePropType,
    effectiveRedPropType,
  );

  // --- QR (resolve URL string only — worker rasterizes the matrix) -----------
  const qr = await resolveQr(sequence, options, layout, effectiveBluePropType, effectiveRedPropType);

  // --- Header: WORD-ONLY (deck front has no difficulty / loop glyphs) --------
  // displayName mirrors paintCardFrontChrome: options.customName || derivedWord.
  const headerWord = options.customName || layout.derivedWord;
  const headerShow = !!(options.addWord && (layout.derivedWord || options.customName));

  // --- Footer (mirror paintCardFrontChrome footer flags) ---------------------
  const showCreatorName = options.showCreatorName ?? options.addUserInfo;
  const showNotes = options.showNotes ?? options.addUserInfo;
  const showBirthday = options.showBirthday ?? options.addUserInfo;
  const footerShow = !!(showCreatorName || showNotes || showBirthday);

  // Rasterize the per-card footer icon to an ImageBitmap on the main thread.
  // (The worker can't use new Image(); loadFooterIcon would fail there.)
  const iconBitmap = options.iconPath ? await rasterizeFooterIcon(options.iconPath) : undefined;

  const footerNotes =
    options.customNotesText && options.customNotesText.trim() !== ""
      ? options.customNotesText
      : options.notes && options.notes.trim() !== ""
        ? options.notes
        : undefined;

  // Footer text colors mirror renderFooter's dark/light split.
  const textColor = layout.isDarkMode ? "#ffffff" : "#231f20";
  const mutedColor = layout.isDarkMode ? "#a0a0a0" : "#6b6b6b";

  return {
    canvasWidth: layout.canvasWidth,
    canvasHeight: layout.canvasHeight,
    layout,
    cells,
    cellOptions,
    cellVisibility: cellLayerVisibility,
    background: {
      // fill mirrors paintCardFrontBackground; paint-front-job recomputes the
      // same value, this carries it for completeness/parity.
      fill: layout.isDarkMode ? "#0a0a0f" : "white",
      accentColor: options.accentColor,
      accentTintOpacity: options.accentTintOpacity,
    },
    isDarkMode: layout.isDarkMode,
    mandala,
    qr,
    header: { show: headerShow, word: headerWord },
    footer: {
      show: footerShow,
      leftLabel: options.leftLabel,
      rightLabel: options.rightLabel,
      notes: footerNotes,
      iconBitmap,
      textColor,
      mutedColor,
    },
  };
}

/**
 * Mirror of image-composer.renderMandalas' resolution half: calculator → paths,
 * getMandalaPlacements → placements, dark/light palette. Returns null when the
 * mandala is disabled, has no loopType, or produces no geometry/placements — so
 * the worker skips it exactly as paintCardFrontChrome's guard does.
 */
async function resolveMandala(
  sequence: SequenceData,
  options: Partial<SequenceExportOptions>,
  layout: ReturnType<typeof computeCardFrontLayout>,
  bluePropType: SequenceExportOptions["propTypeOverride"],
  redPropType: SequenceExportOptions["propTypeOverride"],
): Promise<FrontJobMandala | null> {
  // paintCardFrontChrome gate: showMandala && sequence.loopType.
  if (!options.visibilityOverrides?.showMandala || !sequence.loopType) return null;

  const { getMandalaGeometryCalculator } = await import(
    "../../mandala/getMandalaGeometryCalculator"
  );
  const calculator = getMandalaGeometryCalculator();
  const paths = calculator.calculate(sequence.steps ?? [], bluePropType, redPropType);
  if (paths.blue.length === 0 && paths.red.length === 0) return null;

  const { placements } = getMandalaPlacements({
    stepCount: sequence.steps?.length ?? 0,
    cols: layout.columns,
    rows: layout.rows,
    includeStartPosition: options.includeStartPosition ?? false,
    showQRCode: options.visibilityOverrides?.showQRCode ?? false,
    blueVisible: options.blueVisible ?? true,
    redVisible: options.redVisible ?? true,
    mandalaEnabled: true,
    startPositionLayout: options.startPositionLayout ?? "row",
  });
  if (placements.length === 0) return null;

  const palette = layout.isDarkMode
    ? {
        blueStroke: DARK_MOTION_BLUE_STROKE,
        blueFill: DARK_MOTION_BLUE_FILL,
        redStroke: DARK_MOTION_RED_STROKE,
        redFill: DARK_MOTION_RED_FILL,
        purpleStroke: DARK_MOTION_PURPLE_STROKE,
        purpleFill: DARK_MOTION_PURPLE_FILL,
      }
    : {
        blueStroke: LIGHT_MOTION_BLUE_STROKE,
        blueFill: LIGHT_MOTION_BLUE_FILL,
        redStroke: LIGHT_MOTION_RED_STROKE,
        redFill: LIGHT_MOTION_RED_FILL,
        purpleStroke: LIGHT_MOTION_PURPLE_STROKE,
        purpleFill: LIGHT_MOTION_PURPLE_FILL,
      };

  return { paths, placements, palette };
}

/**
 * Resolve the QR payload URL on the main thread. Mirrors buildChromeDeps'
 * renderQRCode gate (showQRCode + an empty cell) but, instead of rasterizing the
 * QR, reuses QRCodeGenerator.generateForSequence to resolve the shortcode → URL
 * string. The worker draws the matrix from that string via drawQrMatrix.
 *
 * NOTE: generateForSequence resolves a Firebase-backed short code, so this is an
 * async network hop. Acceptable for now; flagged as a per-card main-thread cost.
 */
async function resolveQr(
  sequence: SequenceData,
  options: Partial<SequenceExportOptions>,
  layout: ReturnType<typeof computeCardFrontLayout>,
  bluePropType: SequenceExportOptions["propTypeOverride"],
  redPropType: SequenceExportOptions["propTypeOverride"],
): Promise<FrontJobQr | null> {
  if (!options.visibilityOverrides?.showQRCode) return null;

  const cell = findEmptyCellForQR(layout.columns, layout.rows, sequence, options);
  if (!cell) return null;

  const { getQRCodeGenerator } = await import("$lib/shared/qr/getQRCodeGenerator");
  const generator = getQRCodeGenerator();

  let matrixText: string;
  try {
    const result = await generator.generateForSequence(sequence, {
      style: "modern",
      margin: 1,
      darkMode: layout.isDarkMode,
      bluePropType,
      redPropType,
      deckId: options.deckId,
      deckName: options.deckName,
    });
    matrixText = result.encodedUrl;
  } catch (err) {
    console.warn("[buildFrontJob] QR URL resolution failed; skipping QR:", err);
    return null;
  }

  const colors = layout.isDarkMode ? QR_DARK_DARKMODE : QR_DARK_LIGHT;
  return {
    matrixText,
    cell,
    darkColor: colors.dark,
    lightColor: colors.light,
    eccLevel: QR_ECC,
  };
}

/**
 * Rasterize the footer icon SVG (a static asset path) to an ImageBitmap on the
 * main thread. The worker's renderFooter draws it scaled to fit the footer, so a
 * sensible square decode size suffices; createImageBitmap preserves intrinsic
 * dimensions when the source carries them. Returns undefined on failure so the
 * footer simply renders without the icon.
 */
async function rasterizeFooterIcon(path: string): Promise<ImageBitmap | undefined> {
  try {
    const img = new Image();
    img.src = path;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load footer icon: ${path}`));
    });
    return await createImageBitmap(img);
  } catch (err) {
    console.warn("[buildFrontJob] footer icon rasterization failed:", err);
    return undefined;
  }
}
