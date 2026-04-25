/**
 * Canvas 2D Direct Renderer
 *
 * Renders pictographs directly to Canvas 2D using the EXACT same data
 * and transforms as the SVG system. This ensures pixel-perfect parity.
 *
 * ============================================================================
 * IMPORTANT GOTCHAS (learned the hard way - read before modifying!)
 * ============================================================================
 *
 * 1. ARROW CLIPPING (SVG overflow:visible vs Canvas clipping)
 *    - SVG elements have overflow:visible by default, allowing arrow tips to
 *      extend beyond their viewBox
 *    - Canvas clips EVERYTHING at its boundaries - no exceptions
 *    - SOLUTION: Expand the viewBox when wrapping SVG content for arrows
 *      (see wrapSvgContent with expandViewBox=true). We add 15% padding in all
 *      directions and translate the content to center it in the expanded space.
 *    - The center point must be adjusted by the expansion offset!
 *
 * 2. PROP MIRRORING (not all red props are mirrored!)
 *    - Only red HAND props should be mirrored (anatomical left/right hands)
 *    - Staff, fan, and other symmetric props should NOT be mirrored
 *    - See shouldMirrorProp() - check the actual prop type, not just the color
 *    - PropSvg.svelte has complex logic including buugeng flip preferences
 *
 * 3. GRID BRIGHTNESS (black SVG needs inversion for dark mode)
 *    - Grid SVG files are black on transparent background
 *    - For dark mode, we need invert(1) to make them white
 *    - GridSvg.svelte renders at #d0d0d0 (light gray) - we use opacity(0.85)
 *      after inversion to match
 *
 * 4. SVG INNER CONTENT (imageSrc is not a complete SVG!)
 *    - PictographPreparer returns imageSrc as INNER SVG content (paths, groups)
 *    - This content is meant to be injected inside an existing <svg> element
 *    - We must wrap it with a proper <svg> element before converting to image
 *    - See wrapSvgContent() - it adds xmlns, viewBox, width, height
 *
 * ============================================================================
 * RENDER ORDER (matching SVG system)
 * ============================================================================
 * 1. Background (950x950)
 * 2. Grid (GridSvg)
 * 3. Props (PropSvg for each motion)
 * 4. Arrows (ArrowSvg for each motion)
 * 5. TKA Glyph (letter at x=50, y=800)
 * 6. TurnsColumn (to the RIGHT of letter, NOT left/right sides of pictograph)
 * 7. DirectionDot (same/opp indicator above/below letter)
 * 8. StepNumber (x=50, y=50)
 * 9. VTG Glyph (bottom-right corner, Type1 letters only)
 * 10. Elemental Glyph (top-right corner, Type1 letters only)
 * 11. Position Glyph (top center, shows α→β etc)
 * 12. ReversalIndicators (left edge, vertically centered, blue/red dots)
 *
 * Transform order for arrows/props (matching SVG):
 * translate(x, y) → rotate(angle) → scale(-1, 1) if mirror → translate(-center.x, -center.y)
 */

import type {
  IDirectRenderer,
  DirectRenderOptions,
  RenderTiming,
} from "../contracts/IDirectRenderer";
import type { PictographData } from "../../../pictograph/shared/domain/models/PictographData";
import type { StepData } from "../../../../features/create/shared/domain/models/StepData";
import type { PreparedPictographData } from "../../../pictograph/shared/domain/models/PreparedPictographData";
import { GridMode, GridPosition } from "../../../pictograph/grid/domain/enums/grid-enums";
import { getSvgImageCache, type DrawableImage } from "./SvgImageCache";
import { getSvgAssetLoader } from "./SvgAssetLoader";
import { getLetterImagePath, isDashLetter } from "../../../pictograph/tka-glyph/utils/letter-image-getter";
import { Letter, getLetterType } from "../../../foundation/domain/models/Letter";
import { LetterType } from "../../../foundation/domain/models/LetterType";
import type { IPictographPreparer } from "../../../pictograph/shared/services/contracts/IPictographPreparer";
import type { ITurnsTupleGenerator } from "../../../pictograph/arrow/positioning/placement/services/contracts/ITurnsTupleGenerator";
import { parseTurnsTuple, shouldDisplayTurn, getTurnNumberImagePath, getTurnNumberWidth } from "../../../pictograph/tka-glyph/utils/turn-tuple-parser";
import { TurnColorInterpreter } from "../../../pictograph/tka-glyph/services/implementations/TurnColorInterpreter";
import { calculateTurnPositions } from "../../../pictograph/tka-glyph/utils/turn-position-calculator";
import { calculateVTGFromPictograph } from "../../../pictograph/shared/domain/utils/vtg-calculator";
import { calculateReversalPositions } from "../../core";

import { getCanvas2DRenderer } from "$lib/shared/render/getCanvas2DRenderer";

// Constants matching the SVG system
const VIEWBOX_SIZE = 950;

// Overflow ratio for arrow/prop SVGs - expand their viewBox to capture content beyond bounds
// SVG's overflow:visible isn't respected when converting to image, so we expand the viewBox
const SVG_OVERFLOW_RATIO = 0.15;

// TKA Glyph positioning (from TKAGlyph.svelte defaults)
const TKA_GLYPH_X = 50;
const TKA_GLYPH_Y = 800;
const TKA_GLYPH_SCALE = 1;

// Beat number positioning (from StepNumber.svelte)

// Direction dot constants (from DirectionDot.svelte)
const DOT_PADDING = 10;
const DOT_SIZE = 25;

// Turn number height (from TurnsColumn.svelte)
const TURN_NUMBER_HEIGHT = 45;

// Dash constants (from Dash.svelte)
const DASH_WIDTH = 70;
const DASH_HEIGHT = 20;
const DASH_GAP = 10;
const DASH_RADIUS = 9.5;
const DASH_FILL_DARK = "#231f20"; // Near black - for light mode
const DASH_FILL_LIGHT = "#ffffff"; // White - for dark mode

// Prop colors - must match CSS variables in app.css (:root and :root.dark --dm-motion-*)
const BLUE_COLOR_LIGHT = "#3D44B8"; // Darker blue - visible on light backgrounds
const BLUE_COLOR_DARK = "#3575E2"; // Bright blue - visible on dark backgrounds
const RED_COLOR_LIGHT = "#DC2626"; // Darker red - visible on light backgrounds
const RED_COLOR_DARK = "#ED1C24"; // Bright red - visible on dark backgrounds

