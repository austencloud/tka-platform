/**
 * Simple Image Composition Service
 *
 * Dead-simple approach: Render pictographs directly onto a single canvas.
 * No intermediate canvases, no complex calculations, just straightforward rendering.
 */

import type { BeatData } from "../../../../features/create/shared/domain/models/BeatData";
import type { StartPositionData } from "../../../../features/create/shared/domain/models/StartPositionData";
import type { PictographData } from "../../../pictograph/shared/domain/models/PictographData";
import type { SequenceData } from "../../../foundation/domain/models/SequenceData";
import type { PropType } from "../../../pictograph/prop/domain/enums/PropType";
import { TYPES } from "../../../inversify/types";
import { inject, injectable } from "inversify";
import {
  renderPictographToSVG,
  type PictographVisibilityOptions,
} from "../../utils/pictograph-to-svg";
import { simplifyRepeatedWord } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";
import { getVisibilityStateManager } from "../../../pictograph/shared/state/visibility-state.svelte";
import { getAnimationVisibilityManager } from "../../../animation-engine/state/animation-visibility-state.svelte";

import { SequenceDifficultyCalculator } from "$lib/features/discover/gallery/display/services/implementations/SequenceDifficultyCalculator";
import type { SequenceExportOptions } from "../../domain/models/SequenceExportOptions";
import type { IDimensionCalculator } from "../contracts/IDimensionCalculator";
import type {
  CompositionProgressCallback,
  IImageComposer,
} from "../contracts/IImageComposer";
import type { ILayoutCalculator } from "../contracts/ILayoutCalculator";
import type { ITextRenderer } from "../contracts/ITextRenderer";

// HMR-aware cache: Store cache in module scope so HMR can invalidate it
// Without this, cached images from before code changes would persist
const globalImageCache = new Map<string, HTMLImageElement>();

// HMR: Clear cache when this module reloads (code changes in GridSvg, etc.)
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    console.log("🔥 ImageComposer HMR: Clearing image cache");
    globalImageCache.clear();
  });
  // Also clear on dispose
  import.meta.hot.dispose(() => {
    globalImageCache.clear();
  });
}

@injectable()
export class ImageComposer implements IImageComposer {
  // Create instance directly to avoid DI module loading order issues
  private readonly difficultyCalculator = new SequenceDifficultyCalculator();

