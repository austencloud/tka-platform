/**
 * Canvas 2D Node Renderer
 *
 * Node.js-compatible version of Canvas2DDirectRenderer.
 * Uses dependency injection instead of global container.
 * Works with both browser Canvas and node-canvas.
 *
 * Key differences from Canvas2DDirectRenderer:
 * - Accepts canvas factory function (createCanvas)
 * - Accepts optional IPictographPreparer
 * - No dependency on global DI container
 * - No browser-specific globals
 */

import type {
  IDirectRenderer,
  DirectRenderOptions,
  RenderTiming,
} from "../contracts/IDirectRenderer";
import type { PictographData } from "../../../pictograph/shared/domain/models/PictographData";
import type { StepData } from "../../../../features/create/shared/domain/models/StepData";
import type { PreparedPictographData } from "../../../pictograph/shared/domain/models/PreparedPictographData";
import type { IPictographPreparer } from "../../../pictograph/shared/services/contracts/IPictographPreparer";
import { GridMode } from "../../../pictograph/grid/domain/enums/grid-enums";
import { getSvgImageCache } from "./SvgImageCache";
import { getSvgAssetLoader } from "./SvgAssetLoader";
import { getLetterImagePath, isDashLetter } from "../../../pictograph/tka-glyph/utils/letter-image-getter";
import type { Letter } from "../../../foundation/domain/models/Letter";
import {
  parseTurnsTuple,
  shouldDisplayTurn,
  getTurnNumberImagePath,
  getTurnNumberWidth,
} from "../../../pictograph/tka-glyph/utils/turn-tuple-parser";
import { TurnColorInterpreter } from "../../../pictograph/tka-glyph/services/implementations/TurnColorInterpreter";
import { calculateTurnPositions } from "../../../pictograph/tka-glyph/utils/turn-position-calculator";

// Constants matching the SVG system
const VIEWBOX_SIZE = 950;
const SVG_OVERFLOW_RATIO = 0.15;

// TKA Glyph positioning
const TKA_GLYPH_X = 50;
const TKA_GLYPH_Y = 800;
const TKA_GLYPH_SCALE = 1;

// Beat number positioning
const STEP_NUMBER_X = 50;
const STEP_NUMBER_Y = 50;
const BEAT_NUMBER_FONT_SIZE = 100;
const BEAT_NUMBER_START_FONT_SIZE = 80;

// Direction dot constants
const DOT_PADDING = 10;
const DOT_SIZE = 25;

// Turn number height
const TURN_NUMBER_HEIGHT = 45;

// Colors
const BLUE_COLOR = "#2E77AE";
const RED_COLOR = "#ED1C24";

// Base grid points
const BASE_GRID_POINTS = {
  center: { x: 475, y: 475, r: 12 },
  outer: {
    n: { x: 475, y: 175, r: 25 },
    e: { x: 775, y: 475, r: 25 },
    s: { x: 475, y: 775, r: 25 },
    w: { x: 175, y: 475, r: 25 },
  },
};

const GRID_POINT_COLOR_LIGHT = "#000000";
const GRID_POINT_COLOR_DARK = "#ffffff";

/**
 * Canvas factory function type - abstracts browser vs Node.js canvas creation
 */
export type CanvasFactory = () => HTMLCanvasElement | any;

/**
 * Configuration for Node renderer
 */
export interface NodeRendererConfig {
  /**
   * Canvas factory function
   * Browser: () => document.createElement('canvas')
   * Node.js: () => createCanvas()
   */
  createCanvas: CanvasFactory;

  /**
   * Optional pictograph preparer
   * If not provided, renderer will work without arrow/prop rendering
   */
  preparer?: IPictographPreparer;
}

export class Canvas2DNodeRenderer implements IDirectRenderer {
  private initialized = false;
  private memoryUsage = 0;
  private turnColorInterpreter = new TurnColorInterpreter();
  private createCanvas: CanvasFactory;
  private preparer?: IPictographPreparer;

  constructor(config: NodeRendererConfig) {
    this.createCanvas = config.createCanvas;
    this.preparer = config.preparer;
  }

  getName(): string {
    return "canvas2d-node";
  }

