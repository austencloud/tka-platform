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
 * 8. BeatNumber (x=50, y=50)
 * 9. ReversalIndicators
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
import type { BeatData } from "../../../../features/create/shared/domain/models/BeatData";
import type { PreparedPictographData } from "../../../pictograph/shared/domain/models/PreparedPictographData";
import { GridMode } from "../../../pictograph/grid/domain/enums/grid-enums";
import { getSvgImageCache } from "./SvgImageCache";
import { getSvgAssetLoader } from "./SvgAssetLoader";
import { getLetterImagePath, isDashLetter } from "../../../pictograph/tka-glyph/utils/letter-image-getter";
import type { Letter } from "../../../foundation/domain/models/Letter";
import { container } from "../../../di";
import type { IPictographPreparer } from "../../../pictograph/shared/services/contracts/IPictographPreparer";
import type { ITurnsTupleGenerator } from "../../../pictograph/arrow/positioning/placement/services/contracts/ITurnsTupleGenerator";
import { parseTurnsTuple, shouldDisplayTurn, getTurnNumberImagePath, getTurnNumberWidth } from "../../../pictograph/tka-glyph/utils/turn-tuple-parser";
import { TurnColorInterpreter } from "../../../pictograph/tka-glyph/services/implementations/TurnColorInterpreter";
import { calculateTurnPositions } from "../../../pictograph/tka-glyph/utils/turn-position-calculator";

// Constants matching the SVG system
const VIEWBOX_SIZE = 950;

// Overflow ratio for arrow/prop SVGs - expand their viewBox to capture content beyond bounds
// SVG's overflow:visible isn't respected when converting to image, so we expand the viewBox
const SVG_OVERFLOW_RATIO = 0.15;

// TKA Glyph positioning (from TKAGlyph.svelte defaults)
const TKA_GLYPH_X = 50;
const TKA_GLYPH_Y = 800;
const TKA_GLYPH_SCALE = 1;

// Beat number positioning (from BeatNumber.svelte)
const BEAT_NUMBER_X = 50;
const BEAT_NUMBER_Y = 50;
const BEAT_NUMBER_FONT_SIZE = 100;
const BEAT_NUMBER_START_FONT_SIZE = 80;

// Direction dot constants (from DirectionDot.svelte)
const DOT_PADDING = 10;
const DOT_SIZE = 25;

// Turn number height (from TurnsColumn.svelte)
const TURN_NUMBER_HEIGHT = 45;