  // 🚀 PERF: Cache rendered pictograph images to avoid re-rendering identical pictographs
  // Key: hash of pictograph data + size + beatNumber
  // Value: rendered HTMLImageElement ready for canvas drawing
  // Uses module-scoped cache for HMR awareness
  private get renderedImageCache() {
    return globalImageCache;
  }
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    @inject(TYPES.ILayoutCalculator)
    private readonly layoutService: ILayoutCalculator,
    @inject(TYPES.ITextRenderer)
    private readonly TextRenderer: ITextRenderer,
    @inject(TYPES.IDimensionCalculator)
    private readonly DimensionCalculator: IDimensionCalculator
  ) {}
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
    if (
      overrides?.showTKA !== undefined &&
      overrides.showVTG !== undefined &&
      overrides.showElemental !== undefined &&
      overrides.showPositions !== undefined &&
      overrides.showReversals !== undefined &&
      overrides.showNonRadialPoints !== undefined
    ) {
      return {
        showTKA: overrides.showTKA, // TKA Glyph includes turn numbers
        showVTG: overrides.showVTG,
        showElemental: overrides.showElemental,
        showPositions: overrides.showPositions,
        showReversals: overrides.showReversals,
        showNonRadialPoints: overrides.showNonRadialPoints,
        darkMode: overrides.darkMode,
      };
    }

    // Get global settings as base
    const visibilityManager = getVisibilityStateManager();
    await visibilityManager.ensureSettingsLoaded();

    // Get animation visibility for Dark Mode settings
    const animVisibilityManager = getAnimationVisibilityManager();

    const globalSettings: PictographVisibilityOptions = {
      showTKA: visibilityManager.getGlyphVisibility("tkaGlyph"), // TKA Glyph includes turn numbers
      showVTG: visibilityManager.getGlyphVisibility("vtgGlyph"),
      showElemental: visibilityManager.getGlyphVisibility("elementalGlyph"),
      showPositions: visibilityManager.getGlyphVisibility("positionsGlyph"),
      showReversals: visibilityManager.getGlyphVisibility("reversalIndicators"),
      showNonRadialPoints: visibilityManager.getNonRadialVisibility(),
      darkMode: animVisibilityManager.isDarkMode(),
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
    options: SequenceExportOptions,
    onProgress?: CompositionProgressCallback
  ): Promise<HTMLCanvasElement> {
    if (!sequence.beats || sequence.beats.length === 0) {
      throw new Error("Sequence must have at least one beat");
    }

    // Get visibility settings ONCE at the start of composition
    // Uses explicit overrides from options if provided, otherwise falls back to global settings
    // NOTE: await ensures settings are loaded from persistence before reading (when no overrides)
    const visibilitySettings = await this.getVisibilitySettings(
      options.visibilityOverrides
    );

    // Step 1: Calculate layout using LayoutCalculator
    // This service has the proper lookup tables matching the desktop application
    const beatCount = sequence.beats.length;
    const [columns, rows] = this.layoutService.calculateLayout(
      beatCount,
      options.includeStartPosition
    );

    // Step 2: Calculate canvas dimensions including title space
    // Scale beatSize by beatScale to maintain proportions between grid and title areas
    const baseBeatSize = options.beatSize || 120;
    const beatSize = Math.floor(baseBeatSize * (options.beatScale || 1));
    const canvasWidth = columns * beatSize;

    // Derive word from beat letters if sequence.word is empty
    // This ensures the word displays even when built dynamically in the create module
    const rawWord =
      sequence.word ||
      sequence.beats
        .filter((beat) => beat.letter)
        .map((beat) => beat.letter)
        .join("");

    // Simplify repeated patterns (e.g., "ABCABCABC" → "ABC")
    // Does NOT truncate - allows full word length when needed for uniqueness
    const derivedWord = simplifyRepeatedWord(rawWord);

    // Calculate header height if word OR difficulty should be included
    // Header is at the TOP of the image - proportional to beat size for balanced layout
    // Show header when either word or difficulty level is enabled
    // (Will be recalculated with custom name logic later)
    const showHeaderForLayout = (options.addWord && (derivedWord || options.customName)) || options.addDifficultyLevel;
    const headerHeight = showHeaderForLayout
        ? this.calculateHeaderHeight(beatCount, beatSize)
        : 0;

    console.log(
      `📐 Layout: beatSize=${beatSize}, headerHeight=${headerHeight}, rows=${rows}, cols=${columns}`
    );

    // Calculate footer height if user info should be included
    // Check granular flags if provided, otherwise use addUserInfo for backwards compatibility
    const showCreatorName = options.showCreatorName ?? options.addUserInfo;
    const showNotes = options.showNotes ?? options.addUserInfo;
    const showBirthday = options.showBirthday ?? options.addUserInfo;
    const hasAnyFooterContent = showCreatorName || showNotes || showBirthday;
    const footerHeight = hasAnyFooterContent
      ? this.calculateFooterHeight(beatSize)
      : 0;

    const canvasHeight = rows * beatSize + headerHeight + footerHeight;

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
    ctx.fillRect(0, headerHeight, canvasWidth, rows * beatSize);

    // Calculate total items to render for progress tracking
    const hasStartPosition =
      options.includeStartPosition && sequence.startPosition;
    const totalItems = sequence.beats.length + (hasStartPosition ? 1 : 0);
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
    if (hasStartPosition && sequence.startPosition) {
      // Only pass beat number 0 if addBeatNumbers is true (shows "Start" text)
      const startBeatNumber = options.addBeatNumbers ? 0 : undefined;
      const startPositionData = hasPropOverride
        ? this.applyPropTypeOverride(
            sequence.startPosition,
            options.propTypeOverride,
            options.bluePropTypeOverride,
            options.redPropTypeOverride
          )
        : sequence.startPosition;
      await this.renderPictographAt(
        ctx,
        startPositionData,
        0,
        0,
        beatSize,
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

    // Step 5: Render all beats in the grid
    // Calculate how many beats per row based on the layout
    const startColumn = options.includeStartPosition ? 1 : 0;
    const beatsPerRow = columns - startColumn; // Available columns for beats

    for (let i = 0; i < sequence.beats.length; i++) {
      const beat = sequence.beats[i];
      if (!beat) continue; // Skip if beat is undefined
      // Calculate position: beats fill remaining columns, then wrap to next row
      // All rows start at startColumn (column 1 if start position exists, column 0 otherwise)
      const col = startColumn + (i % beatsPerRow);
      const row = Math.floor(i / beatsPerRow);
      // Only pass beat number if addBeatNumbers is true
      const beatNumber = options.addBeatNumbers ? i + 1 : undefined;
      // Apply prop type override if provided (supports single or per-color overrides)
      const beatData = hasPropOverride
        ? this.applyPropTypeOverride(
            beat,
            options.propTypeOverride,
            options.bluePropTypeOverride,
            options.redPropTypeOverride
          )
        : beat;
      await this.renderPictographAt(
        ctx,
        beatData,
        col,
        row,
        beatSize,
        beatNumber,
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

    // Step 6: Draw cell borders only between occupied cells
    this.drawSmartCellBorders(
      ctx,
      columns,
      rows,
      beatSize,
      sequence,
      options,
      headerHeight, // Offset grid below header
      isDarkMode
    );

    // Step 7: Render header with word at the top
    // The header has a level badge indicator (only if addDifficultyLevel is true)
    // Show header when either word or difficulty is enabled
    const showHeader = (options.addWord && (derivedWord || options.customName)) || options.addDifficultyLevel;
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
          beatScale: options.beatScale || 1,
        },
        headerHeight,
        difficultyLevel,
        options.addDifficultyLevel, // Only show badge if toggle is on
        isDarkMode // Dark Mode for dark theme styling
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
        },
        {
          margin: options.margin || 10,
          beatScale: options.beatScale || 1,
        },
        footerHeight, // Pass footer height for proper text positioning
        beatCount, // Pass beat count for legacy-matching font sizing
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

    return canvas;
  }

  /**
   * Render a single pictograph directly onto the canvas at the specified grid position
   * 🚀 PERF: Uses cache to avoid re-rendering identical pictographs
   *
   * @param bluePropType Optional explicit blue prop type override (passed to PictographPreparer to prevent race conditions)
   * @param redPropType Optional explicit red prop type override (passed to PictographPreparer to prevent race conditions)
   */
  private async renderPictographAt(
    ctx: CanvasRenderingContext2D,
    pictographData: BeatData | PictographData,
    column: number,
    row: number,
    beatSize: number,
    beatNumber?: number,
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

      // 🚀 PERF: Generate cache key and check cache first
      // Include visibility settings in cache key for correct caching
      const cacheKey = this.generatePictographCacheKey(
        pictographData,
        beatSize,
        beatNumber,
        finalVisibilitySettings
      );

      let img = this.renderedImageCache.get(cacheKey);

      if (img) {
        // Cache hit - use cached image directly (skip SVG rendering!)
        this.cacheHits++;
      } else {
        // Cache miss - render SVG and cache the result
        this.cacheMisses++;

        // Generate SVG with beat number and visibility settings (including prop type overrides)
        const svgString = await renderPictographToSVG(
          pictographData,
          beatSize,
          beatNumber,
          finalVisibilitySettings
        );

        // Convert SVG to image
        img = await this.svgStringToImage(svgString);

        // Store in cache for future use
        this.renderedImageCache.set(cacheKey, img);
      }

      // Draw directly onto the canvas at the correct position (offset by title)
      const x = column * beatSize;
      const y = row * beatSize + titleOffset;

      ctx.drawImage(img, x, y, beatSize, beatSize);
    } catch (error) {
      console.error(`❌ Failed to render beat at (${column}, ${row}):`, error);
      // Draw error placeholder
      const x = column * beatSize;
      const y = row * beatSize;
      ctx.fillStyle = "#ffeeee";
      ctx.fillRect(x + 5, y + 5, beatSize - 10, beatSize - 10);
      ctx.fillStyle = "#cc0000";
      ctx.font = "14px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Error", x + beatSize / 2, y + beatSize / 2);
    }
  }

  /**
   * 🚀 PERF: Generate a unique cache key for a pictograph based on its visual content
   * This allows identical pictographs to be rendered once and reused
   */
  private generatePictographCacheKey(
    data: BeatData | PictographData,
    beatSize: number,
    beatNumber?: number,
    visibilitySettings?: PictographVisibilityOptions
  ): string {
    // Extract the key visual properties that affect rendering
    const keyParts: string[] = [];

    // Size and beat number affect layout
    keyParts.push(`size:${beatSize}`);
    keyParts.push(`beat:${beatNumber ?? "none"}`);

    // Letter/glyph
    keyParts.push(`letter:${data.letter ?? "none"}`);

    // Blue motion data (including propType and gridMode which affect rendering)
    if (data.motions.blue) {
      const blue = data.motions.blue;
      keyParts.push(
        `blue:${blue.motionType ?? ""}|${blue.startLocation ?? ""}|${blue.endLocation ?? ""}|${blue.turns ?? 0}|${blue.startOrientation ?? ""}|${blue.endOrientation ?? ""}|${blue.rotationDirection ?? ""}|${blue.propType ?? "staff"}|${blue.gridMode ?? "diamond"}`
      );
    } else {
      keyParts.push("blue:none");
    }

    // Red motion data (including propType and gridMode which affect rendering)
    if (data.motions.red) {
      const red = data.motions.red;
      keyParts.push(
        `red:${red.motionType ?? ""}|${red.startLocation ?? ""}|${red.endLocation ?? ""}|${red.turns ?? 0}|${red.startOrientation ?? ""}|${red.endOrientation ?? ""}|${red.rotationDirection ?? ""}|${red.propType ?? "staff"}|${red.gridMode ?? "diamond"}`
      );
    } else {
      keyParts.push("red:none");
    }

    // Include visibility settings in cache key (important for correct caching!)
    if (visibilitySettings) {
      keyParts.push(
        `vis:${visibilitySettings.showTKA ?? "d"}|${visibilitySettings.showVTG ?? "d"}|${visibilitySettings.showElemental ?? "d"}|${visibilitySettings.showPositions ?? "d"}|${visibilitySettings.showReversals ?? "d"}|${visibilitySettings.showNonRadialPoints ?? "d"}|darkMode:${visibilitySettings.darkMode ?? false}|blueProp:${visibilitySettings.bluePropType ?? "d"}|redProp:${visibilitySettings.redPropType ?? "d"}`
      );
    }

    return keyParts.join(":");
  }

  /**
   * 🚀 PERF: Get cache statistics for debugging/monitoring
   */
  getCacheStats() {
    return {
      cacheSize: this.renderedImageCache.size,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate:
        this.cacheHits + this.cacheMisses > 0
          ? (
              (this.cacheHits / (this.cacheHits + this.cacheMisses)) *
              100
            ).toFixed(2) + "%"
          : "0%",
    };
  }

  /**
   * 🚀 PERF: Clear the rendered image cache (useful for memory management)
   */
  clearCache(): void {
    this.renderedImageCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Draw cell borders only between occupied cells (smart grid)
   */
  private drawSmartCellBorders(
    ctx: CanvasRenderingContext2D,
    columns: number,
    rows: number,
    beatSize: number,
    sequence: SequenceData,
    options: SequenceExportOptions,
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
          const x = (col + 1) * beatSize;
          ctx.beginPath();
          ctx.moveTo(x, row * beatSize + titleOffset);
          ctx.lineTo(x, (row + 1) * beatSize + titleOffset);
          ctx.stroke();
        }
      }
    }

    // Draw horizontal lines between vertically adjacent occupied cells
    for (let col = 0; col < columns; col++) {
      for (let row = 0; row < rows - 1; row++) {
        if (isOccupied(col, row) && isOccupied(col, row + 1)) {
          const y = (row + 1) * beatSize + titleOffset;
          ctx.beginPath();
          ctx.moveTo(col * beatSize, y);
          ctx.lineTo((col + 1) * beatSize, y);
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
    options: SequenceExportOptions,
    columns: number
  ): Set<string> {
    const occupied = new Set<string>();

    // Add start position if included
    if (options.includeStartPosition && sequence.startPosition) {
      occupied.add("0,0");
    }

    // Add all beats using the same positioning logic as rendering:
    // All rows start at startColumn (column 1 if start position exists, column 0 otherwise)
    const startColumn = options.includeStartPosition ? 1 : 0;
    const beatsPerRow = columns - startColumn;

    for (let i = 0; i < (sequence.beats.length || 0); i++) {
      const col = startColumn + (i % beatsPerRow);
      const row = Math.floor(i / beatsPerRow);
      occupied.add(`${col},${row}`);
    }

    return occupied;
  }

  /**
   * Convert SVG string to HTMLImageElement
   */
  private async svgStringToImage(svgString: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
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
   * - 2 beats: 1.0x beat size
   * - 3+ beats: 1.0x beat size (header equals one beat height)
   */
  private calculateHeaderHeight(beatCount: number, beatSize: number): number {
    if (beatCount === 0) {
      return 0;
    }

    // Header height = 1x beat size for balanced proportions
    // This ensures the header doesn't dominate the image
    return Math.floor(beatSize / 3);
  }

  /**
   * Calculate footer height for user info based on beat size
   * Footer is at the bottom of the image - proportional to beat size for consistency
   */
  private calculateFooterHeight(beatSize: number): number {
    // Footer height = 1/3 of beat size (same as header for balanced layout)
    return Math.floor(beatSize / 7);
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
    T extends BeatData | PictographData | StartPositionData,
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
   * Calculate difficulty level from sequence beats
   * Uses the SequenceDifficultyCalculator to analyze turns and orientations
   */
  private getDifficultyLevel(sequence: SequenceData): number {
    // Use the difficulty calculator to analyze beats dynamically
    if (sequence.beats && sequence.beats.length > 0) {
      // Copy to mutable array for the calculator
      return this.difficultyCalculator.calculateDifficultyLevel([
        ...sequence.beats,
      ]);
    }

    // Fallback to stored level if no beats
    if (typeof sequence.level === "number" && sequence.level > 0) {
      return sequence.level;
    }

    // Default fallback
    return 1;
  }
}
