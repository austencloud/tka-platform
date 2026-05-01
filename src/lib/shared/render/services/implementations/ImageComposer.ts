import type { StepData } from "../../../../features/create/shared/domain/models/StepData";
import type { StartPositionData } from "../../../../features/create/shared/domain/models/StartPositionData";
import type { PictographData } from "../../../pictograph/shared/domain/models/PictographData";
import type { SequenceData } from "../../../foundation/domain/models/SequenceData";
import { type PropType } from "../../../pictograph/prop/domain/enums/PropType";
import type { PictographVisibilityOptions } from "../../utils/pictograph-to-svg";
import { LOOPTypeResolver } from "../../../../features/create/generate/shared/services/implementations/LOOPTypeResolver";
import { resolveLoopDisplay } from "$lib/features/loop-labeler/services/loop-display-resolver";
import { Period } from "$lib/features/create/generate/circular/domain/models/circular-models";
import {
  RESERVED_ORIENTATION_PRIMITIVES,
  type LOOPComponent,
} from "$lib/features/create/generate/shared/domain/models/generate-models";
import { simplifyRepeatedWord } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";
import { createStartPositionFromBeatStart } from "../../../../features/create/shared/services/implementations/sequence-transforms/sequence-transforms";
import { getVisibilityStateManager } from "../../../pictograph/shared/state/visibility-state.svelte";
import { getAnimationVisibilityManager } from "../../../animation-engine/state/animation-visibility-state.svelte";
import { getSettings } from "$lib/shared/application/state/app-state.svelte";
import { pictographPreparer } from "../../../pictograph/shared/services/implementations/PictographPreparer";
import { cellCacheKeyDeriver } from "../../../sequence-viewer/services/implementations/CellCacheKeyDeriver";
import type { PreviewCellRenderOptions } from "../../../sequence-viewer/services/contracts/IPreviewCellRenderer";

import { SequenceDifficultyCalculator } from "$lib/features/browse/sequences/display/services/implementations/SequenceDifficultyCalculator";
import type { SequenceExportOptions } from "../../domain/models/SequenceExportOptions";
import type { IDimensionCalculator } from "../contracts/IDimensionCalculator";
import type {
  CompositionProgressCallback,
  IImageComposer,
} from "../contracts/IImageComposer";
import type { ILayoutCalculator } from "../contracts/ILayoutCalculator";
import type { ITextRenderer } from "../contracts/ITextRenderer";
import type { IPictographBlobCache } from "../contracts/IPictographBlobCache";
import type { IPictographKeyHasher } from "../contracts/IPictographKeyHasher";
import type { IStepNumberRenderer } from "../contracts/IStepNumberRenderer";
import type { PictographMemoryCache } from "./PictographMemoryCache";
import type { Canvas2DDirectRenderer } from "./Canvas2DDirectRenderer";
import type { ILayerCompositor } from "../contracts/ILayerCompositor";
import type { IQRCodeGenerator } from "../../../qr/services/contracts/IQRCodeGenerator";
import {
  calculateHeaderHeight as sharedHeaderHeight,
  calculateFooterHeight as sharedFooterHeight,
} from "@tka/render-composition";

const DECK_HEADER_RATIO = 0.133;
const DECK_FOOTER_RATIO = 0.067;
const DECK_HEADER_BG = "rgba(245, 245, 245, 0.98)";
const DECK_BORDER_COLOR = "rgba(0, 0, 0, 0.1)";