// VTG Glyph positioning (from VTGGlyph.svelte)
const VTG_GLYPH_WIDTH = 201.24;
const VTG_GLYPH_HEIGHT = 133.6;
const VTG_OFFSET_PERCENTAGE = 0.04;

// Elemental Glyph positioning (from ElementalGlyph.svelte)
// Position: top-right corner with 4% offset
const ELEMENTAL_GLYPH_WIDTH = 95;
const ELEMENTAL_GLYPH_HEIGHT = 125;

// Position Glyph positioning (from PositionGlyph.svelte)
const POSITION_GLYPH_Y = 50;
const POSITION_SCALE_FACTOR = 0.75;
const POSITION_SPACING = 25;
const POSITION_ARROW_WIDTH = 88.9;
const POSITION_ARROW_HEIGHT = 34.8;

// Position letter dimensions (from actual SVG viewBoxes)
const POSITION_LETTER_DIMENSIONS: Record<string, { width: number; height: number; yOffset: number }> = {
  alpha: { width: 92.22, height: 100, yOffset: 10.0 },
  beta: { width: 66.05, height: 100, yOffset: 0.0 },
  gamma: { width: 79, height: 100.11, yOffset: 0.0 },
};

// Static letters that don't show position glyph
const STATIC_LETTERS = [Letter.ALPHA, Letter.BETA, Letter.GAMMA];

// Base grid points (center + outer corners only - hand points and layer 2 are separate)
// These are rendered in the base layer and never change with visibility toggles
const BASE_GRID_POINTS = {
  center: { x: 475, y: 475, r: 12 },
  outer: {
    n: { x: 475, y: 175, r: 25 },
    e: { x: 775, y: 475, r: 25 },
    s: { x: 475, y: 775, r: 25 },
    w: { x: 175, y: 475, r: 25 },
  },
};

// Grid point color
const GRID_POINT_COLOR_LIGHT = "#000000"; // Black in SVG, shown at reduced opacity
const GRID_POINT_COLOR_DARK = "#ffffff"; // White for dark mode

export class Canvas2DDirectRenderer implements IDirectRenderer {
  private initialized = false;
  private memoryUsage = 0;
  private turnColorInterpreter = new TurnColorInterpreter();
  private preparer?: IPictographPreparer;

  // Global preparer function that can be set at app initialization
  private static globalPreparerGetter?: () => IPictographPreparer | undefined;
  private static globalTurnsTupleGeneratorGetter?: () => ITurnsTupleGenerator | undefined;

  /**
   * Set a global preparer getter function
   * Called once at app initialization to wire up DI container
   */
  static setGlobalPreparerGetter(getter: () => IPictographPreparer | undefined) {
    Canvas2DDirectRenderer.globalPreparerGetter = getter;
  }

  /**
   * Set a global turns tuple generator getter function
   * Called once at app initialization to wire up DI container
   */
  static setGlobalTurnsTupleGeneratorGetter(getter: () => ITurnsTupleGenerator | undefined) {
    Canvas2DDirectRenderer.globalTurnsTupleGeneratorGetter = getter;
  }

  constructor(preparer?: IPictographPreparer) {
    this.preparer = preparer;
  }

  getName(): string {
    return "canvas2d";
  }

