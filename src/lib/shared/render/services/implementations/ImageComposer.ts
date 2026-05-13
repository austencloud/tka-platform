import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import type { PictographData } from "../../../pictograph/shared/domain/models/PictographData";
import type { SequenceData } from "../../../foundation/domain/models/SequenceData";
import { PropType } from "../../../pictograph/prop/domain/enums/PropType";
import type { PictographVisibilityOptions } from "../../utils/pictograph-to-svg";
import { parseLoopComponents } from "$lib/shared/create/services/loop-type-utils";
import { tryGetLoopDisplayResolver } from "$lib/shared/loop-labeler/getLoopDisplayResolver";
import { Period } from "$lib/shared/foundation/domain/models/generation/circular-models";
import {
  RESERVED_ORIENTATION_PRIMITIVES,
  LOOPComponent,
} from "$lib/shared/foundation/domain/models/generation/generate-models";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
import { createStartPositionFromBeatStart } from "$lib/shared/create/services/sequence-transforms";
// These 5 imports are loaded dynamically at usage sites to avoid pulling
// Svelte stores and $app/environment into the composition worker bundle.
// See: getVisibilitySettings(), renderPictographDirect(), storePictographBlob()
import type { PreviewCellRenderOptions } from "../../../sequence-viewer/services/preview-cell-renderer";
import { calculateDifficultyLevel as calculateSequenceDifficultyLevel } from "$lib/shared/browse/services/sequence-difficulty-calculator";
import type { SequenceExportOptions } from "../../domain/models/SequenceExportOptions";
import type { CompositionProgressCallback } from "../contracts/types";
import type { TextRenderer } from "./TextRenderer";
import type { PictographBlobCache } from "./PictographBlobCache";
import type { PictographKeyHasher } from "$lib/shared/render/services/implementations/PictographKeyHasher";
import type { PictographMemoryCache } from "./PictographMemoryCache";
import type { Canvas2DDirectRenderer } from "./Canvas2DDirectRenderer";
import type { LayerCompositor } from "./LayerCompositor";
import { calculateLayout } from "../layout-calculator";
import { drawStepNumber } from "../step-number-renderer";
import type { QRCodeGenerator } from "../../../qr/services/implementations/QRCodeGenerator";
import {
  calculateHeaderHeight as sharedHeaderHeight,
  calculateFooterHeight as sharedFooterHeight,
} from "@tka/render-composition";
import { blobToImage, canvasToImage, imageToBlob } from "./ImageFormatConverter";
import { createRenderCanvas } from "./createRenderCanvas";
import type { RenderCanvas } from "../contracts/types";
import { drawSmartCellBorders, findEmptyCellForQR } from "./cell-border-renderer";
import { composeCardImage as composeCardImageFn } from "./card-composer";
// getMandalaGeometryCalculator loaded dynamically to avoid pulling $app/environment into worker bundle
import { renderMandalaToCanvas } from "../../../mandala/services/mandala-renderer";
import { getMandalaPlacements } from "../../../sequence-viewer/services/getMandalaPlacements";
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
} from "../../../mandala/domain/mandala-constants";
import type { PreparedPictographData } from '../../../pictograph/shared/domain/models/PreparedPictographData';

const yieldToEventLoop: () => Promise<void> =
  (globalThis as unknown as Record<string, Record<string, () => Promise<void>>>).scheduler?.yield?.bind((globalThis as unknown as Record<string, unknown>).scheduler) ??
  (() => new Promise<void>((r) => setTimeout(r, 0)));

const DECK_HEADER_RATIO = 0.133;
const DECK_FOOTER_RATIO = 0.067;
const DECK_HEADER_BG = "rgba(245, 245, 245, 0.98)";
const DECK_BORDER_COLOR = "rgba(0, 0, 0, 0.1)";

export class ImageComposer {
  private layer1Hits = 0;
  private layer1Misses = 0;
  private layer2Hits = 0;
  private layer2Misses = 0;

  private compositionL2Hits = 0;
  private compositionL1Hits = 0;
  private compositionFreshRenders = 0;

  private canvas2DInitialized = false;

  private useCompositionalCaching = true;

  constructor(
    private readonly TextRenderer: TextRenderer,
    private readonly blobCache: PictographBlobCache,
    private readonly keyHasher: PictographKeyHasher,
    private readonly memoryCache: PictographMemoryCache,
    private readonly canvas2DRenderer: Canvas2DDirectRenderer,
    private readonly layerCompositor?: LayerCompositor,
    private qrCodeGenerator?: QRCodeGenerator
  ) {}

  setQRCodeGenerator(generator: QRCodeGenerator): void {
    this.qrCodeGenerator = generator;
  }

