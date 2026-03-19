/**
 * Simple Image Composition Service
 *
 * Dead-simple approach: Render pictographs directly onto a single canvas.
 * No intermediate canvases, no complex calculations, just straightforward rendering.
 */

import type { StepData } from "../../../../features/create/shared/domain/models/StepData";
import type { StartPositionData } from "../../../../features/create/shared/domain/models/StartPositionData";
import type { PictographData } from "../../../pictograph/shared/domain/models/PictographData";
import type { SequenceData } from "../../../foundation/domain/models/SequenceData";
import { type PropType } from "../../../pictograph/prop/domain/enums/PropType";
import type { PictographVisibilityOptions } from "../../utils/pictograph-to-svg";
import { LOOPTypeResolver } from "../../../../features/create/generate/shared/services/implementations/LOOPTypeResolver";
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


export class ImageComposer implements IImageComposer {
  // Create instance directly to avoid DI module loading order issues
  private readonly difficultyCalculator = new SequenceDifficultyCalculator();
  private readonly loopTypeResolver = new LOOPTypeResolver();

  // Global two-layer caching stats (lifetime totals)
  private layer1Hits = 0;
  private layer1Misses = 0;
  private layer2Hits = 0;
  private layer2Misses = 0;

  // Per-composition stats (reset each sequence)
  private compositionL2Hits = 0;
  private compositionL1Hits = 0;
  private compositionFreshRenders = 0;

  // Canvas 2D direct renderer initialization flag
  private canvas2DInitialized = false;

  // Flag to enable compositional layer caching
  // When enabled, base layers are cached separately from overlays,
  // so visibility changes only require re-compositing, not re-rendering
  private useCompositionalCaching = true;

  constructor(
    private readonly layoutService: ILayoutCalculator,
    private readonly TextRenderer: ITextRenderer,
    private readonly DimensionCalculator: IDimensionCalculator,
    private readonly blobCache: IPictographBlobCache,
    private readonly keyHasher: IPictographKeyHasher,
    private readonly memoryCache: PictographMemoryCache,
    private readonly beatNumberRenderer: IStepNumberRenderer,
    private readonly canvas2DRenderer: Canvas2DDirectRenderer,
    private readonly layerCompositor?: ILayerCompositor,
    private qrCodeGenerator?: IQRCodeGenerator
  ) {}

  /**
   * Inject QR code generator after container initialization.
   * Required because qr-container is added after render-container.
   */
  setQRCodeGenerator(generator: IQRCodeGenerator): void {
    this.qrCodeGenerator = generator;
  }

  /**
   * Enable or disable compositional layer caching
   * When enabled, uses LayerCompositor for visibility-resilient caching
   */
  setCompositionalCaching(enabled: boolean): void {
    this.useCompositionalCaching = enabled && !!this.layerCompositor;
  }

  /**
   * Get LayerCompositor cache stats (when compositional caching is enabled)
   */
  getLayerCacheStats() {
    return this.layerCompositor?.getCacheStats() ?? null;
  }