// Colors
const BLUE_COLOR = "#2E77AE";
const RED_COLOR = "#ED1C24";

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

  getName(): string {
    return "canvas2d";
  }

  isSupported(): boolean {
    if (typeof document === "undefined") return false;
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("2d");
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize the asset loader (pre-loads grids)
    const assetLoader = getSvgAssetLoader();
    await assetLoader.initialize();

    this.initialized = true;
    console.log("[Canvas2D] Initialized with SVG assets");
  }

  async renderPictograph(
    pictograph: PictographData | BeatData,
    options: DirectRenderOptions
  ): Promise<HTMLCanvasElement> {
    const { canvas } = await this.renderPictographWithTiming(pictograph, options);
    return canvas;
  }

  async renderPictographWithTiming(
    pictograph: PictographData | BeatData,
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
    pictograph: PictographData | BeatData,
    options: DirectRenderOptions
  ): Promise<PreparedPictographData> {
    const asPrepared = pictograph as PreparedPictographData;

    // If already prepared, return as-is
    if (asPrepared._prepared) {
      return asPrepared;
    }

    // Get PictographPreparer from DI container
    try {
      const preparer = container.items.pictographPreparer as IPictographPreparer;
      const prepared = await preparer.prepareSingle(pictograph, {
        themeMode: options.visibility.darkMode ? "dark" : "light",
        bluePropType: options.visibility.bluePropType,
        redPropType: options.visibility.redPropType,
      });
      return prepared;
    } catch (error) {
      console.warn("[Canvas2D] Failed to prepare pictograph:", error);
      return asPrepared;
    }
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
      this.drawBaseGridOnly(ctx, size, isDarkMode);
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

    // 6. Draw turn numbers (TurnsColumn - to the RIGHT of letter)
    if (visibility.showTKA && preparedPictograph.motions) {
      await this.drawTurnsColumn(ctx, preparedPictograph, letterDimensions, scale, isDarkMode);
    }

    // 7. Draw direction dot (same/opp indicator)
    if (visibility.showTKA && preparedPictograph.letter && preparedPictograph.motions) {
      this.drawDirectionDot(ctx, preparedPictograph, letterDimensions, scale, isDarkMode);
    }

    // 8. Draw beat number (top-left corner at x=50, y=50)
    const beatData = preparedPictograph as BeatData;
    if (typeof beatData.beatNumber === "number") {
      this.drawBeatNumber(ctx, beatData.beatNumber, scale, isDarkMode);
    }

    // 9. Draw reversal indicators
    if (visibility.showReversals && this.isBeatData(preparedPictograph)) {
      this.drawReversalIndicators(ctx, preparedPictograph as BeatData, size);
    }

    // Log timing breakdown for slow renders
    const totalTime = performance.now() - totalStart;
    if (totalTime > 50) {
      console.log(
        `[Canvas2D] Slow render ${totalTime.toFixed(0)}ms: ` +
        `prepare=${prepareTime.toFixed(0)}ms, grid=${gridTime.toFixed(0)}ms, ` +
        `props=${propsTime.toFixed(0)}ms, arrows=${arrowsTime.toFixed(0)}ms, glyph=${glyphTime.toFixed(0)}ms`
      );
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
      } else {
        ctx.filter = "opacity(0.7)";
      }

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
        } else {
          ctx.filter = "opacity(0.7)";
        }

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
    isDarkMode: boolean
  ): void {
    const scale = size / VIEWBOX_SIZE;
    const pointColor = isDarkMode ? GRID_POINT_COLOR_DARK : GRID_POINT_COLOR_LIGHT;

    // Set opacity to match grid SVG rendering
    ctx.save();
    ctx.globalAlpha = isDarkMode ? 0.85 : 0.7;
    ctx.fillStyle = pointColor;

    // Draw center point
    const center = BASE_GRID_POINTS.center;
    ctx.beginPath();
    ctx.arc(center.x * scale, center.y * scale, center.r * scale, 0, Math.PI * 2);
    ctx.fill();

    // Draw outer points (corners)
    for (const point of Object.values(BASE_GRID_POINTS.outer)) {
      ctx.beginPath();
      ctx.arc(point.x * scale, point.y * scale, point.r * scale, 0, Math.PI * 2);
      ctx.fill();
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

    for (const color of ["blue", "red"]) {
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
    canvasSize: number
  ): Promise<void> {
    const { arrowPositions, arrowAssets, arrowMirroring } = prepared;
    const svgCache = getSvgImageCache();
    const scale = canvasSize / VIEWBOX_SIZE;

    for (const color of ["blue", "red"]) {
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
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
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
    let turnsTuple = "(s, 0, 0)";
    try {
      const generator = container.items.turnsTupleGenerator as ITurnsTupleGenerator;
      if (generator) {
        turnsTuple = generator.generateTurnsTuple(pictograph);
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
            const drawX = baseX + positions.top.x * scale;
            const drawY = baseY + positions.top.y * scale;
            const drawWidth = columnWidth * scale;
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
            const drawX = baseX + positions.bottom.x * scale;
            const drawY = baseY + positions.bottom.y * scale;
            const drawWidth = columnWidth * scale;
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
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string
  ): void {
    // Create offscreen canvas to apply color
    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
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
    let turnsTuple = "(s, 0, 0)";
    try {
      const generator = container.items.turnsTupleGenerator as ITurnsTupleGenerator;
      if (generator) {
        turnsTuple = generator.generateTurnsTuple(pictograph);
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
   * Draw beat number at x=50, y=50 (matching BeatNumber.svelte)
   */
  private drawBeatNumber(
    ctx: CanvasRenderingContext2D,
    beatNumber: number,
    scale: number,
    isDarkMode: boolean
  ): void {
    // Beat 0 shows "Start", beat -1 is hidden
    if (beatNumber === -1) return;

    const text = beatNumber === 0 ? "Start" : String(beatNumber);
    const fontSize = (beatNumber === 0 ? BEAT_NUMBER_START_FONT_SIZE : BEAT_NUMBER_FONT_SIZE) * scale;

    ctx.font = `bold ${fontSize}px Georgia, serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = isDarkMode ? "#ffffff" : "#231f20";

    const x = BEAT_NUMBER_X * scale;
    const y = BEAT_NUMBER_Y * scale;
    ctx.fillText(text, x, y);
  }

  /**
   * Draw reversal indicators
   */
  private drawReversalIndicators(
    ctx: CanvasRenderingContext2D,
    beatData: BeatData,
    size: number
  ): void {
    const indicatorSize = size * 0.04;
    const margin = size * 0.02;
    const y = size - indicatorSize - margin;

    if (beatData.blueReversal) {
      ctx.fillStyle = BLUE_COLOR;
      ctx.beginPath();
      ctx.arc(margin + indicatorSize / 2, y + indicatorSize / 2, indicatorSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (beatData.redReversal) {
      ctx.fillStyle = RED_COLOR;
      const x = beatData.blueReversal ? margin * 2 + indicatorSize : margin;
      ctx.beginPath();
      ctx.arc(x + indicatorSize / 2, y + indicatorSize / 2, indicatorSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Type guard for BeatData
   */
  private isBeatData(pictograph: PictographData | BeatData): pictograph is BeatData {
    return "blueReversal" in pictograph || "redReversal" in pictograph;
  }

  /**
   * Simple string hash for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < Math.min(str.length, 100); i++) {
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