  setCompositionalCaching(enabled: boolean): void {
    this.useCompositionalCaching = enabled && !!this.layerCompositor;
  }

  getLayerCacheStats() {
    return this.layerCompositor?.getCacheStats() ?? null;
  }

  private async ensureCanvas2DInitialized(): Promise<void> {
    if (!this.canvas2DInitialized) {
      await this.canvas2DRenderer.initialize();
      this.canvas2DInitialized = true;
    }
  }

  private async getVisibilitySettings(
    overrides?: SequenceExportOptions["visibilityOverrides"]
  ): Promise<PictographVisibilityOptions> {
    if (
      overrides?.showTKA !== undefined &&
      overrides.showVTG !== undefined &&
      overrides.showElemental !== undefined &&
      overrides.showPositions !== undefined &&
      overrides.showReversals !== undefined &&
      overrides.showNonRadialPoints !== undefined
    ) {
      // Resolve prop types: prefer overrides, fall back to app settings, then default to STAFF
      let bluePropType = overrides.bluePropType;
      let redPropType = overrides.redPropType;
      if (!bluePropType || !redPropType) {
        try {
          const { getSettings } = await import("$lib/shared/application/state/app-state.svelte");
          const appSettings = getSettings();
          bluePropType ??= appSettings.bluePropType;
          redPropType ??= appSettings.redPropType;
        } catch {
          // Worker context — no app state available, use default prop type
          bluePropType ??= PropType.STAFF;
          redPropType ??= PropType.STAFF;
        }
      }
      return {
        showTKA: overrides.showTKA,
        showVTG: overrides.showVTG,
        showElemental: overrides.showElemental,
        showPositions: overrides.showPositions,
        showReversals: overrides.showReversals,
        showNonRadialPoints: overrides.showNonRadialPoints,
        darkMode: overrides.darkMode,
        showGrid: overrides.showGrid,
        handPointVisibility: overrides.handPointVisibility,
        bluePropType,
        redPropType,
        handPathMode: overrides.handPathMode,
      };
    }

    // Fallback path: read from Svelte stores (not available in worker context)
    const { getVisibilityStateManager } = await import(
      "../../../pictograph/shared/state/visibility-state.svelte"
    );
    const visibilityManager = getVisibilityStateManager();
    await visibilityManager.ensureSettingsLoaded();

    const { getAnimationVisibilityManager } = await import(
      "../../../animation-engine/state/animation-visibility-state.svelte"
    );
    const animVisibilityManager = getAnimationVisibilityManager();

    const { getSettings } = await import("$lib/shared/application/state/app-state.svelte");
    const appSettings = getSettings();

    const globalSettings: PictographVisibilityOptions = {
      showTKA: visibilityManager.getGlyphVisibility("tkaGlyph"),
      showVTG: visibilityManager.getGlyphVisibility("vtgGlyph"),
      showElemental: visibilityManager.getGlyphVisibility("elementalGlyph"),
      showPositions: visibilityManager.getGlyphVisibility("positionsGlyph"),
      showReversals: visibilityManager.getGlyphVisibility("reversalIndicators"),
      showNonRadialPoints: visibilityManager.getNonRadialVisibility(),
      darkMode: animVisibilityManager.isDarkMode(),
      handPointVisibility: visibilityManager.getHandPointVisibility(),
      bluePropType: appSettings.bluePropType,
      redPropType: appSettings.redPropType,
    };

    if (overrides) {
      return {
        showTKA: overrides.showTKA ?? globalSettings.showTKA,
        showVTG: overrides.showVTG ?? globalSettings.showVTG,
        showElemental: overrides.showElemental ?? globalSettings.showElemental,
        showPositions: overrides.showPositions ?? globalSettings.showPositions,
        showReversals: overrides.showReversals ?? globalSettings.showReversals,
        showNonRadialPoints:
          overrides.showNonRadialPoints ?? globalSettings.showNonRadialPoints,
        darkMode: overrides.darkMode ?? globalSettings.darkMode,
        showGrid: overrides.showGrid ?? true,
        handPointVisibility: overrides.handPointVisibility ?? globalSettings.handPointVisibility,
        bluePropType: overrides.bluePropType ?? globalSettings.bluePropType,
        redPropType: overrides.redPropType ?? globalSettings.redPropType,
        handPathMode: overrides.handPathMode,
      };
    }

    return globalSettings;
  }