  /**
   * Initialize the Canvas 2D renderer (loads arrow path data)
   * Called once on first fresh render
   */
  private async ensureCanvas2DInitialized(): Promise<void> {
    if (!this.canvas2DInitialized) {
      await this.canvas2DRenderer.initialize();
      this.canvas2DInitialized = true;
    }
  }
  /**
   * Get visibility settings for export
   * Uses explicit overrides from options if provided, otherwise falls back to global settings
   *
   * @param overrides Optional visibility overrides from export options
   */
  private async getVisibilitySettings(
    overrides?: SequenceExportOptions["visibilityOverrides"]
  ): Promise<PictographVisibilityOptions> {

    // If all required overrides are provided, use them directly (no async needed)
    // Still need to include prop types from global settings for cache key derivation
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
        showTKA: overrides.showTKA, // TKA Glyph includes turn numbers
        showVTG: overrides.showVTG,
        showElemental: overrides.showElemental,
        showPositions: overrides.showPositions,
        showReversals: overrides.showReversals,
        showNonRadialPoints: overrides.showNonRadialPoints,
        darkMode: overrides.darkMode,
        showGrid: overrides.showGrid,
        handPointVisibility: overrides.handPointVisibility,
        // Include prop types for cache key derivation
        bluePropType: overrides.bluePropType ?? appSettings.bluePropType,
        redPropType: overrides.redPropType ?? appSettings.redPropType,
      };
    }

    // Get global settings as base
    const visibilityManager = getVisibilityStateManager();
    await visibilityManager.ensureSettingsLoaded();

    // Get animation visibility for Dark Mode settings
    const animVisibilityManager = getAnimationVisibilityManager();

    // Get prop types from global settings for cache key consistency
    const appSettings = getSettings();

    const globalSettings: PictographVisibilityOptions = {
      showTKA: visibilityManager.getGlyphVisibility("tkaGlyph"), // TKA Glyph includes turn numbers
      showVTG: visibilityManager.getGlyphVisibility("vtgGlyph"),
      showElemental: visibilityManager.getGlyphVisibility("elementalGlyph"),
      showPositions: visibilityManager.getGlyphVisibility("positionsGlyph"),
      showReversals: visibilityManager.getGlyphVisibility("reversalIndicators"),
      showNonRadialPoints: visibilityManager.getNonRadialVisibility(),
      darkMode: animVisibilityManager.isDarkMode(),
      handPointVisibility: visibilityManager.getHandPointVisibility(),
      // Include prop types from global settings for cache key derivation
      bluePropType: appSettings.bluePropType,
      redPropType: appSettings.redPropType,
    };

    // Merge overrides with global settings (overrides take precedence)
    if (overrides) {
      return {
        showTKA: overrides.showTKA ?? globalSettings.showTKA, // TKA Glyph includes turn numbers
        showVTG: overrides.showVTG ?? globalSettings.showVTG,
        showElemental: overrides.showElemental ?? globalSettings.showElemental,
        showPositions: overrides.showPositions ?? globalSettings.showPositions,
        showReversals: overrides.showReversals ?? globalSettings.showReversals,
        showNonRadialPoints:
          overrides.showNonRadialPoints ?? globalSettings.showNonRadialPoints,
        darkMode: overrides.darkMode ?? globalSettings.darkMode,
        showGrid: overrides.showGrid ?? true, // Default to showing grid
        handPointVisibility: overrides.handPointVisibility ?? globalSettings.handPointVisibility,
        // Include prop types for cache key derivation
        bluePropType: overrides.bluePropType ?? globalSettings.bluePropType,
        redPropType: overrides.redPropType ?? globalSettings.redPropType,
      };
    }

    return globalSettings;
  }

  /**
   * Compose complete sequence image from sequence data
   * @param onProgress Optional callback for progress tracking during rendering
   */
  async composeSequenceImage(
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>,
    onProgress?: CompositionProgressCallback
  ): Promise<HTMLCanvasElement> {
    if (!sequence.steps || sequence.steps.length === 0) {
      throw new Error("Sequence must have at least one beat");
    }

    // Reset per-composition stats
    this.compositionL2Hits = 0;
    this.compositionL1Hits = 0;
    this.compositionFreshRenders = 0;

    // Get visibility settings ONCE at the start of composition
    // Uses explicit overrides from options if provided, otherwise falls back to global settings
    // NOTE: await ensures settings are loaded from persistence before reading (when no overrides)
    const visibilitySettings = await this.getVisibilitySettings(
      options.visibilityOverrides
    );

    // Step 1: Calculate layout using LayoutCalculator
    // This service has the proper lookup tables matching the desktop application
    const stepCount = sequence.steps.length;
    let columns: number;
    let rows: number;
    if (options.columnCount != null && options.columnCount > 0) {
      // Manual column override (e.g., from image export settings)
      columns = options.columnCount;
      const startCol = (options.includeStartPosition ?? false) ? 1 : 0;
      const stepsPerRow = columns - startCol;
      const firstRowSteps = Math.min(stepsPerRow, stepCount);
      const remaining = stepCount - firstRowSteps;
      rows = 1 + (remaining > 0 ? Math.ceil(remaining / stepsPerRow) : 0);
    } else {
      [columns, rows] = this.layoutService.calculateLayout(
        stepCount,
        options.includeStartPosition ?? false
      );
    }

    // Step 2: Calculate canvas dimensions including title space
    // Scale stepSize by stepScale to maintain proportions between grid and title areas
    const baseBeatSize = options.stepSize || 120;
    const stepSize = Math.floor(baseBeatSize * (options.stepScale || 1));
    const canvasWidth = columns * stepSize;

    // Derive word from beat letters if sequence.word is empty
    // This ensures the word displays even when built dynamically in the create module
    const rawWord =
      sequence.word ||
      sequence.steps
        .filter((beat) => beat.letter)
        .map((beat) => beat.letter)
        .join("");

    // Simplify repeated patterns (e.g., "ABCABCABC" → "ABC")
    // Does NOT truncate - allows full word length when needed for uniqueness
    const derivedWord = simplifyRepeatedWord(rawWord);

    // Calculate header height if word, difficulty, or LOOP glyph should be included
    // Header is at the TOP of the image - proportional to beat size for balanced layout
    // Must account for loopType here (not just later) so headerHeight is allocated
    const earlyLoopType = options.loopType ?? sequence.loopType;
    const showHeaderForLayout =
      (options.addWord && (derivedWord || options.customName)) ||
      options.addDifficultyLevel ||
      !!earlyLoopType;
    const headerHeight = showHeaderForLayout
        ? this.calculateHeaderHeight(stepCount, stepSize)
        : 0;

    // Calculate footer height if user info should be included
    // Check granular flags if provided, otherwise use addUserInfo for backwards compatibility
    const showCreatorName = options.showCreatorName ?? options.addUserInfo;
    const showNotes = options.showNotes ?? options.addUserInfo;
    const showBirthday = options.showBirthday ?? options.addUserInfo;
    const hasAnyFooterContent = showCreatorName || showNotes || showBirthday;
    const footerHeight = hasAnyFooterContent
      ? this.calculateFooterHeight(stepSize)
      : 0;

    const canvasHeight = rows * stepSize + headerHeight + footerHeight;

    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }

    // Step 3: Fill background for the grid area (offset by header height)
    // Note: Footer background is drawn by renderUserInfo with gray matching header style
    // Dark Mode uses dark background (#0a0a0f), normal mode uses white
    const isDarkMode = visibilitySettings.darkMode ?? false;
    ctx.fillStyle = isDarkMode ? "#0a0a0f" : "white";
    ctx.fillRect(0, headerHeight, canvasWidth, rows * stepSize);

    // Calculate total items to render for progress tracking
    // Derive start position from beat 1 if missing but requested
    let derivedStartPosition: StartPositionData | null = null;
    const firstStep = sequence.steps[0];
    if (options.includeStartPosition && !sequence.startPosition && firstStep) {
      derivedStartPosition = createStartPositionFromBeatStart(firstStep);
    }
    const effectiveStartPosition = sequence.startPosition ?? derivedStartPosition;
    const hasStartPosition = options.includeStartPosition && effectiveStartPosition;
    const totalItems = sequence.steps.length + (hasStartPosition ? 1 : 0);
    let renderedCount = 0;

    // Report initial progress
    onProgress?.({ current: 0, total: totalItems, stage: "rendering" });

    // Check if prop type overrides are specified (supports single or per-color overrides)
    const hasPropOverride =
      options.propTypeOverride ||
      options.bluePropTypeOverride ||
      options.redPropTypeOverride;

    // Determine the effective prop types to use for export
    // CRITICAL: These snapshotted values are passed through the entire render chain
    // to prevent race conditions where global settings could change during async rendering.
    const effectiveBluePropType = options.bluePropTypeOverride ?? options.propTypeOverride;
    const effectiveRedPropType = options.redPropTypeOverride ?? options.propTypeOverride;

    // Step 4: Render each pictograph directly onto the canvas (offset by header height)
    // Render start position if needed (always at column 0, row 0)
    if (hasStartPosition && effectiveStartPosition) {
      // Only pass beat number 0 if addStepNumbers is true (shows "Start" text)
      const startBeatNumber = options.addStepNumbers ? 0 : undefined;
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
        startBeatNumber,
        headerHeight, // Offset grid below header
        visibilitySettings, // Pass visibility settings
        effectiveBluePropType, // Pass snapshotted blue prop type
        effectiveRedPropType // Pass snapshotted red prop type
      );
      renderedCount++;
      onProgress?.({
        current: renderedCount,
        total: totalItems,
        stage: "rendering",
      });
    }

    // Step 5: Render all steps in the grid
    // Calculate how many steps per row based on the layout
    const startColumn = options.includeStartPosition ? 1 : 0;
    const stepsPerRow = columns - startColumn; // Available columns for steps

    for (let i = 0; i < sequence.steps.length; i++) {
      const beat = sequence.steps[i];
      if (!beat) continue; // Skip if beat is undefined
      // Calculate position: steps fill remaining columns, then wrap to next row
      // All rows start at startColumn (column 1 if start position exists, column 0 otherwise)
      const col = startColumn + (i % stepsPerRow);
      const row = Math.floor(i / stepsPerRow);
      // Only pass beat number if addStepNumbers is true
      const stepNumber = options.addStepNumbers ? i + 1 : undefined;
      // Apply prop type override if provided (supports single or per-color overrides)
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
        headerHeight, // Offset grid below header
        visibilitySettings, // Pass visibility settings
        effectiveBluePropType, // Pass snapshotted blue prop type
        effectiveRedPropType // Pass snapshotted red prop type
      );

      // Draw duration badge when beat has a non-default duration (not 1.0)
      const beatDuration = beat.duration ?? 1;
      if (Math.abs(beatDuration - 1.0) > 0.001) {
        const x = col * stepSize;
        const y = row * stepSize + headerHeight;
        this.drawDurationBadge(ctx, beatDuration, x, y, stepSize, isDarkMode);
      }

      renderedCount++;
      onProgress?.({
        current: renderedCount,
        total: totalItems,
        stage: "rendering",
      });
    }

    // Step 5b: Render QR code in empty cell (if enabled and available)
    if (options.visibilityOverrides?.showQRCode && this.qrCodeGenerator) {
      const emptyCell = this.findEmptyCellForQR(columns, rows, sequence, options);
      if (emptyCell) {
        await this.renderQRCode(
          ctx,
          sequence,
          emptyCell,
          stepSize,
          headerHeight,
          isDarkMode,
          effectiveBluePropType,
          effectiveRedPropType
        );
      }
    }

    // Step 6: Draw cell borders only between occupied cells
    this.drawSmartCellBorders(
      ctx,
      columns,
      rows,
      stepSize,
      sequence,
      options,
      headerHeight, // Offset grid below header
      isDarkMode
    );

    // Step 7: Render header with word at the top
    // The header has a level badge indicator (only if addDifficultyLevel is true)
    // Parse LOOP components for glyph display
    const loopType = options.loopType ?? sequence.loopType;
    const loopComponents = loopType
      ? this.loopTypeResolver.parseComponents(loopType)
      : undefined;
    const showLoopGlyph =
      options.showLoopGlyph !== false &&
      loopComponents &&
      loopComponents.size > 0;

    // Show header when word, difficulty, or LOOP glyph is enabled
    const showHeader =
      (options.addWord && (derivedWord || options.customName)) ||
      options.addDifficultyLevel ||
      showLoopGlyph;
    if (showHeader && headerHeight > 0) {
      const difficultyLevel = this.getDifficultyLevel(sequence);
      // Only show word if addWord is enabled
      // Use custom name if provided and addWord is enabled, otherwise use derived word if addWord is enabled
      const displayName = options.addWord ? (options.customName || derivedWord) : "";
      this.TextRenderer.renderWordHeader(
        canvas,
        displayName,
        {
          margin: options.margin || 0,
          stepScale: options.stepScale || 1,
        },
        headerHeight,
        difficultyLevel,
        options.addDifficultyLevel, // Only show badge if toggle is on
        isDarkMode, // Dark Mode for dark theme styling
        showLoopGlyph ? loopComponents : undefined // LOOP glyph badge
      );
    }

    // Step 8: Render user info footer at the bottom
    if (hasAnyFooterContent && footerHeight > 0) {
      this.TextRenderer.renderUserInfo(
        canvas,
        {
          userName: options.userName || "",
          exportDate: options.exportDate || new Date().toISOString(),
          notes: options.notes || "",
          birthday: options.birthday, // Original sequence creation date
        },
        {
          margin: options.margin || 10,
          stepScale: options.stepScale || 1,
        },
        footerHeight, // Pass footer height for proper text positioning
        stepCount, // Pass beat count for legacy-matching font sizing
        isDarkMode, // Dark Mode for dark theme styling
        // Granular footer visibility flags
        {
          showCreatorName,
          showNotes,
          showBirthday,
        },
        options.customNotesText // Custom notes text override
      );
    }

    // Cache stats are available via getCacheStats() for debugging
    // Removed per-sequence logging to reduce console noise during gallery browsing

    return canvas;
  }

  // =========================================================================
  // Write-through to preview cache
  // When ImageComposer renders a cell for a thumbnail, also write it to
  // PictographBlobCache under the key that PreviewCellRenderer expects.
  // This means when the user clicks a sequence, the preview finds every
  // cell already cached — instant display, zero re-rendering.
  // =========================================================================

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
      // ChoreoCard renders step numbers as HTML overlays, not in blobs.
      // Write-through must match that key format for cache hits.
      showStepNumbers: false,
      showNonRadialPoints: visibilitySettings.showNonRadialPoints ?? true,
      handPointVisibility: (visibilitySettings.handPointVisibility === "none"
        ? "active"
        : visibilitySettings.handPointVisibility ?? "all") as "all" | "active",
      showTKA: visibilitySettings.showTKA ?? true,
      showReversals: visibilitySettings.showReversals ?? true,
    };

    const previewKey = cellCacheKeyDeriver.deriveCacheKey(
      pictographData as PictographData,
      stepNumber,
      isDark,
      previewOptions
    );

    // Fire-and-forget — preview cache write is best-effort
    this.blobCache.set(previewKey, blob).catch(() => {});
  }

  /**
   * Render a single pictograph directly onto the canvas at the specified grid position
   * 🚀 PERF: Uses two-layer cache to avoid re-rendering identical pictographs
   *
   * Layer 1 (IndexedDB): Rasterized PNG blobs - persistent, instant image creation
   * Layer 2 (Memory): Sized HTMLImageElement - fast access, LRU eviction
   * Beat numbers are drawn as canvas text overlay after the base image
   *
   * Why blobs instead of SVG strings?
   * - SVG strings must be re-parsed and rasterized by the browser on every load
   * - Blobs are already rasterized, so creating images is instant (~10ms vs ~200ms)
   * - Benchmark showed SVG L1 cache had 0.1% speedup vs 91.9% for L2 memory cache
   *
   * @param bluePropType Optional explicit blue prop type override (passed to PictographPreparer to prevent race conditions)
   * @param redPropType Optional explicit red prop type override (passed to PictographPreparer to prevent race conditions)
   */
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
    redPropType?: PropType
  ): Promise<void> {
    try {
      // CRITICAL: Merge prop type overrides into visibility settings.
      // This ensures snapshotted prop types are passed through to PictographPreparer,
      // preventing race conditions where global settings could change during async rendering.
      const finalVisibilitySettings: PictographVisibilityOptions = {
        ...visibilitySettings,
        bluePropType: bluePropType ?? visibilitySettings?.bluePropType,
        redPropType: redPropType ?? visibilitySettings?.redPropType,
      };

      // 🧪 EXPERIMENTAL: Use compositional layer caching for visibility-resilient cache
      if (this.useCompositionalCaching && this.layerCompositor) {
        await this.renderPictographWithLayerCompositor(
          ctx,
          pictographData,
          column,
          row,
          stepSize,
          stepNumber,
          titleOffset,
          finalVisibilitySettings
        );
        return;
      }

      // 🚀 PERF: Generate base cache key (without beat number)
      const baseKey = this.keyHasher.deriveKey(pictographData, finalVisibilitySettings);

      // 🚀 PERF: L1 blob cache is size-specific (blobs are rasterized at specific size)
      const blobKey = `${baseKey}:${stepSize}`;

      // 🚀 PERF: Check Layer 2 (memory) first - same key as blob cache
      let img = this.memoryCache.get(blobKey);

      if (img) {
        // Layer 2 hit - use cached image directly
        this.layer2Hits++;
        this.compositionL2Hits++;
      } else {
        // Layer 2 miss - check Layer 1 (IndexedDB blob cache)
        this.layer2Misses++;

        const cachedBlob = await this.blobCache.get(blobKey);

        if (cachedBlob) {
          // Layer 1 hit - create image directly from blob (instant!)
          this.layer1Hits++;
          this.compositionL1Hits++;
          img = await this.blobToImage(cachedBlob);
        } else {
          // Layer 1 miss - render directly via Canvas 2D (faster than SVG parsing)
          this.layer1Misses++;
          this.compositionFreshRenders++;

          // Ensure Canvas 2D renderer is initialized (loads assets on first call)
          await this.ensureCanvas2DInitialized();

          // Render pictograph directly to canvas (base image only, no step number).
          // Step numbers are drawn as overlays on the export canvas at line ~655.
          const pictographCanvas = await this.canvas2DRenderer.renderPictograph(
            pictographData,
            {
              size: stepSize,
              visibility: finalVisibilitySettings,
              bluePropType: bluePropType,
              redPropType: redPropType,
            }
          );
          // Convert canvas to image for caching
          img = await this.canvasToImage(pictographCanvas);

          // Convert image to blob for L1 cache + preview write-through (async, non-blocking)
          this.imageToBlob(img).then((blob) => {
            this.blobCache.set(blobKey, blob).catch((err) => {
              console.warn("[ImageComposer] Failed to cache blob:", err);
            });
            // Write-through: also store under preview-compatible key so
            // PreviewCellRenderer finds it instantly when the user opens this sequence
            this.writeThroughToPreviewCache(
              pictographData, stepNumber, stepSize, finalVisibilitySettings, blob
            );
          });
        }

        // Store in Layer 2 (memory)
        this.memoryCache.set(blobKey, img);
      }

      // Draw base image onto the canvas at the correct position
      const x = column * stepSize;
      const y = row * stepSize + titleOffset;
      ctx.drawImage(img, x, y, stepSize, stepSize);

      // Draw beat number as text overlay (if provided)
      if (stepNumber !== undefined) {
        const isDarkMode = finalVisibilitySettings.darkMode ?? false;
        this.beatNumberRenderer.drawStepNumber(ctx, stepNumber, x, y, stepSize, isDarkMode);
      }
    } catch (error) {
      console.error(`❌ Failed to render beat at (${column}, ${row}):`, error);
      // Draw error placeholder
      const x = column * stepSize;
      const y = row * stepSize + titleOffset;
      ctx.fillStyle = "#ffeeee";
      ctx.fillRect(x + 5, y + 5, stepSize - 10, stepSize - 10);
      ctx.fillStyle = "#cc0000";
      ctx.font = "14px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Error", x + stepSize / 2, y + stepSize / 2);
    }
  }

  /**
   * Draw a duration badge in the bottom-right corner of a pictograph cell.
   * Matches the ChoreoCard .duration-badge overlay styling.
   * Only called for beats with non-default duration (not 1.0).
   */
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

    // Format: "1.67×" or "2×"
    const text = Number.isInteger(duration) ? `${duration}×` : `${duration}×`;

    const fontSize = 70 * scale;
    const paddingX = 40 * scale;
    const paddingY = 40 * scale;

    ctx.save();
    ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "end";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = isDarkMode
      ? "rgba(255, 255, 255, 0.55)"
      : "rgba(0, 0, 0, 0.55)";
    ctx.fillText(text, x + cellSize - paddingX, y + cellSize - paddingY);
    ctx.restore();
  }

  /**
   * 🚀 PERF: Get cache statistics for debugging/monitoring
   * Returns stats for both cache layers
   */
  getCacheStats() {
    const memoryStats = this.memoryCache.getStats();
    const totalHits = this.layer1Hits + this.layer2Hits;
    const totalMisses = this.layer1Misses + this.layer2Misses;

    return {
      // Layer 2 (Memory) stats
      memoryCacheSize: memoryStats.size,
      memoryCacheMaxEntries: memoryStats.maxEntries,
      layer2Hits: this.layer2Hits,
      layer2Misses: this.layer2Misses,
      layer2HitRate:
        this.layer2Hits + this.layer2Misses > 0
          ? ((this.layer2Hits / (this.layer2Hits + this.layer2Misses)) * 100).toFixed(2) + "%"
          : "0%",

      // Layer 1 (IndexedDB) stats
      layer1Hits: this.layer1Hits,
      layer1Misses: this.layer1Misses,
      layer1HitRate:
        this.layer1Hits + this.layer1Misses > 0
          ? ((this.layer1Hits / (this.layer1Hits + this.layer1Misses)) * 100).toFixed(2) + "%"
          : "0%",

      // Combined stats
      totalHits,
      totalMisses,
      overallHitRate:
        totalHits + totalMisses > 0
          ? ((totalHits / (totalHits + totalMisses)) * 100).toFixed(2) + "%"
          : "0%",
    };
  }

  /**
   * Get Layer 1 (IndexedDB) cache statistics
   * This is async because it queries IndexedDB
   */
  async getLayer1Stats() {
    return this.blobCache.getStats();
  }

  /**
   * 🚀 PERF: Clear all caches
   * @param includeIndexedDB If true, also clears the persistent IndexedDB cache
   */
  async clearCache(includeIndexedDB: boolean = false): Promise<void> {
    // Clear Layer 2 (memory)
    this.memoryCache.clear();

    // Optionally clear Layer 1 (IndexedDB)
    if (includeIndexedDB) {
      await this.blobCache.clear();
    }

    // Reset stats
    this.layer1Hits = 0;
    this.layer1Misses = 0;
    this.layer2Hits = 0;
    this.layer2Misses = 0;
  }

  /**
   * Draw cell borders only between occupied cells (smart grid)
   */
  private drawSmartCellBorders(
    ctx: CanvasRenderingContext2D,
    columns: number,
    rows: number,
    stepSize: number,
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>,
    titleOffset: number = 0,
    isDarkMode: boolean = false
  ): void {
    // Dark Mode uses subtle light borders on dark background
    ctx.strokeStyle = isDarkMode ? "rgba(255, 255, 255, 0.15)" : "#e0e0e0";
    ctx.lineWidth = 1;

    // Create a map of occupied cells
    const occupiedCells = this.getOccupiedCells(sequence, options, columns);

    // Helper function to check if a cell is occupied
    const isOccupied = (col: number, row: number): boolean => {
      return occupiedCells.has(`${col},${row}`);
    };

    // Draw vertical lines between horizontally adjacent occupied cells
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns - 1; col++) {
        if (isOccupied(col, row) && isOccupied(col + 1, row)) {
          const x = (col + 1) * stepSize;
          ctx.beginPath();
          ctx.moveTo(x, row * stepSize + titleOffset);
          ctx.lineTo(x, (row + 1) * stepSize + titleOffset);
          ctx.stroke();
        }
      }
    }

    // Draw horizontal lines between vertically adjacent occupied cells
    for (let col = 0; col < columns; col++) {
      for (let row = 0; row < rows - 1; row++) {
        if (isOccupied(col, row) && isOccupied(col, row + 1)) {
          const y = (row + 1) * stepSize + titleOffset;
          ctx.beginPath();
          ctx.moveTo(col * stepSize, y);
          ctx.lineTo((col + 1) * stepSize, y);
          ctx.stroke();
        }
      }
    }
  }

  /**
   * Get a set of occupied cell coordinates
   */
  private getOccupiedCells(
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>,
    columns: number
  ): Set<string> {
    const occupied = new Set<string>();

    // Add start position if included (either explicit or derivable from beat 1)
    const hasStartPositionToRender =
      options.includeStartPosition &&
      (sequence.startPosition || sequence.steps?.length > 0);
    if (hasStartPositionToRender) {
      occupied.add("0,0");
    }

    // Add all steps using the same positioning logic as rendering:
    // All rows start at startColumn (column 1 if start position exists, column 0 otherwise)
    const startColumn = options.includeStartPosition ? 1 : 0;
    const stepsPerRow = columns - startColumn;

    for (let i = 0; i < (sequence.steps.length || 0); i++) {
      const col = startColumn + (i % stepsPerRow);
      const row = Math.floor(i / stepsPerRow);
      occupied.add(`${col},${row}`);
    }

    return occupied;
  }

  /**
   * Find the best empty cell for placing a QR code.
   * Prefers bottom-left empty cells (under the start position column).
   *
   * @returns Cell coordinates {col, row} or null if no empty cells
   */
  private findEmptyCellForQR(
    columns: number,
    rows: number,
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>
  ): { col: number; row: number } | null {
    const occupiedCells = this.getOccupiedCells(sequence, options, columns);

    // Scan from bottom-left, preferring column 0 (under start position if present)
    // This places QR in the most natural empty spot
    for (let row = rows - 1; row >= 0; row--) {
      for (let col = 0; col < columns; col++) {
        if (!occupiedCells.has(`${col},${row}`)) {
          return { col, row };
        }
      }
    }

    return null; // No empty cells found
  }

  /**
   * Render a QR code into an empty cell on the canvas.
   * The QR code is sized to 80% of the cell size with padding.
   * @param bluePropType - Optional blue prop type to encode in the URL
   * @param redPropType - Optional red prop type to encode in the URL
   */
  private async renderQRCode(
    ctx: CanvasRenderingContext2D,
    sequence: SequenceData,
    cell: { col: number; row: number },
    stepSize: number,
    headerHeight: number,
    isDarkMode: boolean,
    bluePropType?: PropType,
    redPropType?: PropType
  ): Promise<void> {
    if (!this.qrCodeGenerator) {
      return;
    }

    try {
      // QR size is 80% of cell size for padding
      const qrSize = Math.floor(stepSize * 0.8);
      const padding = (stepSize - qrSize) / 2;

      // Generate QR code as image, including prop types if specified
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

      // Calculate position (center in cell)
      const x = cell.col * stepSize + padding;
      const y = cell.row * stepSize + headerHeight + padding;

      // Fill cell background — dark for dark mode, white for light mode
      ctx.fillStyle = isDarkMode ? "#000000" : "#ffffff";
      ctx.fillRect(
        cell.col * stepSize,
        cell.row * stepSize + headerHeight,
        stepSize,
        stepSize
      );

      // Draw the QR code
      ctx.drawImage(qrImage, x, y, qrSize, qrSize);
    } catch (error) {
      console.error("[ImageComposer] Failed to render QR code:", error);
      // Silently fail - QR is optional, sequence should still export
    }
  }

  /**
   * Convert SVG string to HTMLImageElement
   */
  private async svgStringToImage(svgString: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onerror = () => reject(new Error("Failed to load SVG as image"));

      // Convert SVG string to data URL
      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      img.src = url;

      // Clean up blob URL after image loads
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
    });
  }

  /**
   * 🚀 PERF: Convert HTMLCanvasElement to HTMLImageElement
   * Used for Canvas 2D direct rendering output
   */
  private async canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onerror = () => reject(new Error("Failed to convert canvas to image"));

      // Get data URL from canvas (already rasterized, so this is fast)
      const dataUrl = canvas.toDataURL("image/png");
      img.src = dataUrl;

      img.onload = () => {
        resolve(img);
      };
    });
  }

  /**
   * Convert SVG string to HTMLImageElement
   * This is the expensive operation (~300ms per pictograph) that we cache to avoid
   */
  private async svgToImage(svgString: string, size: number): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.width = size;
      img.height = size;

      img.onerror = () => reject(new Error("Failed to load SVG as image"));

      // Create blob from SVG string
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      img.src = url;

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
    });
  }

  /**
   * 🚀 PERF: Convert image Blob to HTMLImageElement (instant for rasterized blobs)
   * This is the key optimization - creating an image from a blob is much faster
   * than parsing and rasterizing an SVG string.
   */
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

  /**
   * 🚀 PERF: Convert HTMLImageElement to PNG Blob for L1 cache storage
   * Draws the image to a temporary canvas and exports as PNG.
   */
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

  // Stub methods to satisfy interface (not used in simple version)
  async composeFromCanvases(): Promise<HTMLCanvasElement> {
    throw new Error("Not implemented in simple version");
  }

  applyBackground(canvas: HTMLCanvasElement): HTMLCanvasElement {
    return canvas;
  }

  optimizeForExport(canvas: HTMLCanvasElement): HTMLCanvasElement {
    // Simple version doesn't need optimization
    return canvas;
  }

  /**
   * Calculate header height based on beat count and actual beat size
   * Header is at the top of the image
   *
   * Height is proportional to beat size for balanced layout:
   * - 1 beat: 1.0x beat size
   * - 2 steps: 1.0x beat size
   * - 3+ steps: 1.0x beat size (header equals one beat height)
   */
  private calculateHeaderHeight(stepCount: number, stepSize: number): number {
    if (stepCount === 0) {
      return 0;
    }

    // Header height = 1x beat size for balanced proportions
    // This ensures the header doesn't dominate the image
    return Math.floor(stepSize / 3);
  }

  /**
   * Calculate footer height for user info based on beat size
   * Footer is at the bottom of the image - proportional to beat size for consistency
   */
  private calculateFooterHeight(stepSize: number): number {
    // Footer height = 1/3 of beat size (same as header for balanced layout)
    return Math.floor(stepSize / 7);
  }

  /**
   * Apply prop type override to a beat or start position
   * Creates a shallow copy with prop type overridden in motion data
   *
   * Supports three modes:
   * 1. Single propType - applies to both colors
   * 2. Per-color (bluePropType/redPropType) - cat-dog mode
   * 3. Both - per-color overrides take precedence
   */
  private applyPropTypeOverride<
    T extends StepData | PictographData | StartPositionData,
  >(
    data: T,
    propType?: PropType,
    bluePropType?: PropType,
    redPropType?: PropType
  ): T {
    // Determine final prop types: per-color overrides take precedence
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

  /**
   * Calculate difficulty level from sequence steps
   * Uses the SequenceDifficultyCalculator to analyze turns and orientations
   */
  private getDifficultyLevel(sequence: SequenceData): number {
    // Use the difficulty calculator to analyze steps dynamically
    if (sequence.steps && sequence.steps.length > 0) {
      // Copy to mutable array for the calculator
      return this.difficultyCalculator.calculateDifficultyLevel([
        ...sequence.steps,
      ]);
    }

    // Fallback to stored level if no steps
    if (typeof sequence.level === "number" && sequence.level > 0) {
      return sequence.level;
    }

    // Default fallback
    return 1;
  }

  /**
   * 🧪 EXPERIMENTAL: Render using LayerCompositor for visibility-resilient caching
   *
   * This method uses compositional caching where:
   * - Base layer (grid + props + arrows) is cached separately from overlays
   * - TKA and reversal overlays are cached independently
   * - Visibility toggles only require re-compositing, not re-rendering
   *
   * Expected improvement: ~15,000x faster when toggling visibility settings
   */
  private async renderPictographWithLayerCompositor(
    ctx: CanvasRenderingContext2D,
    pictographData: StepData | PictographData,
    column: number,
    row: number,
    stepSize: number,
    stepNumber: number | undefined,
    titleOffset: number,
    visibilitySettings: PictographVisibilityOptions
  ): Promise<void> {
    if (!this.layerCompositor) {
      throw new Error("LayerCompositor not available");
    }

    // Ensure pictograph has prepared data
    await this.ensureCanvas2DInitialized();

    // Get prepared pictograph data - use direct singleton import
    const themeMode = visibilitySettings.darkMode ? "dark" : "light";
    const preparedPictograph = await pictographPreparer.prepareSingle(pictographData, {
      themeMode,
      bluePropType: visibilitySettings.bluePropType,
      redPropType: visibilitySettings.redPropType,
    });

    // Build layer render options
    // Convert handPointVisibility: LayerRenderOptions doesn't support "none", map it to "active"
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

    // Build layer visibility
    const layerVisibility = {
      showTKA: visibilitySettings.showTKA ?? true,
      showReversals: visibilitySettings.showReversals ?? true,
    };

    // Compose using LayerCompositor
    const result = await this.layerCompositor.compose(
      preparedPictograph as unknown as import("../../../pictograph/shared/domain/models/PreparedPictographData").PreparedPictographData,
      layerOptions,
      layerVisibility,
      stepNumber
    );

    // Track stats
    if (result.cacheStats.baseFromCache) {
      this.compositionL2Hits++;
      this.layer2Hits++;
    } else {
      this.compositionFreshRenders++;
      this.layer1Misses++;
    }

    // Draw composited result onto the main canvas
    const x = column * stepSize;
    const y = row * stepSize + titleOffset;
    ctx.drawImage(result.canvas, x, y, stepSize, stepSize);

    // NOTE: No write-through to preview cache from the LayerCompositor path.
    // The composited canvas includes the step number drawn on it. Writing that
    // blob under a "nonum" preview key would contaminate the preview cache —
    // the shared ChoreoCard would find a blob with the wrong step number baked
    // in and also render an HTML overlay, causing doubled/ghost numbers.
    // The Canvas2D path's write-through is clean (base image only, no step number).
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
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