  isSupported(): boolean {
    try {
      const canvas = this.createCanvas();
      return !!canvas.getContext("2d");
    } catch {
      return false;
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize the asset loader (pre-loads grids)
    const assetLoader = getSvgAssetLoader();
    await assetLoader.initialize();

    this.initialized = true;
    console.log("[Canvas2DNode] Initialized with SVG assets");
  }

  async renderPictograph(
    pictograph: PictographData | StepData,
    options: DirectRenderOptions
  ): Promise<HTMLCanvasElement> {
    const { canvas } = await this.renderPictographWithTiming(pictograph, options);
    return canvas;
  }

  async renderPictographWithTiming(
    pictograph: PictographData | StepData,
    options: DirectRenderOptions
  ): Promise<{ canvas: HTMLCanvasElement; timing: RenderTiming }> {
    const timing: RenderTiming = {
      totalMs: 0,
      setupMs: 0,
      drawMs: 0,
      finalizeMs: 0,
    };

    const totalStart = performance.now();

    // Setup canvas at requested size
    const setupStart = performance.now();
    const canvas = this.createCanvas();
    canvas.width = options.size;
    canvas.height = options.size;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }
    timing.setupMs = performance.now() - setupStart;

    // Draw all elements
    const drawStart = performance.now();
    await this.drawPictograph(ctx, pictograph as PreparedPictographData, options);
    timing.drawMs = performance.now() - drawStart;

    timing.finalizeMs = 0;
    timing.totalMs = performance.now() - totalStart;

    return { canvas, timing };
  }

  /**
   * Ensure pictograph has prepared data, calling PictographPreparer if available
   */
  private async ensurePrepared(
    pictograph: PictographData | StepData,
    options: DirectRenderOptions
  ): Promise<PreparedPictographData> {
    const asPrepared = pictograph as PreparedPictographData;

    // If already prepared, return as-is
    if (asPrepared._prepared) {
      return asPrepared;
    }

    // Try to prepare using injected preparer
    if (this.preparer) {
      try {
        const prepared = await this.preparer.prepareSingle(pictograph, {
          themeMode: options.visibility.darkMode ? "dark" : "light",
          bluePropType: options.visibility.bluePropType,
          redPropType: options.visibility.redPropType,
        });
        return prepared;
      } catch (error) {
        console.warn("[Canvas2DNode] Failed to prepare pictograph:", error);
      }
    }

    // No preparer available or preparation failed - return unprepared
    // This means arrows/props won't render, but grid and text will
    return asPrepared;
  }

  /**
   * Main drawing function - renders all pictograph elements in EXACT SVG order
   */
  private async drawPictograph(
    ctx: CanvasRenderingContext2D,
    pictograph: PreparedPictographData,
    options: DirectRenderOptions
  ): Promise<void> {
    const totalStart = performance.now();
    const { size, visibility } = options;
    const isDarkMode = visibility.darkMode ?? true;
    const scale = size / VIEWBOX_SIZE;

    // Ensure the pictograph has prepared data
    const prepareStart = performance.now();
    const preparedPictograph = await this.ensurePrepared(pictograph, options);
    const prepared = preparedPictograph._prepared;
    const prepareTime = performance.now() - prepareStart;

    // 1. Draw background
    ctx.fillStyle = isDarkMode ? "#0a0a0f" : "#ffffff";
    ctx.fillRect(0, 0, size, size);

    // 2. Draw grid
    const gridStart = performance.now();
    const gridMode = prepared?.gridMode ?? GridMode.DIAMOND;
    if (visibility.baseGridOnly) {
      this.drawBaseGridOnly(ctx, size, isDarkMode);
    } else {
      await this.drawGrid(ctx, size, gridMode, isDarkMode, visibility.showNonRadialPoints ?? false);
    }
    const gridTime = performance.now() - gridStart;

    // 3. Draw props (if prepared data exists)
    let propsTime = 0;
    if (prepared) {
      const propsStart = performance.now();
      await this.drawProps(ctx, prepared, size, preparedPictograph, options);
      propsTime = performance.now() - propsStart;
    }

    // 4. Draw arrows (if prepared data exists)
    let arrowsTime = 0;
    if (prepared) {
      const arrowsStart = performance.now();
      await this.drawArrows(ctx, prepared, size);
      arrowsTime = performance.now() - arrowsStart;
    }

    // 5. Draw TKA glyph (letter)
    let letterDimensions = { width: 100, height: 100 };
    let glyphTime = 0;
    if (visibility.showTKA && preparedPictograph.letter) {
      const glyphStart = performance.now();
      letterDimensions = await this.drawTKAGlyph(
        ctx,
        preparedPictograph.letter as Letter,
        size,
        isDarkMode
      );
      glyphTime = performance.now() - glyphStart;
    }

    // 6. Draw turn numbers (TurnsColumn)
    if (visibility.showTKA && preparedPictograph.motions) {
      await this.drawTurnsColumn(ctx, preparedPictograph, letterDimensions, scale, isDarkMode);
    }

    // 7. Draw direction dot
    if (visibility.showTKA && preparedPictograph.letter && preparedPictograph.motions) {
      this.drawDirectionDot(ctx, preparedPictograph, letterDimensions, scale, isDarkMode);
    }

    // 8. Draw beat number
    const stepData = preparedPictograph as StepData;
    if (typeof stepData.stepNumber === "number") {
      this.drawStepNumber(ctx, stepData.stepNumber, scale, isDarkMode);
    }

    // 9. Draw reversal indicators
    if (visibility.showReversals && this.isStepData(preparedPictograph)) {
      this.drawReversalIndicators(ctx, preparedPictograph as StepData, size);
    }

    // Log timing breakdown for slow renders
    const totalTime = performance.now() - totalStart;
    if (totalTime > 50) {
      console.log(
        `[Canvas2DNode] Slow render ${totalTime.toFixed(0)}ms: ` +
        `prepare=${prepareTime.toFixed(0)}ms, grid=${gridTime.toFixed(0)}ms, ` +
        `props=${propsTime.toFixed(0)}ms, arrows=${arrowsTime.toFixed(0)}ms, glyph=${glyphTime.toFixed(0)}ms`
      );
    }
  }