  async composeSequenceImage(
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>,
    onProgress?: CompositionProgressCallback,
    signal?: AbortSignal
  ): Promise<RenderCanvas> {
    if (!sequence.steps || sequence.steps.length === 0) {
      throw new Error("Sequence must have at least one beat");
    }

    await (this.TextRenderer as TextRenderer).preloadGlyphImages();

    this.compositionL2Hits = 0;
    this.compositionL1Hits = 0;
    this.compositionFreshRenders = 0;

    const visibilitySettings = await this.getVisibilitySettings(
      options.visibilityOverrides
    );

    if (options.blueVisible === false) visibilitySettings.showBlueMotion = false;
    if (options.redVisible === false) visibilitySettings.showRedMotion = false;

    if (visibilitySettings.showBlueMotion === false || visibilitySettings.showRedMotion === false) {
      visibilitySettings.showTKA = false;
    }

    const stepCount = sequence.steps.length;
    let columns: number;
    let rows: number;
    if (options.columnCount != null && options.columnCount > 0) {
      columns = options.columnCount;
      const startCol = (options.includeStartPosition ?? false) ? 1 : 0;
      const stepsPerRow = columns - startCol;
      const firstRowSteps = Math.min(stepsPerRow, stepCount);
      const remaining = stepCount - firstRowSteps;
      rows = 1 + (remaining > 0 ? Math.ceil(remaining / stepsPerRow) : 0);
    } else {
      [columns, rows] = calculateLayout(
        stepCount,
        options.includeStartPosition ?? false,
        options.startPositionLayout ?? "row"
      );
    }

    const rawWord =
      sequence.word ||
      sequence.steps
        .filter((step) => step.letter)
        .map((step) => step.letter)
        .join("");

    const derivedWord = simplifyRepeatedWord(rawWord);

    const earlyLoopType = options.loopType ?? sequence.loopType;
    const earlyShowLoopGlyph = options.showLoopGlyph !== false && !!earlyLoopType;
    const showHeaderForLayout =
      (options.addWord && (derivedWord || options.customName)) ||
      options.addDifficultyLevel ||
      earlyShowLoopGlyph;

    const showCreatorName = options.showCreatorName ?? options.addUserInfo;
    const showNotes = options.showNotes ?? options.addUserInfo;
    const showBirthday = options.showBirthday ?? options.addUserInfo;
    const hasAnyFooterContent = showCreatorName || showNotes || showBirthday;

    let stepSize: number;
    let canvasWidth: number;
    let canvasHeight: number;
    let headerHeight: number;
    let footerHeight: number;

    if (options.deckCard) {
      const { contentWidth, contentHeight } = options.deckCard;
      canvasWidth = contentWidth;

      headerHeight = showHeaderForLayout
        ? Math.floor(contentWidth * DECK_HEADER_RATIO)
        : 0;
      footerHeight = hasAnyFooterContent
        ? Math.floor(contentWidth * DECK_FOOTER_RATIO)
        : 0;

      const availableHeight = contentHeight - headerHeight - footerHeight;
      stepSize = Math.floor(Math.min(contentWidth / columns, availableHeight / rows));

      canvasHeight = contentHeight;
    } else {
      const baseBeatSize = options.stepSize || 120;
      stepSize = Math.floor(baseBeatSize * (options.stepScale || 1));
      canvasWidth = columns * stepSize;

      headerHeight = showHeaderForLayout
        ? this.calculateHeaderHeight(stepCount, stepSize, columns)
        : 0;
      footerHeight = hasAnyFooterContent
        ? this.calculateFooterHeight(stepSize, columns)
        : 0;

      canvasHeight = rows * stepSize + headerHeight + footerHeight;
    }

    const canvas = createRenderCanvas(canvasWidth, canvasHeight);

    // Both HTMLCanvasElement and OffscreenCanvas provide compatible 2D contexts.
    // Cast to CanvasRenderingContext2D to satisfy downstream method signatures.
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }

    const isDarkMode = visibilitySettings.darkMode ?? false;
    ctx.fillStyle = isDarkMode ? "#0a0a0f" : "white";

    const gridHeight = rows * stepSize;
    const gridWidth = columns * stepSize;
    const gridOffsetY = options.deckCard
      ? headerHeight + Math.floor((canvasHeight - headerHeight - footerHeight - gridHeight) / 2)
      : headerHeight;
    const gridOffsetX = options.deckCard
      ? Math.floor((canvasWidth - gridWidth) / 2)
      : 0;

    if (options.deckCard) {
      ctx.fillRect(0, headerHeight, canvasWidth, canvasHeight - headerHeight - footerHeight);
    } else {
      ctx.fillRect(0, headerHeight, canvasWidth, gridHeight);
    }