  isSupported(): boolean {
    // Check for OffscreenCanvas (works in workers)
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(1, 1);
      return !!canvas.getContext("2d");
    }
    // Fallback to HTMLCanvasElement (main thread only)
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      return !!canvas.getContext("2d");
    }
    return false;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize the asset loader (pre-loads grids)
    const assetLoader = getSvgAssetLoader();
    await assetLoader.initialize();

    this.initialized = true;
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
    const canvas = document.createElement("canvas");
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
   * Ensure pictograph has prepared data, calling PictographPreparer if needed
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

    // Try injected preparer first, then global getter
    const preparer = this.preparer || Canvas2DDirectRenderer.globalPreparerGetter?.();

    if (preparer) {
      try {
        const prepared = await preparer.prepareSingle(pictograph, {
          themeMode: options.visibility.darkMode ? "dark" : "light",
          bluePropType: options.visibility.bluePropType,
          redPropType: options.visibility.redPropType,
        });
        return prepared;
      } catch (error) {
        console.warn("[Canvas2D] Failed to prepare pictograph:", error);
      }
    }

    // No preparer available - return unprepared (arrows/props won't render)
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
      // Base layer mode: draw only center + outer points (no hand points or layer 2)
      this.drawBaseGridOnly(ctx, size, isDarkMode, gridMode);
    } else {
      // Full mode: draw complete grid with all points
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
      await this.drawArrows(ctx, prepared, size, options);
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

      // Draw dash for Type 3/5 letters (e.g., "X-", "Φ-")
      if (isDashLetter(preparedPictograph.letter)) {
        this.drawDash(ctx, letterDimensions, scale, isDarkMode);
      }
    }

    // 6. Draw turn numbers (TurnsColumn - to the RIGHT of letter)
    if (visibility.showTKA && preparedPictograph.motions) {
      await this.drawTurnsColumn(ctx, preparedPictograph, letterDimensions, scale, isDarkMode);
    }

    // 7. Draw direction dot (same/opp indicator)
    if (visibility.showTKA && preparedPictograph.letter && preparedPictograph.motions) {
      this.drawDirectionDot(ctx, preparedPictograph, letterDimensions, scale, isDarkMode);
    }

    // 8. Beat number — NOT drawn here.
    // Step numbers are composited by the caller (ImageComposer draws them as
    // overlays on the export canvas; ChoreoCard renders HTML overlays).
    // Drawing them here would bake them into cached blobs, causing double
    // numbers when the ChoreoCard also renders its HTML overlay.

    // 9. Draw fused Elemental+VTG glyph (bottom-right corner)
    if (visibility.showVTG || visibility.showElemental) {
      await this.drawElementalGlyph(ctx, preparedPictograph, gridMode, size, isDarkMode);
    }

    // 11. Draw Position glyph (top center)
    if (visibility.showPositions) {
      await this.drawPositionGlyph(ctx, preparedPictograph, size, isDarkMode);
    }

    // 12. Draw reversal indicators
    if (visibility.showReversals) {
      this.drawReversalIndicators(ctx, preparedPictograph, size, isDarkMode);
    }


  }

  /**
   * Draw the grid using actual SVG images
   */
  private async drawGrid(
    ctx: CanvasRenderingContext2D,
    size: number,
    gridMode: GridMode,
    isDarkMode: boolean,
    showNonRadial: boolean
  ): Promise<void> {
    const assetLoader = getSvgAssetLoader();
    const gridType = gridMode === GridMode.BOX ? "box" : "diamond";
    const scale = size / VIEWBOX_SIZE;

    // For box mode, we need to rotate the diamond grid 45 degrees
    const needsRotation = gridMode === GridMode.BOX;

    // Draw main grid
    const gridImg = assetLoader.getGridImage(gridType === "box" ? "diamond" : gridType);
    if (gridImg) {
      ctx.save();

      // Apply dark mode filter to match GridSvg.svelte's #d0d0d0 color
      // The grid SVG is black on transparent - invert to white for dark mode
      if (isDarkMode) {
        ctx.filter = "invert(1) opacity(0.85)";
      }
      // Light mode: no filter - render grid as pure black

      if (needsRotation) {
        // Rotate 45 degrees around center for box mode
        const center = size / 2;
        ctx.translate(center, center);
        ctx.rotate(45 * Math.PI / 180);
        ctx.translate(-center, -center);
      }

      ctx.drawImage(gridImg, 0, 0, size, size);
      ctx.restore();
    }

    // Draw non-radial points overlay if enabled
    if (showNonRadial) {
      const nonRadialImg = assetLoader.getNonRadialPointsImage(gridType === "box" ? "diamond" : gridType);
      if (nonRadialImg) {
        ctx.save();
        if (isDarkMode) {
          ctx.filter = "invert(1) opacity(0.85)";
        }
        // Light mode: no filter - render as pure black

        if (needsRotation) {
          const center = size / 2;
          ctx.translate(center, center);
          ctx.rotate(45 * Math.PI / 180);
          ctx.translate(-center, -center);
        }

        ctx.drawImage(nonRadialImg, 0, 0, size, size);
        ctx.restore();
      }
    }
  }

  /**
   * Draw only the base grid points (center + outer corners)
   *
   * This is used by the LayerCompositor for the base layer, which excludes
   * toggleable grid points (hand points and layer 2 points).
   * Those are rendered separately in the gridPoints layer.
   */
  drawBaseGridOnly(
    ctx: CanvasRenderingContext2D,
    size: number,
    isDarkMode: boolean,
    gridMode: GridMode = GridMode.DIAMOND
  ): void {
    const scale = size / VIEWBOX_SIZE;
    const pointColor = isDarkMode ? GRID_POINT_COLOR_DARK : GRID_POINT_COLOR_LIGHT;
    const isBoxMode = gridMode === GridMode.BOX;

    // Set opacity for grid points
    // Dark mode: slightly transparent white (avoids harsh pure white)
    // Light mode: solid black for maximum clarity
    ctx.save();
    ctx.globalAlpha = isDarkMode ? 0.85 : 1.0;

    // For box mode, rotate the entire coordinate system 45° around center
    // This matches GridSvg.svelte which rotates diamond_grid.svg for box mode
    if (isBoxMode) {
      const center = size / 2;
      ctx.translate(center, center);
      ctx.rotate(45 * Math.PI / 180);
      ctx.translate(-center, -center);
    }

    // Draw center point (unaffected by rotation since it's at center)
    ctx.fillStyle = pointColor;
    const center = BASE_GRID_POINTS.center;
    ctx.beginPath();
    ctx.arc(center.x * scale, center.y * scale, center.r * scale, 0, Math.PI * 2);
    ctx.fill();

    // Draw outer points
    // Diamond mode: filled circles. Box mode: outlined (stroked) circles.
    // This matches GridSvg.svelte's fill-opacity/stroke-opacity toggling.
    for (const point of Object.values(BASE_GRID_POINTS.outer)) {
      ctx.beginPath();
      ctx.arc(point.x * scale, point.y * scale, point.r * scale, 0, Math.PI * 2);
      if (isBoxMode) {
        // Box mode: outlined circles (stroke only, no fill)
        ctx.strokeStyle = pointColor;
        ctx.lineWidth = 13 * scale;
        ctx.stroke();
      } else {
        // Diamond mode: filled circles
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Wrap inner SVG content with proper <svg> element for image conversion
   * The imageSrc from PictographPreparer is inner content meant to be injected
   * inside an existing <svg> element - we need to wrap it for canvas conversion.
   *
   * CRITICAL: We expand the viewBox to capture content that extends beyond the
   * original bounds (e.g., arrow tips). SVG's overflow:visible doesn't work
   * when rasterizing to canvas, so we expand the coordinate space instead.
   */
  private wrapSvgContent(
    innerContent: string,
    viewBoxWidth: number,
    viewBoxHeight: number,
    expandViewBox: boolean = false,
    fullViewBox?: string
  ): { svg: string; offsetX: number; offsetY: number; newWidth: number; newHeight: number } {
    // Parse viewBox origin if full viewBox string provided (e.g., "-322 -253 2730 426")
    let minX = 0, minY = 0;
    if (fullViewBox) {
      const parts = fullViewBox.split(/\s+/);
      minX = parseFloat(parts[0] || "0") || 0;
      minY = parseFloat(parts[1] || "0") || 0;
    }

    if (!expandViewBox) {
      return {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}" width="${viewBoxWidth}" height="${viewBoxHeight}">${innerContent}</svg>`,
        offsetX: 0,
        offsetY: 0,
        newWidth: viewBoxWidth,
        newHeight: viewBoxHeight,
      };
    }

    // Expand viewBox by overflow ratio in all directions
    const expandX = viewBoxWidth * SVG_OVERFLOW_RATIO;
    const expandY = viewBoxHeight * SVG_OVERFLOW_RATIO;
    const newWidth = viewBoxWidth + expandX * 2;
    const newHeight = viewBoxHeight + expandY * 2;

    // Expand the viewBox origin to accommodate the padding
    const newMinX = minX - expandX;
    const newMinY = minY - expandY;

    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${newMinX} ${newMinY} ${newWidth} ${newHeight}" width="${newWidth}" height="${newHeight}">${innerContent}</svg>`,
      offsetX: expandX,
      offsetY: expandY,
      newWidth,
      newHeight,
    };
  }

  /**
   * Draw all props using prepared assets
   *
   * Mirroring logic (matching PropSvg.svelte):
   * - Red HAND props are always mirrored (anatomical left/right hands)
   * - Buugeng family can be flipped via user preference (not implemented here yet)
   * - All other props (staff, fan, etc.) are NOT mirrored
   */
  private async drawProps(
    ctx: CanvasRenderingContext2D,
    prepared: NonNullable<PreparedPictographData["_prepared"]>,
    canvasSize: number,
    pictograph: PreparedPictographData,
    options: DirectRenderOptions
  ): Promise<void> {
    const { propPositions, propAssets } = prepared;
    const svgCache = getSvgImageCache();
    const scale = canvasSize / VIEWBOX_SIZE;

    const showBlue = options.visibility.showBlueMotion ?? true;
    const showRed = options.visibility.showRedMotion ?? true;

    for (const color of ["blue", "red"]) {
      if (color === "blue" && !showBlue) continue;
      if (color === "red" && !showRed) continue;

      const position = propPositions[color];
      const assets = propAssets[color];

      if (!position || !assets?.imageSrc) continue;

      try {
        // Parse viewBox (format: "width height")
        const viewBoxParts = assets.viewBox.split(" ").map(Number);
        const viewBoxWidth = viewBoxParts[0] || 100;
        const viewBoxHeight = viewBoxParts[1] || 100;

        // Wrap inner SVG content - props don't need expanded viewBox
        const wrapped = this.wrapSvgContent(assets.imageSrc, viewBoxWidth, viewBoxHeight, false);

        // Convert SVG string to cached image
        const cacheKey = `prop_${color}_${this.hashString(wrapped.svg)}`;
        const img = await svgCache.getImage(wrapped.svg, cacheKey);

        // Determine mirroring (matching PropSvg.svelte logic)
        // Only red HAND props should be mirrored
        const shouldMirror = this.shouldMirrorProp(color, pictograph, options);

        this.drawElementWithTransform(ctx, img, {
          x: position.x * scale,
          y: position.y * scale,
          rotation: position.rotation,
          centerX: assets.center.x,
          centerY: assets.center.y,
          viewBoxWidth,
          viewBoxHeight,
          scale,
          shouldMirror,
        });
      } catch (error) {
        console.warn(`[Canvas2D] Failed to draw ${color} prop:`, error);
      }
    }
  }

  /**
   * Determine if a prop should be mirrored (matching PropSvg.svelte logic)
   */
  private shouldMirrorProp(
    color: string,
    pictograph: PreparedPictographData,
    options: DirectRenderOptions
  ): boolean {
    // Get the motion data for this color
    const motionData = pictograph.motions?.[color as "blue" | "red"];
    if (!motionData) return false;

    // Get the actual prop type being rendered
    // Check options override first, then motion data, default is not HAND
    let actualPropType: string | undefined;
    if (color === "blue" && options.visibility.bluePropType) {
      actualPropType = options.visibility.bluePropType;
    } else if (color === "red" && options.visibility.redPropType) {
      actualPropType = options.visibility.redPropType;
    } else {
      actualPropType = motionData.propType;
    }

    // Only mirror red HAND props
    if (actualPropType?.toLowerCase() === "hand" && color === "red") {
      return true;
    }

    // TODO: Add buugeng family flip preference support if needed

    return false;
  }

  /**
   * Draw all arrows using prepared assets
   *
   * CRITICAL: Arrows often have content that extends beyond their viewBox
   * (tips, decorations). We expand the viewBox to capture this overflow.
   */
  private async drawArrows(
    ctx: CanvasRenderingContext2D,
    prepared: NonNullable<PreparedPictographData["_prepared"]>,
    canvasSize: number,
    options: DirectRenderOptions
  ): Promise<void> {
    const { arrowPositions, arrowAssets, arrowMirroring } = prepared;
    const svgCache = getSvgImageCache();
    const scale = canvasSize / VIEWBOX_SIZE;

    const showBlue = options.visibility.showBlueMotion ?? true;
    const showRed = options.visibility.showRedMotion ?? true;

    for (const color of ["blue", "red"]) {
      if (color === "blue" && !showBlue) continue;
      if (color === "red" && !showRed) continue;

      const position = arrowPositions[color];
      const assets = arrowAssets[color];
      const shouldMirror = arrowMirroring[color] ?? false;

      if (!position || !assets?.imageSrc) continue;

      try {
        // Get dimensions from the viewBox object
        const viewBoxWidth = assets.viewBox.width || 100;
        const viewBoxHeight = assets.viewBox.height || 100;
        // Get full viewBox string including origin (e.g., "-296 -2937 2784 3091")
        const fullViewBox = assets.viewBox.fullViewBox;

        // Wrap inner SVG content with EXPANDED viewBox to capture overflow
        // The expansion adds padding around the original viewBox
        // Pass fullViewBox to preserve the origin coordinates (negative minX/minY)
        const wrapped = this.wrapSvgContent(assets.imageSrc, viewBoxWidth, viewBoxHeight, true, fullViewBox);

        // Convert SVG string to cached image
        const cacheKey = `arrow_${color}_exp_${this.hashString(wrapped.svg)}`;
        const img = await svgCache.getImage(wrapped.svg, cacheKey);

        // Adjust center point to account for viewBox origin and expansion
        // The center from ArrowSvgParser is in SVG coordinates.
        // We need to convert to image pixel coordinates where (0,0) = top-left of image.
        //
        // Formula: pixelCenter = svgCenter - viewBoxOrigin + expansionOffset
        //
        // Example: viewBox="-296 -2937 2784 3091", center=(1096, -1391.5), expand=15%
        //   pixelCenterX = 1096 - (-296) + 417.6 = 1809.6 (correct for 3202px wide image)
        let viewBoxMinX = 0, viewBoxMinY = 0;
        if (fullViewBox) {
          const parts = fullViewBox.split(/\s+/);
          viewBoxMinX = parseFloat(parts[0] || "0") || 0;
          viewBoxMinY = parseFloat(parts[1] || "0") || 0;
        }

        const adjustedCenterX = (assets.center?.x ?? viewBoxWidth / 2) - viewBoxMinX + wrapped.offsetX;
        const adjustedCenterY = (assets.center?.y ?? viewBoxHeight / 2) - viewBoxMinY + wrapped.offsetY;

        // Draw with transforms matching ArrowSvg.svelte
        this.drawElementWithTransform(ctx, img, {
          x: position.x * scale,
          y: position.y * scale,
          rotation: position.rotation,
          centerX: adjustedCenterX,
          centerY: adjustedCenterY,
          viewBoxWidth: wrapped.newWidth,
          viewBoxHeight: wrapped.newHeight,
          scale,
          shouldMirror,
        });
      } catch (error) {
        console.warn(`[Canvas2D] Failed to draw ${color} arrow:`, error);
      }
    }
  }

  /**
   * Draw an element (prop or arrow) with proper Canvas 2D transforms
   * Transform order matches SVG: translate → rotate → mirror → scale → center
   */
  private drawElementWithTransform(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    img: DrawableImage,
    params: {
      x: number;
      y: number;
      rotation: number;
      centerX: number;
      centerY: number;
      viewBoxWidth: number;
      viewBoxHeight: number;
      scale: number;
      shouldMirror: boolean;
    }
  ): void {
    const {
      x, y, rotation, centerX, centerY,
      viewBoxWidth, viewBoxHeight, scale, shouldMirror
    } = params;

    ctx.save();

    // 1. Translate to position on canvas
    ctx.translate(x, y);

    // 2. Rotate around the position point
    ctx.rotate((rotation * Math.PI) / 180);

    // 3. Mirror if needed (scale X by -1)
    if (shouldMirror) {
      ctx.scale(-1, 1);
    }

    // 4. Scale the viewBox to canvas coordinates
    ctx.scale(scale, scale);

    // 5. Translate by negative center (so element is centered at position)
    ctx.translate(-centerX, -centerY);

    // 6. Draw the image at its natural viewBox size
    ctx.drawImage(img, 0, 0, viewBoxWidth, viewBoxHeight);

    ctx.restore();
  }

  /**
   * Draw the TKA letter glyph at x=50, y=800 (matching TKAGlyph.svelte)
   * Returns the letter dimensions for positioning TurnsColumn and DirectionDot
   */
  private async drawTKAGlyph(
    ctx: CanvasRenderingContext2D,
    letter: Letter,
    size: number,
    isDarkMode: boolean
  ): Promise<{ width: number; height: number }> {
    const scale = size / VIEWBOX_SIZE;
    const x = TKA_GLYPH_X * scale;
    const y = TKA_GLYPH_Y * scale;

    try {
      const letterPath = getLetterImagePath(letter);

      // Load letter asset (image + dimensions) from cache
      // This fetches and parses the SVG once, then caches both
      const assetLoader = getSvgAssetLoader();
      const letterAsset = await assetLoader.getLetterAsset(letterPath);

      if (letterAsset) {
        const { image: letterImg, dimensions: letterDimensions } = letterAsset;

        // Draw at viewBox dimensions scaled to canvas (matching TKAGlyph.svelte)
        const drawWidth = letterDimensions.width * TKA_GLYPH_SCALE * scale;
        const drawHeight = letterDimensions.height * TKA_GLYPH_SCALE * scale;

        ctx.save();

        // Apply dark mode invert filter (matching TKAGlyph.svelte filter: invert(0.9))
        if (isDarkMode) {
          ctx.filter = "invert(0.9)";
        }

        // Draw at position (matching transform="translate({x}, {y}) scale({scale})")
        ctx.drawImage(letterImg, x, y, drawWidth, drawHeight);

        ctx.restore();

        // Return viewBox dimensions for turn number positioning
        return letterDimensions;
      }
    } catch (error) {
      console.warn("[Canvas2D] Failed to load letter image:", error);
    }

    // Fallback to text rendering
    return this.drawTKAGlyphText(ctx, String(letter), size, isDarkMode);
  }

  /**
   * Draw the dash suffix for Type 3/5 letters (e.g., "X-", "Φ-")
   * Positioned to the right of the letter, vertically centered
   */
  private drawDash(
    ctx: CanvasRenderingContext2D,
    letterDimensions: { width: number; height: number },
    scale: number,
    isDarkMode: boolean
  ): void {
    const TKA_GLYPH_SCALE = 1.0;
    const baseX = TKA_GLYPH_X * scale;
    const baseY = TKA_GLYPH_Y * scale;

    // Calculate dash position (to the right of letter, vertically centered)
    const letterWidth = letterDimensions.width * TKA_GLYPH_SCALE * scale;
    const letterHeight = letterDimensions.height * TKA_GLYPH_SCALE * scale;
    const dashWidth = DASH_WIDTH * scale;
    const dashHeight = DASH_HEIGHT * scale;
    const dashGap = DASH_GAP * scale;
    const dashRadius = DASH_RADIUS * scale;

    const dashX = baseX + letterWidth + dashGap;
    const dashY = baseY + (letterHeight - dashHeight) / 2;

    // Draw rounded rectangle
    ctx.save();
    ctx.fillStyle = isDarkMode ? DASH_FILL_LIGHT : DASH_FILL_DARK;
    ctx.beginPath();
    ctx.roundRect(dashX, dashY, dashWidth, dashHeight, dashRadius);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Fallback text rendering for TKA glyph
   */
  private drawTKAGlyphText(
    ctx: CanvasRenderingContext2D,
    letter: string,
    size: number,
    isDarkMode: boolean
  ): { width: number; height: number } {
    const scale = size / VIEWBOX_SIZE;
    const x = TKA_GLYPH_X * scale;
    const y = TKA_GLYPH_Y * scale;
    const fontSize = 100 * scale;

    ctx.font = `bold ${fontSize}px Georgia, serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = isDarkMode ? "#ffffff" : "#000000";
    ctx.fillText(letter, x, y);

    // Return approximate dimensions
    return { width: 100, height: 100 };
  }

  /**
   * Draw the TurnsColumn - turn numbers to the RIGHT of the TKA letter
   * Matching TurnsColumn.svelte positioning exactly
   */
  private async drawTurnsColumn(
    ctx: CanvasRenderingContext2D,
    pictograph: PictographData,
    letterDimensions: { width: number; height: number },
    scale: number,
    isDarkMode: boolean
  ): Promise<void> {
    // Generate turnsTuple using the same service as SVG
    // If no generator available, skip turn number rendering
    let turnsTuple = "(s, 0, 0)";
    try {
      const generator = Canvas2DDirectRenderer.globalTurnsTupleGeneratorGetter?.();
      if (generator) {
        turnsTuple = generator.generateTurnsTuple(pictograph);
      } else {
        // No generator available - skip turn numbers
        return;
      }
    } catch {
      // Use default
    }

    // Parse the tuple
    const parsed = parseTurnsTuple(turnsTuple);
    const showTop = shouldDisplayTurn(parsed.top);
    const showBottom = shouldDisplayTurn(parsed.bottom);

    if (!showTop && !showBottom) return;

    // Get turn colors (based on letter type)
    const turnColors = this.turnColorInterpreter.interpretTurnColors(
      pictograph.letter,
      pictograph
    );

    // Check if letter has a dash
    const hasDash = isDashLetter(pictograph.letter);

    // Calculate positions using the same function as SVG
    const positions = calculateTurnPositions(letterDimensions, TURN_NUMBER_HEIGHT, hasDash);

    // Calculate column width (max of top and bottom)
    const columnWidth = Math.max(
      getTurnNumberWidth(parsed.top),
      getTurnNumberWidth(parsed.bottom)
    );

    // Base position (same as TKA glyph)
    const baseX = TKA_GLYPH_X * scale;
    const baseY = TKA_GLYPH_Y * scale;

    const assetLoader = getSvgAssetLoader();

    // Draw top turn number
    if (showTop) {
      const topPath = getTurnNumberImagePath(parsed.top);
      if (topPath) {
        try {
          const topImg = await assetLoader.getTurnNumberImage(parsed.top);
          if (topImg) {
            // Use natural width for this turn value, centered within column width
            // This matches SVG's preserveAspectRatio="xMidYMin meet" behavior
            const topNaturalWidth = getTurnNumberWidth(parsed.top);
            const centerOffset = ((columnWidth - topNaturalWidth) / 2) * scale;
            const drawX = baseX + positions.top.x * scale + centerOffset;
            const drawY = baseY + positions.top.y * scale;
            const drawWidth = topNaturalWidth * scale;
            const drawHeight = TURN_NUMBER_HEIGHT * scale;

            // Draw with color tint
            this.drawColoredImage(ctx, topImg, drawX, drawY, drawWidth, drawHeight, turnColors.top);
          }
        } catch (error) {
          // Fallback to text
          this.drawTurnText(ctx, parsed.top, turnColors.top, baseX + positions.top.x * scale, baseY + positions.top.y * scale, scale);
        }
      }
    }

    // Draw bottom turn number
    if (showBottom) {
      const bottomPath = getTurnNumberImagePath(parsed.bottom);
      if (bottomPath) {
        try {
          const bottomImg = await assetLoader.getTurnNumberImage(parsed.bottom);
          if (bottomImg) {
            // Use natural width for this turn value, centered within column width
            // This matches SVG's preserveAspectRatio="xMidYMin meet" behavior
            const bottomNaturalWidth = getTurnNumberWidth(parsed.bottom);
            const centerOffset = ((columnWidth - bottomNaturalWidth) / 2) * scale;
            const drawX = baseX + positions.bottom.x * scale + centerOffset;
            const drawY = baseY + positions.bottom.y * scale;
            const drawWidth = bottomNaturalWidth * scale;
            const drawHeight = TURN_NUMBER_HEIGHT * scale;

            // Draw with color tint
            this.drawColoredImage(ctx, bottomImg, drawX, drawY, drawWidth, drawHeight, turnColors.bottom);
          }
        } catch (error) {
          // Fallback to text
          this.drawTurnText(ctx, parsed.bottom, turnColors.bottom, baseX + positions.bottom.x * scale, baseY + positions.bottom.y * scale, scale);
        }
      }
    }
  }

  /**
   * Draw an image with a color tint (for turn numbers)
   */
  private drawColoredImage(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    img: DrawableImage,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string
  ): void {
    // Create offscreen canvas to apply color (works in both main thread and workers)
    const offscreen = new OffscreenCanvas(Math.ceil(width), Math.ceil(height));
    const offCtx = offscreen.getContext("2d");

    if (!offCtx) {
      ctx.drawImage(img, x, y, width, height);
      return;
    }

    // Draw image
    offCtx.drawImage(img, 0, 0, width, height);

    // Apply color using composite operation
    offCtx.globalCompositeOperation = "source-in";
    offCtx.fillStyle = color;
    offCtx.fillRect(0, 0, width, height);

    // Draw to main canvas
    ctx.drawImage(offscreen, x, y);
  }

  /**
   * Fallback text rendering for turn numbers
   */
  private drawTurnText(
    ctx: CanvasRenderingContext2D,
    value: number | "fl",
    color: string,
    x: number,
    y: number,
    scale: number
  ): void {
    const fontSize = 40 * scale;
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = color;

    const text = value === "fl" ? "fl" : String(value);
    ctx.fillText(text, x, y);
  }

  /**
   * Draw the direction dot (same/opp indicator)
   * Matching DirectionDot.svelte positioning
   */
  private drawDirectionDot(
    ctx: CanvasRenderingContext2D,
    pictograph: PictographData,
    letterDimensions: { width: number; height: number },
    scale: number,
    isDarkMode: boolean
  ): void {
    // Generate turnsTuple to get direction
    // If no generator available, skip direction dot
    let turnsTuple = "(s, 0, 0)";
    try {
      const generator = Canvas2DDirectRenderer.globalTurnsTupleGeneratorGetter?.();
      if (generator) {
        turnsTuple = generator.generateTurnsTuple(pictograph);
      } else {
        // No generator available - skip direction dot
        return;
      }
    } catch {
      return;
    }

    const parsed = parseTurnsTuple(turnsTuple);
    const direction = parsed.direction;

    // Only draw for "s" (same) or "o" (opp)
    if (direction !== "s" && direction !== "o") return;

    // Base position (same as TKA glyph)
    const baseX = TKA_GLYPH_X * scale;
    const baseY = TKA_GLYPH_Y * scale;

    // Calculate dot position relative to letter
    // X: centered on letter
    const dotCenterX = letterDimensions.width / 2;

    let dotY: number;
    if (direction === "s") {
      // SAME: above letter
      dotY = -DOT_PADDING - DOT_SIZE;
    } else {
      // OPP: below letter
      dotY = letterDimensions.height + DOT_PADDING;
    }

    // Draw the dot
    const drawX = baseX + (dotCenterX - DOT_SIZE / 2) * scale;
    const drawY = baseY + dotY * scale;
    const radius = (DOT_SIZE / 2) * scale;

    ctx.fillStyle = isDarkMode ? "#ffffff" : "#231f20";
    ctx.beginPath();
    ctx.arc(drawX + radius, drawY + radius, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw VTG glyph in bottom-right corner (matching VTGGlyph.svelte)
   * Only renders for Type1 letters (A-V)
   */
  private async drawVTGGlyph(
    ctx: CanvasRenderingContext2D,
    pictograph: PictographData,
    gridMode: GridMode,
    size: number,
    isDarkMode: boolean
  ): Promise<void> {
    // Only render for Type1 letters
    if (!pictograph.letter) return;

    try {
      const letterType = getLetterType(pictograph.letter as Letter);
      if (letterType !== LetterType.TYPE1) return;
    } catch {
      // Unknown letter - skip VTG
      return;
    }

    // Calculate VTG mode
    const vtgResult = calculateVTGFromPictograph(pictograph, gridMode);
    if (!vtgResult.vtgMode) return;

    const scale = size / VIEWBOX_SIZE;
    const svgCache = getSvgImageCache();

    // Calculate position (bottom-right corner with offset)
    const offset = VIEWBOX_SIZE * VTG_OFFSET_PERCENTAGE;
    const x = (VIEWBOX_SIZE - VTG_GLYPH_WIDTH - offset) * scale;
    const y = (VIEWBOX_SIZE - VTG_GLYPH_HEIGHT - offset) * scale;

    try {
      // Load VTG glyph SVG
      const vtgPath = `/images/vtg_glyphs/${vtgResult.vtgMode}.svg`;
      const response = await fetch(vtgPath);
      if (!response.ok) return;

      const svgText = await response.text();
      const cacheKey = `vtg_${vtgResult.vtgMode}_${isDarkMode}`;
      const img = await svgCache.getImage(svgText, cacheKey);

      // Draw at calculated position
      const drawWidth = VTG_GLYPH_WIDTH * scale;
      const drawHeight = VTG_GLYPH_HEIGHT * scale;

      ctx.save();
      if (isDarkMode) {
        ctx.filter = 'invert(1)';
      }
      ctx.drawImage(img, x, y, drawWidth, drawHeight);
      ctx.restore();
    } catch (error) {
      console.warn(`[Canvas2D] Failed to draw VTG glyph:`, error);
    }
  }

  /**
   * Draw Elemental glyph in top-right corner (matching ElementalGlyph.svelte)
   * Only renders for Type1 letters (A-V)
   * Uses the elemental type derived from VTG mode (water, fire, earth, air, sun, moon)
   */
  private async drawElementalGlyph(
    ctx: CanvasRenderingContext2D,
    pictograph: PictographData,
    gridMode: GridMode,
    size: number,
    isDarkMode: boolean
  ): Promise<void> {
    // Only render for Type1 letters
    if (!pictograph.letter) return;

    try {
      const letterType = getLetterType(pictograph.letter as Letter);
      if (letterType !== LetterType.TYPE1) return;
    } catch {
      // Unknown letter - skip Elemental
      return;
    }

    // Calculate VTG mode to get elemental type
    const vtgResult = calculateVTGFromPictograph(pictograph, gridMode);
    if (!vtgResult.elementalType) return;

    const scale = size / VIEWBOX_SIZE;
    const PADDING = 40;
    const GLYPH_WIDTH = 120;
    const GLYPH_HEIGHT = 140;

    // Position in bottom-right corner (matching ElementalGlyph.svelte)
    const x = (VIEWBOX_SIZE - GLYPH_WIDTH - PADDING) * scale;
    const y = (VIEWBOX_SIZE - GLYPH_HEIGHT - PADDING) * scale;

    try {
      // Load fused elemental+VTG PNG
      const elementalPath = `/images/elements/${vtgResult.elementalType}.png`;
      const response = await fetch(elementalPath);
      if (!response.ok) return;

      const blob = await response.blob();
      const img = await createImageBitmap(blob);

      // Draw at calculated position
      const drawWidth = GLYPH_WIDTH * scale;
      const drawHeight = GLYPH_HEIGHT * scale;

      ctx.save();
      ctx.drawImage(img, x, y, drawWidth, drawHeight);
      ctx.restore();
    } catch (error) {
      console.warn(`[Canvas2D] Failed to draw Elemental glyph:`, error);
    }
  }

  /**
   * Draw Position glyph at top center (matching PositionGlyph.svelte)
   * Shows start → end position groups (α, β, γ)
   */
  private async drawPositionGlyph(
    ctx: CanvasRenderingContext2D,
    pictograph: PictographData,
    size: number,
    isDarkMode: boolean
  ): Promise<void> {
    // Don't show for static letters
    if (pictograph.letter && STATIC_LETTERS.includes(pictograph.letter as Letter)) {
      return;
    }

    // Need both start and end positions
    const startPosition = pictograph.startPosition;
    const endPosition = pictograph.endPosition;
    if (!startPosition || !endPosition) return;

    // Extract position groups (e.g., "alpha1" -> "alpha")
    const extractGroup = (pos: GridPosition | string): string | null => {
      const posStr = String(pos);
      const match = posStr.match(/[a-z]+/i);
      return match ? match[0].toLowerCase() : null;
    };

    const startGroup = extractGroup(startPosition);
    const endGroup = extractGroup(endPosition);
    if (!startGroup || !endGroup) return;

    const scale = size / VIEWBOX_SIZE;
    const svgCache = getSvgImageCache();

    // SVG paths for position groups
    const groupToSvg: Record<string, string> = {
      alpha: "/images/letters_trimmed/Type6/α.svg",
      beta: "/images/letters_trimmed/Type6/β.svg",
      gamma: "/images/letters_trimmed/Type6/γ.svg",
    };

    const startSvgPath = groupToSvg[startGroup];
    const endSvgPath = groupToSvg[endGroup];
    const arrowSvgPath = "/images/arrow.svg";

    if (!startSvgPath || !endSvgPath) return;

    // Get dimensions for each letter (respecting their actual SVG dimensions)
    const startDims = POSITION_LETTER_DIMENSIONS[startGroup];
    const endDims = POSITION_LETTER_DIMENSIONS[endGroup];

    // Early return if dimensions not found (TypeScript needs explicit check before usage)
    if (!startDims) return;
    if (!endDims) return;

    // Calculate scaled dimensions for each element
    const scaledStartWidth = startDims.width * POSITION_SCALE_FACTOR;
    const scaledStartHeight = startDims.height * POSITION_SCALE_FACTOR;
    const scaledEndWidth = endDims.width * POSITION_SCALE_FACTOR;
    const scaledEndHeight = endDims.height * POSITION_SCALE_FACTOR;
    const scaledArrowWidth = POSITION_ARROW_WIDTH * POSITION_SCALE_FACTOR;
    const scaledArrowHeight = POSITION_ARROW_HEIGHT * POSITION_SCALE_FACTOR;

    // Use max height for vertical centering
    const maxHeight = Math.max(scaledStartHeight, scaledEndHeight);

    // Calculate total width and centering
    const totalWidth = scaledStartWidth + POSITION_SPACING * POSITION_SCALE_FACTOR + scaledArrowWidth + POSITION_SPACING * POSITION_SCALE_FACTOR + scaledEndWidth;
    const groupX = VIEWBOX_SIZE / 2 - totalWidth / 2;

    // Y positions - centered vertically around a common center line
    const centerLine = maxHeight / 2;

    try {
      // Load all three images
      const [startImg, arrowImg, endImg] = await Promise.all([
        this.loadPositionImage(startSvgPath, `pos_${startGroup}_${isDarkMode}`, svgCache),
        this.loadPositionImage(arrowSvgPath, `pos_arrow_${isDarkMode}`, svgCache),
        this.loadPositionImage(endSvgPath, `pos_${endGroup}_${isDarkMode}`, svgCache),
      ]);

      if (!startImg || !arrowImg || !endImg) return;

      ctx.save();

      // Apply dark mode inversion (matching CSS filter: invert(0.9))
      if (isDarkMode) {
        ctx.filter = "invert(0.9)";
      }

      // Translate to group position
      const drawX = groupX * scale;
      const drawY = POSITION_GLYPH_Y * scale;

      // X positions (calculated sequentially)
      const startX = 0;
      const arrowX = scaledStartWidth + POSITION_SPACING * POSITION_SCALE_FACTOR;
      const endX = arrowX + scaledArrowWidth + POSITION_SPACING * POSITION_SCALE_FACTOR;

      // Draw start letter (centered vertically with yOffset adjustment)
      const startYOffset = startDims.yOffset * POSITION_SCALE_FACTOR;
      ctx.drawImage(
        startImg,
        drawX + startX * scale,
        drawY + (centerLine - scaledStartHeight / 2 + startYOffset) * scale,
        scaledStartWidth * scale,
        scaledStartHeight * scale
      );

      // Draw arrow (centered vertically)
      ctx.drawImage(
        arrowImg,
        drawX + arrowX * scale,
        drawY + (centerLine - scaledArrowHeight / 2) * scale,
        scaledArrowWidth * scale,
        scaledArrowHeight * scale
      );

      // Draw end letter (centered vertically with yOffset adjustment)
      const endYOffset = endDims.yOffset * POSITION_SCALE_FACTOR;
      ctx.drawImage(
        endImg,
        drawX + endX * scale,
        drawY + (centerLine - scaledEndHeight / 2 + endYOffset) * scale,
        scaledEndWidth * scale,
        scaledEndHeight * scale
      );

      ctx.restore();
    } catch (error) {
      console.warn(`[Canvas2D] Failed to draw Position glyph:`, error);
    }
  }

  /**
   * Load a position glyph image (letter or arrow)
   */
  private async loadPositionImage(
    svgPath: string,
    cacheKey: string,
    svgCache: ReturnType<typeof getSvgImageCache>
  ): Promise<DrawableImage | null> {
    try {
      const response = await fetch(svgPath);
      if (!response.ok) return null;
      const svgText = await response.text();
      return await svgCache.getImage(svgText, cacheKey);
    } catch {
      return null;
    }
  }

  /**
   * Draw reversal indicators using shared core calculations
   *
   * Positioning (from unified core, matching ReversalIndicators.svelte):
   * - Single reversal: dot is centered vertically at CENTER_Y (475)
   * - Both reversals: RED on top, BLUE on bottom, spaced by DOT_SPACING
   * - All dots are at X_POSITION (71.5) on the left edge
   *
   * Works with both StepData (has blueReversal/redReversal properties)
   * and PictographData (check motions for reversals)
   */
  private drawReversalIndicators(
    ctx: CanvasRenderingContext2D,
    pictograph: PictographData | StepData,
    size: number,
    isDarkMode: boolean
  ): void {
    // Check for reversals - handle both StepData and PictographData
    let blueReversal = false;
    let redReversal = false;

    if (this.isStepData(pictograph)) {
      // StepData has explicit reversal flags
      blueReversal = pictograph.blueReversal ?? false;
      redReversal = pictograph.redReversal ?? false;
    }
    // PictographData doesn't have reversal flags - reversals are only computed
    // when comparing to previous steps, which happens in StepData conversion

    // Use shared core calculation for positioning
    const { dots } = calculateReversalPositions(blueReversal, redReversal, isDarkMode);

    if (dots.length === 0) return;

    // Scale from viewbox coordinates (950x950) to canvas size
    const scale = size / VIEWBOX_SIZE;

    // Draw each dot at its calculated position
    for (const dot of dots) {
      ctx.fillStyle = dot.color;
      ctx.beginPath();
      ctx.arc(dot.cx * scale, dot.cy * scale, dot.r * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Type guard for StepData
   */
  private isStepData(pictograph: PictographData | StepData): pictograph is StepData {
    return "blueReversal" in pictograph || "redReversal" in pictograph;
  }

  /**
   * Simple string hash for cache keys
   * IMPORTANT: Must hash the FULL string to capture color differences
   * (colors are deep in the SVG content, not in the first 100 chars)
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return String(hash);
  }

  getMemoryUsage(): number {
    return this.memoryUsage;
  }

  dispose(): void {
    this.memoryUsage = 0;
    this.initialized = false;
  }
}

// DIRECT EXPORT - Use this instead of getCanvas2DRenderer()
// This avoids DI container rebuilds when this file changes
export const canvas2DDirectRenderer = new Canvas2DDirectRenderer();