  // ... (rest of the implementation would be copied from Canvas2DDirectRenderer)
  // For now, let me add stub methods to make it compile

  private drawBaseGridOnly(ctx: CanvasRenderingContext2D, size: number, isDarkMode: boolean): void {
    // TODO: Copy from Canvas2DDirectRenderer
  }

  private async drawGrid(
    ctx: CanvasRenderingContext2D,
    size: number,
    gridMode: GridMode,
    isDarkMode: boolean,
    showNonRadial: boolean
  ): Promise<void> {
    // TODO: Copy from Canvas2DDirectRenderer
  }

  private async drawProps(
    ctx: CanvasRenderingContext2D,
    prepared: any,
    size: number,
    pictograph: PreparedPictographData,
    options: DirectRenderOptions
  ): Promise<void> {
    // TODO: Copy from Canvas2DDirectRenderer
  }

  private async drawArrows(ctx: CanvasRenderingContext2D, prepared: any, size: number): Promise<void> {
    // TODO: Copy from Canvas2DDirectRenderer
  }

  private async drawTKAGlyph(
    ctx: CanvasRenderingContext2D,
    letter: Letter,
    size: number,
    isDarkMode: boolean
  ): Promise<{ width: number; height: number }> {
    // TODO: Copy from Canvas2DDirectRenderer
    return { width: 100, height: 100 };
  }

  private async drawTurnsColumn(
    ctx: CanvasRenderingContext2D,
    pictograph: PreparedPictographData,
    letterDimensions: { width: number; height: number },
    scale: number,
    isDarkMode: boolean
  ): Promise<void> {
    // TODO: Copy from Canvas2DDirectRenderer
  }

  private drawDirectionDot(
    ctx: CanvasRenderingContext2D,
    pictograph: PreparedPictographData,
    letterDimensions: { width: number; height: number },
    scale: number,
    isDarkMode: boolean
  ): void {
    // TODO: Copy from Canvas2DDirectRenderer
  }

  private drawStepNumber(
    ctx: CanvasRenderingContext2D,
    stepNumber: number,
    scale: number,
    isDarkMode: boolean
  ): void {
    // TODO: Copy from Canvas2DDirectRenderer
  }

  private drawReversalIndicators(ctx: CanvasRenderingContext2D, beat: StepData, size: number): void {
    // TODO: Copy from Canvas2DDirectRenderer
  }

  private isStepData(pictograph: any): pictograph is StepData {
    return typeof (pictograph as StepData).stepNumber === "number";
  }

  getMemoryUsage(): number {
    return this.memoryUsage;
  }

  clearCache(): void {
    // No-op for now
  }
}