    let derivedStartPosition: StartPositionData | null = null;
    const firstStep = sequence.steps[0];
    if (options.includeStartPosition && !sequence.startPosition && firstStep) {
      derivedStartPosition = createStartPositionFromBeatStart(firstStep);
    }
    const effectiveStartPosition = sequence.startPosition ?? derivedStartPosition;
    const hasStartPosition = options.includeStartPosition && effectiveStartPosition;
    const totalItems = sequence.steps.length + (hasStartPosition ? 1 : 0);
    let renderedCount = 0;

    onProgress?.({ current: 0, total: totalItems, stage: "rendering" });

    const hasPropOverride =
      options.propTypeOverride ||
      options.bluePropTypeOverride ||
      options.redPropTypeOverride;

    const effectiveBluePropType = options.bluePropTypeOverride ?? options.propTypeOverride;
    const effectiveRedPropType = options.redPropTypeOverride ?? options.propTypeOverride;

    if (hasStartPosition && effectiveStartPosition) {
      const startStepNumber = options.addStepNumbers ? 0 : undefined;
      const startPositionData = hasPropOverride
        ? this.applyPropTypeOverride(
            effectiveStartPosition,
            options.propTypeOverride,
            options.bluePropTypeOverride,
            options.redPropTypeOverride
          )
        : effectiveStartPosition;
      await this.renderPictographAt(
        ctx,
        startPositionData,
        0,
        0,
        stepSize,
        startStepNumber,
        gridOffsetY,
        visibilitySettings,
        effectiveBluePropType,
        effectiveRedPropType,
        gridOffsetX
      );
      renderedCount++;
      onProgress?.({
        current: renderedCount,
        total: totalItems,
        stage: "rendering",
      });
    }

    const layoutMode = options.startPositionLayout ?? "row";
    const useColumnMode = layoutMode === "column" && options.includeStartPosition;
    const startRow = (!useColumnMode && options.includeStartPosition) ? 1 : 0;
    const startColumn = useColumnMode ? 1 : 0;
    const stepsPerRow = columns - startColumn;

    for (let i = 0; i < sequence.steps.length; i++) {
      if (signal?.aborted) throw new DOMException("Render aborted", "AbortError");
      if (i > 0) await yieldToEventLoop();
      const beat = sequence.steps[i];
      if (!beat) continue;
      const col = startColumn + (i % stepsPerRow);
      const row = startRow + Math.floor(i / stepsPerRow);
      const stepNumber = options.addStepNumbers ? i + 1 : undefined;
      const stepData = hasPropOverride
        ? this.applyPropTypeOverride(
            beat,
            options.propTypeOverride,
            options.bluePropTypeOverride,
            options.redPropTypeOverride
          )
        : beat;
      await this.renderPictographAt(
        ctx,
        stepData,
        col,
        row,
        stepSize,
        stepNumber,
        gridOffsetY,
        visibilitySettings,
        effectiveBluePropType,
        effectiveRedPropType,
        gridOffsetX
      );

      const beatDuration = beat.duration ?? 1;
      if (Math.abs(beatDuration - 1.0) > 0.001) {
        const x = col * stepSize + gridOffsetX;
        const y = row * stepSize + gridOffsetY;
        this.drawDurationBadge(ctx, beatDuration, x, y, stepSize, isDarkMode);
      }

      renderedCount++;
      onProgress?.({
        current: renderedCount,
        total: totalItems,
        stage: "rendering",
      });
    }

    if (options.visibilityOverrides?.showQRCode && this.qrCodeGenerator) {
      const emptyCell = findEmptyCellForQR(columns, rows, sequence, options);
      if (emptyCell) {
        await this.renderQRCode(
          ctx,
          sequence,
          emptyCell,
          stepSize,
          gridOffsetY,
          isDarkMode,
          effectiveBluePropType,
          effectiveRedPropType,
          gridOffsetX
        );
      }
    }

    if (options.visibilityOverrides?.showMandala && sequence.loopType) {
      await this.renderMandalas(
        ctx,
        sequence,
        columns,
        rows,
        stepSize,
        gridOffsetY,
        gridOffsetX,
        isDarkMode,
        options,
        effectiveBluePropType,
        effectiveRedPropType
      );
    }

    drawSmartCellBorders(
      ctx,
      columns,
      rows,
      stepSize,
      sequence,
      options,
      gridOffsetY,
      isDarkMode,
      gridOffsetX
    );

    const loopTypeOverride = options.loopType;
    let loopComponents: Set<LOOPComponent> | undefined;

    const resolver = tryGetLoopDisplayResolver();
    const display = resolver?.(sequence);
    const rotationPeriod = display?.rotationPeriod;
    const inversionPeriod = display?.inversionPeriod;
    const loopPeriod = display?.period ?? 1;