export class ImageComposer implements IImageComposer {
  private readonly difficultyCalculator = new SequenceDifficultyCalculator();
  private readonly loopTypeResolver = new LOOPTypeResolver();

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
    private readonly layoutService: ILayoutCalculator,
    private readonly TextRenderer: ITextRenderer,
    private readonly DimensionCalculator: IDimensionCalculator,
    private readonly blobCache: IPictographBlobCache,
    private readonly keyHasher: IPictographKeyHasher,
    private readonly memoryCache: PictographMemoryCache,
    private readonly stepNumberRenderer: IStepNumberRenderer,
    private readonly canvas2DRenderer: Canvas2DDirectRenderer,
    private readonly layerCompositor?: ILayerCompositor,
    private qrCodeGenerator?: IQRCodeGenerator
  ) {}

  setQRCodeGenerator(generator: IQRCodeGenerator): void {
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
      const appSettings = getSettings();
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
        bluePropType: overrides.bluePropType ?? appSettings.bluePropType,
        redPropType: overrides.redPropType ?? appSettings.redPropType,
        handPathMode: overrides.handPathMode,
      };
    }

    const visibilityManager = getVisibilityStateManager();
    await visibilityManager.ensureSettingsLoaded();

    const animVisibilityManager = getAnimationVisibilityManager();

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
  ): Promise<HTMLCanvasElement> {
    if (!sequence.steps || sequence.steps.length === 0) {
      throw new Error("Sequence must have at least one beat");
    }

    await (this.TextRenderer as import("./TextRenderer").TextRenderer).preloadGlyphImages();

    this.compositionL2Hits = 0;
    this.compositionL1Hits = 0;
    this.compositionFreshRenders = 0;

    const visibilitySettings = await this.getVisibilitySettings(
      options.visibilityOverrides
    );

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
      [columns, rows] = this.layoutService.calculateLayout(
        stepCount,
        options.includeStartPosition ?? false,
        options.startPositionLayout ?? "column"
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

    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext("2d");
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

    const layoutMode = options.startPositionLayout ?? "column";
    const useColumnMode = layoutMode === "column" && options.includeStartPosition;
    const startRow = (!useColumnMode && options.includeStartPosition) ? 1 : 0;
    const startColumn = useColumnMode ? 1 : 0;
    const stepsPerRow = columns - startColumn;

    for (let i = 0; i < sequence.steps.length; i++) {
      if (signal?.aborted) throw new DOMException("Render aborted", "AbortError");
      if (i > 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
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
      const emptyCell = this.findEmptyCellForQR(columns, rows, sequence, options);
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

    this.drawSmartCellBorders(
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
    let rotationPeriod: Period | undefined;

    const display = resolveLoopDisplay(sequence);
    rotationPeriod = display.rotationPeriod;
    const inversionPeriod = display.inversionPeriod;
    const loopPeriod = display.period;

    if (display.components.size > 0) {
      loopComponents = display.components;
    } else if (loopTypeOverride) {
      const parsed = this.loopTypeResolver.parseComponents(loopTypeOverride);
      const filtered = new Set<LOOPComponent>();
      for (const c of parsed) {
        if (!RESERVED_ORIENTATION_PRIMITIVES.has(c)) filtered.add(c);
      }
      loopComponents = filtered.size > 0 ? filtered : undefined;
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
        options.leftLabel,
        options.elementIcon
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

    const previewKey = cellCacheKeyDeriver.deriveCacheKey(
      pictographData as PictographData,
      stepNumber,
      isDark,
      previewOptions
    );

    this.blobCache.set(previewKey, blob).catch(() => {});
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
          img = await this.blobToImage(cachedBlob);
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
          img = await this.canvasToImage(pictographCanvas);

          this.imageToBlob(img).then((blob) => {
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
        this.stepNumberRenderer.drawStepNumber(ctx, stepNumber, x, y, stepSize, isDarkMode);
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

  private drawSmartCellBorders(
    ctx: CanvasRenderingContext2D,
    columns: number,
    rows: number,
    stepSize: number,
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>,
    titleOffset: number = 0,
    isDarkMode: boolean = false,
    horizontalOffset: number = 0
  ): void {
    ctx.strokeStyle = isDarkMode ? "rgba(255, 255, 255, 0.15)" : "#e0e0e0";
    ctx.lineWidth = 1;

    const occupiedCells = this.getOccupiedCells(sequence, options, columns);

    const isOccupied = (col: number, row: number): boolean => {
      return occupiedCells.has(`${col},${row}`);
    };

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns - 1; col++) {
        if (isOccupied(col, row) && isOccupied(col + 1, row)) {
          const x = (col + 1) * stepSize + horizontalOffset;
          ctx.beginPath();
          ctx.moveTo(x, row * stepSize + titleOffset);
          ctx.lineTo(x, (row + 1) * stepSize + titleOffset);
          ctx.stroke();
        }
      }
    }

    for (let col = 0; col < columns; col++) {
      for (let row = 0; row < rows - 1; row++) {
        if (isOccupied(col, row) && isOccupied(col, row + 1)) {
          const y = (row + 1) * stepSize + titleOffset;
          ctx.beginPath();
          ctx.moveTo(col * stepSize + horizontalOffset, y);
          ctx.lineTo((col + 1) * stepSize + horizontalOffset, y);
          ctx.stroke();
        }
      }
    }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        if (!isOccupied(col, row)) continue;

        const x = col * stepSize + horizontalOffset;
        const y = row * stepSize + titleOffset;

        if (row === 0 || !isOccupied(col, row - 1)) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + stepSize, y);
          ctx.stroke();
        }

        if (row === rows - 1 || !isOccupied(col, row + 1)) {
          ctx.beginPath();
          ctx.moveTo(x, y + stepSize);
          ctx.lineTo(x + stepSize, y + stepSize);
          ctx.stroke();
        }

        if (col === 0 || !isOccupied(col - 1, row)) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + stepSize);
          ctx.stroke();
        }

        if (col === columns - 1 || !isOccupied(col + 1, row)) {
          ctx.beginPath();
          ctx.moveTo(x + stepSize, y);
          ctx.lineTo(x + stepSize, y + stepSize);
          ctx.stroke();
        }
      }
    }
  }

  private getOccupiedCells(
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>,
    columns: number
  ): Set<string> {
    const occupied = new Set<string>();

    const hasStartPositionToRender =
      options.includeStartPosition &&
      (sequence.startPosition || (sequence.steps && sequence.steps.length > 0));
    if (hasStartPositionToRender) {
      occupied.add("0,0");
    }

    const layoutMode = options.startPositionLayout ?? "column";
    const useColumnMode = layoutMode === "column" && !!options.includeStartPosition;
    const startRow = (!useColumnMode && options.includeStartPosition) ? 1 : 0;
    const startColumn = useColumnMode ? 1 : 0;
    const stepsPerRow = columns - startColumn;

    for (let i = 0; i < (sequence.steps?.length || 0); i++) {
      const col = startColumn + (i % stepsPerRow);
      const row = startRow + Math.floor(i / stepsPerRow);
      occupied.add(`${col},${row}`);
    }

    return occupied;
  }

  private findEmptyCellForQR(
    columns: number,
    rows: number,
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>
  ): { col: number; row: number } | null {
    const layoutMode = options.startPositionLayout ?? "column";
    const useColumnMode = layoutMode === "column" && !!options.includeStartPosition;

    if (options.includeStartPosition && !useColumnMode) {
      return { col: columns - 1, row: 0 };
    }

    const occupiedCells = this.getOccupiedCells(sequence, options, columns);
    for (let row = rows - 1; row >= 0; row--) {
      for (let col = 0; col < columns; col++) {
        if (!occupiedCells.has(`${col},${row}`)) {
          return { col, row };
        }
      }
    }

    return null;
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

  private async svgStringToImage(svgString: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load SVG as image"));
      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      img.src = url;
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
    });
  }

  private async canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to convert canvas to image"));
      const dataUrl = canvas.toDataURL("image/png");
      img.src = dataUrl;
      img.onload = () => {
        resolve(img);
      };
    });
  }

  private async svgToImage(svgString: string, size: number): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.width = size;
      img.height = size;
      img.onerror = () => reject(new Error("Failed to load SVG as image"));
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      img.src = url;
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
    });
  }

  private async blobToImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load blob as image"));
      const url = URL.createObjectURL(blob);
      img.src = url;
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
    });
  }

  private async imageToBlob(img: HTMLImageElement): Promise<Blob> {
    const canvas = document.createElement("canvas");
    canvas.width = img.width || img.naturalWidth;
    canvas.height = img.height || img.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context for blob conversion");
    }

    ctx.drawImage(img, 0, 0);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to convert canvas to blob"));
          }
        },
        "image/png",
        1.0
      );
    });
  }

  async composeFromCanvases(): Promise<HTMLCanvasElement> {
    throw new Error("Not implemented in simple version");
  }

  applyBackground(canvas: HTMLCanvasElement): HTMLCanvasElement {
    return canvas;
  }

  optimizeForExport(canvas: HTMLCanvasElement): HTMLCanvasElement {
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
      return this.difficultyCalculator.calculateDifficultyLevel([
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
    const preparedPictograph = await pictographPreparer.prepareSingle(pictographData, {
      themeMode,
      bluePropType: visibilitySettings.bluePropType,
      redPropType: visibilitySettings.redPropType,
      handPathMode: visibilitySettings.handPathMode ?? false,
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
    };

    const layerVisibility = {
      showTKA: visibilitySettings.showTKA ?? true,
      showReversals: visibilitySettings.showReversals ?? true,
    };

    const result = await this.layerCompositor.compose(
      preparedPictograph as unknown as import("../../../pictograph/shared/domain/models/PreparedPictographData").PreparedPictographData,
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
  ): Promise<HTMLCanvasElement> {
    const tightCanvas = await this.composeSequenceImage(
      sequence,
      options,
      onProgress,
      signal
    );

    const cardWidth = tightCanvas.width;
    const cardHeight = Math.round(cardWidth * (7 / 5));

    if (tightCanvas.height >= cardHeight) {
      return tightCanvas;
    }

    const cardCanvas = document.createElement("canvas");
    cardCanvas.width = cardWidth;
    cardCanvas.height = cardHeight;
    const ctx = cardCanvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context for card canvas");

    const isDarkMode = options.visibilityOverrides?.darkMode ?? false;
    ctx.fillStyle = isDarkMode ? "#0a0a0f" : "white";
    ctx.fillRect(0, 0, cardWidth, cardHeight);

    const stepCount = sequence.steps?.length ?? 0;
    const layout = this.layoutService.calculateLayout(
      stepCount,
      options.includeStartPosition ?? false,
      options.startPositionLayout ?? "column"
    );
    const [columns, rows] = layout;
    const baseBeatSize = options.stepSize || 120;
    const stepSize = Math.floor(baseBeatSize * (options.stepScale || 1));

    const earlyLoopType = options.loopType ?? sequence.loopType;
    const earlyShowLoopGlyph = options.showLoopGlyph !== false && !!earlyLoopType;
    const rawWord = (sequence.steps ?? [])
      .map((s: StepData) => s.letter ?? "")
      .join("");
    const showHeader =
      (options.addWord && (rawWord || options.customName)) ||
      options.addDifficultyLevel ||
      earlyShowLoopGlyph;
    const headerHeight = showHeader
      ? this.calculateHeaderHeight(stepCount, stepSize, columns)
      : 0;

    const showCreatorName = options.showCreatorName ?? options.addUserInfo;
    const showNotes = options.showNotes ?? options.addUserInfo;
    const showBirthday = options.showBirthday ?? options.addUserInfo;
    const hasFooter = showCreatorName || showNotes || showBirthday;
    const footerHeight = hasFooter ? this.calculateFooterHeight(stepSize, columns) : 0;

    const gridHeight = rows * stepSize;

    const availableHeight = cardHeight - headerHeight - footerHeight;

    const topPadding = Math.max(0, (availableHeight - gridHeight) / 2);

    const tightGridEnd = Math.min(
      headerHeight + gridHeight,
      tightCanvas.height
    );
    const tightFooterStart = tightGridEnd;
    const tightFooterEnd = Math.min(
      tightFooterStart + footerHeight,
      tightCanvas.height
    );

    if (headerHeight > 0) {
      ctx.drawImage(
        tightCanvas,
        0, 0, cardWidth, headerHeight,
        0, 0, cardWidth, headerHeight
      );
    }

    const sourceGridHeight = tightGridEnd - headerHeight;
    if (sourceGridHeight > 0) {
      ctx.drawImage(
        tightCanvas,
        0, headerHeight, cardWidth, sourceGridHeight,
        0, headerHeight + topPadding, cardWidth, sourceGridHeight
      );
    }

    const sourceFooterHeight = tightFooterEnd - tightFooterStart;
    if (footerHeight > 0 && sourceFooterHeight > 0) {
      ctx.drawImage(
        tightCanvas,
        0, tightFooterStart, cardWidth, sourceFooterHeight,
        0, cardHeight - footerHeight, cardWidth, footerHeight
      );
    }

    return cardCanvas;
  }
}

import { layoutCalculator } from "./LayoutCalculator";
import { textRenderer } from "./TextRenderer";
import { dimensionCalculator } from "./DimensionCalculator";
import { pictographBlobCache } from "./PictographBlobCache";
import { pictographKeyHasher } from "./PictographKeyHasher";
import { pictographMemoryCache } from "./PictographMemoryCache";
import { stepNumberRenderer } from "./StepNumberRenderer";
import { canvas2DDirectRenderer } from "./Canvas2DDirectRenderer";
import { layerCompositor } from "./LayerCompositor";

export const imageComposer = new ImageComposer(
  layoutCalculator,
  textRenderer,
  dimensionCalculator,
  pictographBlobCache,
  pictographKeyHasher,
  pictographMemoryCache,
  stepNumberRenderer,
  canvas2DDirectRenderer,
  layerCompositor
);