    if (display && display.components.size > 0) {
      loopComponents = display.components;
    } else if (loopTypeOverride) {
      const parsed = parseLoopComponents(loopTypeOverride);
      const filtered = new Set<LOOPComponent>();
      for (const c of parsed) {
        if (!RESERVED_ORIENTATION_PRIMITIVES.has(c)) filtered.add(c);
      }
      loopComponents = filtered.size > 0 ? filtered : undefined;
    }

    // Filter LOOP components by view mode:
    // - Swapped requires two hands (meaningless for single-hand view)
    // - Inverted requires props (meaningless in hand-path mode)
    if (loopComponents) {
      const isHandPath = visibilitySettings.handPathMode ?? false;
      const isSolo = visibilitySettings.showBlueMotion === false || visibilitySettings.showRedMotion === false;
      if (isHandPath || isSolo) {
        const filtered = new Set(loopComponents);
        if (isSolo) filtered.delete(LOOPComponent.SWAPPED);
        if (isHandPath) filtered.delete(LOOPComponent.INVERTED);
        loopComponents = filtered.size > 0 ? filtered : undefined;
      }
    }
    const showLoopGlyph =
      options.showLoopGlyph !== false &&
      loopComponents &&
      loopComponents.size > 0;

    const showHeader =
      (options.addWord && (derivedWord || options.customName)) ||
      options.addDifficultyLevel ||
      showLoopGlyph;
    if (showHeader && headerHeight > 0) {
      const difficultyLevel = this.getDifficultyLevel(sequence);
      const displayName = options.addWord ? (options.customName || derivedWord) : "";
      const periodForRender =
        rotationPeriod === Period.QUARTERED
          ? "quartered"
          : rotationPeriod === Period.HALVED
            ? "halved"
            : undefined;

      const inversionForRender =
        inversionPeriod === Period.QUARTERED
          ? "quartered"
          : inversionPeriod === Period.HALVED
            ? "halved"
            : undefined;

      this.TextRenderer.renderWordHeader(
        canvas,
        displayName,
        {
          margin: options.margin || 0,
          stepScale: options.stepScale || 1,
        },
        headerHeight,
        difficultyLevel,
        options.addDifficultyLevel,
        isDarkMode,
        showLoopGlyph ? loopComponents : undefined,
        options.deckCard ? DECK_HEADER_BG : undefined,
        options.deckCard ? DECK_BORDER_COLOR : undefined,
        showLoopGlyph ? periodForRender : undefined,
        showLoopGlyph ? inversionForRender : undefined,
        showLoopGlyph ? loopPeriod : undefined
      );
    }

    if (hasAnyFooterContent && footerHeight > 0) {
      this.TextRenderer.renderUserInfo(
        canvas,
        {
          userName: options.userName || "",
          exportDate: options.exportDate || new Date().toISOString(),
          notes: options.notes || "",
          birthday: options.birthday,
        },
        {
          margin: options.margin || 10,
          stepScale: options.stepScale || 1,
        },
        footerHeight,
        stepCount,
        isDarkMode,
        {
          showCreatorName,
          showNotes,
          showBirthday,
        },
        options.customNotesText,
        options.deckCard ? DECK_HEADER_BG : undefined,
        options.deckCard ? DECK_BORDER_COLOR : undefined,
        options.leftLabel
      );
    }

    return canvas;
  }

  private writeThroughToPreviewCache(
    pictographData: StepData | PictographData,
    stepNumber: number | undefined,
    stepSize: number,
    visibilitySettings: PictographVisibilityOptions,
    blob: Blob
  ): void {
    const isDark = visibilitySettings.darkMode ?? false;
    const blueProp = visibilitySettings.bluePropType;
    const redProp = visibilitySettings.redPropType;
    const catDogModeEnabled = !!(blueProp && redProp && blueProp !== redProp);

    const previewOptions: PreviewCellRenderOptions = {
      size: stepSize,
      bluePropType: blueProp,
      redPropType: redProp,
      catDogModeEnabled,
      showStepNumbers: false,
      showNonRadialPoints: visibilitySettings.showNonRadialPoints ?? true,
      handPointVisibility: (visibilitySettings.handPointVisibility === "none"
        ? "active"
        : visibilitySettings.handPointVisibility ?? "all") as "all" | "active",
      showTKA: visibilitySettings.showTKA ?? true,
      showReversals: visibilitySettings.showReversals ?? true,
      handPathMode: visibilitySettings.handPathMode ?? false,
    };

    import("../../../sequence-viewer/services/implementations/CellCacheKeyDeriver")
      .then(({ cellCacheKeyDeriver: keyDeriver }) => {
        const previewKey = keyDeriver.deriveCacheKey(
          pictographData as PictographData,
          stepNumber,
          isDark,
          previewOptions
        );
        this.blobCache.set(previewKey, blob).catch(() => {});
      })
      .catch(() => {
        // Worker context — preview cache write-through unavailable
      });
  }

  private async renderPictographAt(
    ctx: CanvasRenderingContext2D,
    pictographData: StepData | PictographData,
    column: number,
    row: number,
    stepSize: number,
    stepNumber?: number,
    titleOffset: number = 0,
    visibilitySettings?: PictographVisibilityOptions,
    bluePropType?: PropType,
    redPropType?: PropType,
    horizontalOffset: number = 0
  ): Promise<void> {
    try {
      const finalVisibilitySettings: PictographVisibilityOptions = {
        ...visibilitySettings,
        bluePropType: bluePropType ?? visibilitySettings?.bluePropType,
        redPropType: redPropType ?? visibilitySettings?.redPropType,
      };

      if (this.useCompositionalCaching && this.layerCompositor) {
        await this.renderPictographWithLayerCompositor(
          ctx,
          pictographData,
          column,
          row,
          stepSize,
          stepNumber,
          titleOffset,
          finalVisibilitySettings,
          horizontalOffset
        );
        return;
      }

      const baseKey = this.keyHasher.deriveKey(pictographData, finalVisibilitySettings);

      const blobKey = `${baseKey}:${stepSize}`;

      let img = this.memoryCache.get(blobKey);

      if (img) {
        this.layer2Hits++;
        this.compositionL2Hits++;
      } else {
        this.layer2Misses++;

        const cachedBlob = await this.blobCache.get(blobKey);

        if (cachedBlob) {
          this.layer1Hits++;
          this.compositionL1Hits++;
          img = await blobToImage(cachedBlob);
        } else {
          this.layer1Misses++;
          this.compositionFreshRenders++;

          await this.ensureCanvas2DInitialized();

          const pictographCanvas = await this.canvas2DRenderer.renderPictograph(
            pictographData,
            {
              size: stepSize,
              visibility: finalVisibilitySettings,
              bluePropType: bluePropType,
              redPropType: redPropType,
            }
          );
          img = await canvasToImage(pictographCanvas);

          imageToBlob(img).then((blob) => {
            this.blobCache.set(blobKey, blob).catch((err) => {
              console.warn("[ImageComposer] Failed to cache blob:", err);
            });
            this.writeThroughToPreviewCache(
              pictographData, stepNumber, stepSize, finalVisibilitySettings, blob
            );
          });
        }

        this.memoryCache.set(blobKey, img);
      }

      const x = column * stepSize + horizontalOffset;
      const y = row * stepSize + titleOffset;
      ctx.drawImage(img, x, y, stepSize, stepSize);

      if (stepNumber !== undefined) {
        const isDarkMode = finalVisibilitySettings.darkMode ?? false;
        drawStepNumber(ctx, stepNumber, x, y, stepSize, isDarkMode);
      }
    } catch (error) {
      console.error(`❌ Failed to render beat at (${column}, ${row}):`, error);
      const x = column * stepSize + horizontalOffset;
      const y = row * stepSize + titleOffset;
      ctx.fillStyle = "#ffeeee";
      ctx.fillRect(x + 5, y + 5, stepSize - 10, stepSize - 10);
      ctx.fillStyle = "#cc0000";
      ctx.font = "14px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Error", x + stepSize / 2, y + stepSize / 2);
    }
  }

  private drawDurationBadge(
    ctx: CanvasRenderingContext2D,
    duration: number,
    x: number,
    y: number,
    cellSize: number,
    isDarkMode: boolean
  ): void {
    const VIEW_BOX_SIZE = 950;
    const scale = cellSize / VIEW_BOX_SIZE;

    const formatted = Number.isInteger(duration)
      ? duration.toString()
      : duration.toFixed(2).replace(/\.?0+$/, "");
    const text = `${formatted}×`;

    const fontSize = 52 * scale;
    const textX = x + 475 * scale;
    const textY = y + 890 * scale;

    ctx.save();
    ctx.font = `600 ${fontSize}px Inter, "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isDarkMode ? "#ffffff" : "#231f20";
    ctx.fillText(text, textX, textY);
    ctx.restore();
  }

  getCacheStats() {
    const memoryStats = this.memoryCache.getStats();
    const totalHits = this.layer1Hits + this.layer2Hits;
    const totalMisses = this.layer1Misses + this.layer2Misses;

    return {
      memoryCacheSize: memoryStats.size,
      memoryCacheMaxEntries: memoryStats.maxEntries,
      layer2Hits: this.layer2Hits,
      layer2Misses: this.layer2Misses,
      layer2HitRate:
        this.layer2Hits + this.layer2Misses > 0
          ? ((this.layer2Hits / (this.layer2Hits + this.layer2Misses)) * 100).toFixed(2) + "%"
          : "0%",

      layer1Hits: this.layer1Hits,
      layer1Misses: this.layer1Misses,
      layer1HitRate:
        this.layer1Hits + this.layer1Misses > 0
          ? ((this.layer1Hits / (this.layer1Hits + this.layer1Misses)) * 100).toFixed(2) + "%"
          : "0%",

      totalHits,
      totalMisses,
      overallHitRate:
        totalHits + totalMisses > 0
          ? ((totalHits / (totalHits + totalMisses)) * 100).toFixed(2) + "%"
          : "0%",
    };
  }

  async getLayer1Stats() {
    return this.blobCache.getStats();
  }

  async clearCache(includeIndexedDB: boolean = false): Promise<void> {
    this.memoryCache.clear();

    if (includeIndexedDB) {
      await this.blobCache.clear();
    }

    this.layer1Hits = 0;
    this.layer1Misses = 0;
    this.layer2Hits = 0;
    this.layer2Misses = 0;
  }


  private async renderQRCode(
    ctx: CanvasRenderingContext2D,
    sequence: SequenceData,
    cell: { col: number; row: number },
    stepSize: number,
    headerHeight: number,
    isDarkMode: boolean,
    bluePropType?: PropType,
    redPropType?: PropType,
    horizontalOffset: number = 0
  ): Promise<void> {
    if (!this.qrCodeGenerator) {
      return;
    }

    try {
      const qrSize = Math.floor(stepSize * 0.8);
      const padding = (stepSize - qrSize) / 2;

      const qrImage = await this.qrCodeGenerator.generateAsImage(
        sequence,
        qrSize,
        {
          style: "modern",
          margin: 1,
          darkMode: isDarkMode,
          bluePropType: bluePropType,
          redPropType: redPropType,
        }
      );

      const x = cell.col * stepSize + horizontalOffset + padding;
      const y = cell.row * stepSize + headerHeight + padding;

      ctx.fillStyle = isDarkMode ? "#000000" : "#ffffff";
      ctx.fillRect(
        cell.col * stepSize + horizontalOffset,
        cell.row * stepSize + headerHeight,
        stepSize,
        stepSize
      );

      ctx.drawImage(qrImage, x, y, qrSize, qrSize);
    } catch (error) {
      console.error("[ImageComposer] Failed to render QR code:", error);
    }
  }


  private async renderMandalas(
    ctx: CanvasRenderingContext2D,
    sequence: SequenceData,
    columns: number,
    rows: number,
    stepSize: number,
    gridOffsetY: number,
    gridOffsetX: number,
    isDarkMode: boolean,
    options: Partial<SequenceExportOptions>,
    bluePropType?: PropType,
    redPropType?: PropType,
  ): Promise<void> {
    try {
      const { getMandalaGeometryCalculator } = await import(
        "../../../mandala/getMandalaGeometryCalculator"
      );
      const calculator = getMandalaGeometryCalculator();
      const paths = calculator.calculate(
        sequence.steps ?? [],
        bluePropType,
        redPropType,
      );
      if (paths.blue.length === 0 && paths.red.length === 0) return;

      const layoutMode = options.startPositionLayout ?? "row";
      const { placements } = getMandalaPlacements({
        stepCount: sequence.steps?.length ?? 0,
        cols: columns,
        rows,
        includeStartPosition: options.includeStartPosition ?? false,
        showQRCode: options.visibilityOverrides?.showQRCode ?? false,
        blueVisible: options.blueVisible ?? true,
        redVisible: options.redVisible ?? true,
        mandalaEnabled: true,
        startPositionLayout: layoutMode,
      });

      if (placements.length === 0) return;

      const palette = isDarkMode
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

      const mandalaScale = 0.85;
      const mandalaSize = Math.floor(stepSize * mandalaScale);
      const padding = (stepSize - mandalaSize) / 2;

      for (const p of placements) {
        const show = p.variant === "full" ? "both" as const : p.variant;
        const x = (p.col - 1) * stepSize + gridOffsetX + padding;
        const y = (p.row - 1) * stepSize + gridOffsetY + padding;

        renderMandalaToCanvas(ctx, paths, {
          size: mandalaSize,
          style: "stroke",
          showGridDots: false,
          show,
          strokeWidth: 2,
          transparentBackground: true,
          palette,
          offsetX: x,
          offsetY: y,
        });
      }
    } catch (error) {
      console.error("[ImageComposer] Failed to render mandalas:", error);
    }
  }

  async composeFromCanvases(): Promise<RenderCanvas> {
    throw new Error("Not implemented in simple version");
  }

  applyBackground(canvas: RenderCanvas): RenderCanvas {
    return canvas;
  }

  optimizeForExport(canvas: RenderCanvas): RenderCanvas {
    return canvas;
  }

  private calculateHeaderHeight(stepCount: number, stepSize: number, columns?: number): number {
    if (stepCount === 0) return 0;
    return sharedHeaderHeight(stepSize, columns);
  }

  private calculateFooterHeight(stepSize: number, columns?: number): number {
    return sharedFooterHeight(stepSize, columns);
  }

  private applyPropTypeOverride<
    T extends StepData | PictographData | StartPositionData,
  >(
    data: T,
    propType?: PropType,
    bluePropType?: PropType,
    redPropType?: PropType
  ): T {
    const finalBlueProp = bluePropType ?? propType;
    const finalRedProp = redPropType ?? propType;

    const result = {
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

    return result;
  }

  private getDifficultyLevel(sequence: SequenceData): number {
    if (sequence.steps && sequence.steps.length > 0) {
      return calculateSequenceDifficultyLevel([
        ...sequence.steps,
      ]);
    }

    if (typeof sequence.level === "number" && sequence.level > 0) {
      return sequence.level;
    }

    return 1;
  }

  private async renderPictographWithLayerCompositor(
    ctx: CanvasRenderingContext2D,
    pictographData: StepData | PictographData,
    column: number,
    row: number,
    stepSize: number,
    stepNumber: number | undefined,
    titleOffset: number,
    visibilitySettings: PictographVisibilityOptions,
    horizontalOffset: number = 0
  ): Promise<void> {
    if (!this.layerCompositor) {
      throw new Error("LayerCompositor not available");
    }

    await this.ensureCanvas2DInitialized();

    const themeMode = visibilitySettings.darkMode ? "dark" : "light";
    const { pictographPreparer: preparer } = await import(
      "../../../pictograph/shared/services/implementations/PictographPreparer"
    );
    const preparedPictograph = await preparer.prepareSingle(pictographData, {
      themeMode,
      bluePropType: visibilitySettings.bluePropType,
      redPropType: visibilitySettings.redPropType,
      handPathMode: visibilitySettings.handPathMode ?? false,
      showBlueMotion: visibilitySettings.showBlueMotion,
      showRedMotion: visibilitySettings.showRedMotion,
    });

    const rawHandVisibility = visibilitySettings.handPointVisibility ?? "all";
    const handVisibility: "all" | "active" = rawHandVisibility === "none" ? "active" : rawHandVisibility;

    const layerOptions = {
      size: stepSize,
      darkMode: visibilitySettings.darkMode ?? false,
      showNonRadialPoints: visibilitySettings.showNonRadialPoints ?? false,
      handPointVisibility: handVisibility,
      bluePropType: visibilitySettings.bluePropType,
      redPropType: visibilitySettings.redPropType,
      showBlueMotion: visibilitySettings.showBlueMotion,
      showRedMotion: visibilitySettings.showRedMotion,
      showPositions: visibilitySettings.showPositions ?? false,
      handPathMode: visibilitySettings.handPathMode ?? false,
    };

    const layerVisibility = {
      showTKA: visibilitySettings.showTKA ?? true,
      showReversals: visibilitySettings.showReversals ?? true,
    };

    const result = await this.layerCompositor.compose(
      preparedPictograph as unknown as PreparedPictographData,
      layerOptions,
      layerVisibility,
      stepNumber
    );

    if (result.cacheStats.baseFromCache) {
      this.compositionL2Hits++;
      this.layer2Hits++;
    } else {
      this.compositionFreshRenders++;
      this.layer1Misses++;
    }

    const x = column * stepSize + horizontalOffset;
    const y = row * stepSize + titleOffset;
    ctx.drawImage(result.canvas, x, y, stepSize, stepSize);
  }

  async composeCardImage(
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>,
    onProgress?: CompositionProgressCallback,
    signal?: AbortSignal
  ): Promise<RenderCanvas> {
    return composeCardImageFn(
      sequence,
      options,
      (seq, opts, prog, sig) => this.composeSequenceImage(seq, opts, prog, sig),
      onProgress,
      signal
    );
  }
}

// Default singleton removed — it pulled PictographBlobCache ($app/environment) into
// the worker bundle. Use getImageComposer() from $lib/shared/render/getImageComposer
// for main-thread usage. The worker creates its own instances via composition.worker.ts.
