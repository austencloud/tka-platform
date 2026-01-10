/**
 * Canvas 2D Direct Renderer
 *
 * Renders pictographs directly to Canvas 2D without SVG intermediary.
 * Bypasses the expensive SVG-to-Canvas conversion by drawing paths directly.
 *
 * Performance target: ~100-150ms per fresh render (vs ~370ms with SVG)
 */

import type {
  IDirectRenderer,
  DirectRenderOptions,
  RenderTiming,
  ArrowPathsData,
  ArrowPathData,
} from "../contracts/IDirectRenderer";
import type { PictographData } from "../../../../pictograph/shared/domain/models/PictographData";
import type { BeatData } from "../../../../../features/create/shared/domain/models/BeatData";
import { drawPathCommands, type PathCommand } from "../../utils/svg-path-parser";

// Colors
const BLUE_COLOR = "#2E3192"; // Default arrow blue
const RED_COLOR = "#ED1C24"; // Arrow red
const GRID_COLOR_DARK = "#808080";
const GRID_COLOR_LIGHT = "#404040";
const BACKGROUND_DARK = "#000000";
const BACKGROUND_LIGHT = "#FFFFFF";

// Grid dimensions
const GRID_POINTS = 8;
const GRID_CENTER = 0.5; // Center position as fraction of size

export class Canvas2DDirectRenderer implements IDirectRenderer {
  private arrowPaths: ArrowPathsData | null = null;
  private initialized = false;
  private memoryUsage = 0;

  getName(): string {
    return "canvas2d";
  }

  isSupported(): boolean {
    // Canvas 2D is universally supported
    if (typeof document === "undefined") return false;
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("2d");
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load arrow path data
    try {
      const response = await fetch("/src/lib/shared/render/data/arrow-paths.json");
      if (!response.ok) {
        // Try alternative path for production builds
        const altResponse = await fetch("/data/arrow-paths.json");
        if (altResponse.ok) {
          this.arrowPaths = await altResponse.json();
        }
      } else {
        this.arrowPaths = await response.json();
      }

      if (this.arrowPaths) {
        this.memoryUsage = JSON.stringify(this.arrowPaths).length;
        console.log(`[Canvas2D] Loaded ${Object.keys(this.arrowPaths.arrows).length} arrow paths`);
      }
    } catch (err) {
      console.warn("[Canvas2D] Failed to load arrow paths, will fall back to default rendering:", err);
    }

    this.initialized = true;
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

    // Setup
    const setupStart = performance.now();
    const canvas = document.createElement("canvas");
    canvas.width = options.size;
    canvas.height = options.size;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }

    timing.setupMs = performance.now() - setupStart;

    // Draw
    const drawStart = performance.now();
    await this.drawPictograph(ctx, pictograph, options);
    timing.drawMs = performance.now() - drawStart;

    // Finalize (nothing to do for Canvas 2D)
    timing.finalizeMs = 0;

    timing.totalMs = performance.now() - totalStart;

    return { canvas, timing };
  }

  /**
   * Main drawing function
   */
  private async drawPictograph(
    ctx: CanvasRenderingContext2D,
    pictograph: PictographData | BeatData,
    options: DirectRenderOptions
  ): Promise<void> {
    const { size, visibility } = options;
    const isDarkMode = visibility.darkMode ?? true;

    // 1. Draw background
    ctx.fillStyle = isDarkMode ? BACKGROUND_DARK : BACKGROUND_LIGHT;
    ctx.fillRect(0, 0, size, size);

    // 2. Draw grid
    this.drawGrid(ctx, size, isDarkMode, pictograph.gridMode ?? "diamond");

    // 3. Draw props (if any)
    // TODO: Implement prop drawing when we extract prop paths

    // 4. Draw arrows
    if (pictograph.blueMotionData) {
      const arrowId = this.getArrowId(pictograph.blueMotionData);
      if (arrowId && this.arrowPaths?.arrows[arrowId]) {
        this.drawArrow(ctx, this.arrowPaths.arrows[arrowId], size, BLUE_COLOR, pictograph.blueMotionData);
      }
    }

    if (pictograph.redMotionData) {
      const arrowId = this.getArrowId(pictograph.redMotionData);
      if (arrowId && this.arrowPaths?.arrows[arrowId]) {
        this.drawArrow(ctx, this.arrowPaths.arrows[arrowId], size, RED_COLOR, pictograph.redMotionData);
      }
    }

    // 5. Draw TKA glyph (if enabled)
    if (visibility.showTKA && pictograph.letter) {
      this.drawTKAGlyph(ctx, pictograph.letter, size, isDarkMode);
    }

    // 6. Draw turn numbers (if enabled)
    if (visibility.showTKA) {
      this.drawTurns(ctx, pictograph, size, isDarkMode);
    }

    // 7. Draw reversal indicators (if enabled)
    if (visibility.showReversals) {
      this.drawReversalIndicators(ctx, pictograph, size, isDarkMode);
    }
  }

  /**
   * Draw the grid background
   */
  private drawGrid(
    ctx: CanvasRenderingContext2D,
    size: number,
    isDarkMode: boolean,
    gridMode: string
  ): void {
    const gridColor = isDarkMode ? GRID_COLOR_DARK : GRID_COLOR_LIGHT;
    const center = size / 2;
    const radius = size * 0.4; // Grid radius as fraction of size

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    // Draw diamond or box grid based on mode
    if (gridMode === "diamond" || gridMode === "box") {
      // Draw main axes
      ctx.beginPath();
      ctx.moveTo(center, center - radius);
      ctx.lineTo(center, center + radius);
      ctx.moveTo(center - radius, center);
      ctx.lineTo(center + radius, center);
      ctx.stroke();

      // Draw diagonal lines for diamond mode
      if (gridMode === "diamond") {
        const diag = radius * 0.707; // cos(45°)
        ctx.beginPath();
        ctx.moveTo(center - diag, center - diag);
        ctx.lineTo(center + diag, center + diag);
        ctx.moveTo(center - diag, center + diag);
        ctx.lineTo(center + diag, center - diag);
        ctx.stroke();
      }

      // Draw grid points (8 points around center)
      const pointRadius = size * 0.015;
      ctx.fillStyle = gridColor;

      for (let i = 0; i < GRID_POINTS; i++) {
        const angle = (i * Math.PI * 2) / GRID_POINTS - Math.PI / 2;
        const x = center + Math.cos(angle) * radius;
        const y = center + Math.sin(angle) * radius;

        ctx.beginPath();
        ctx.arc(x, y, pointRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw center point
      ctx.beginPath();
      ctx.arc(center, center, pointRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Draw an arrow using path data
   */
  private drawArrow(
    ctx: CanvasRenderingContext2D,
    arrowData: ArrowPathData,
    size: number,
    color: string,
    motionData: unknown
  ): void {
    if (!arrowData.paths || arrowData.paths.length === 0) return;

    ctx.save();

    // Calculate scale and position based on viewBox
    const viewBox = arrowData.viewBox || { x: 0, y: 0, width: 100, height: 100 };
    const scale = size / Math.max(viewBox.width, viewBox.height) * 0.5; // Arrows take ~50% of pictograph

    // Center the arrow
    const offsetX = (size - viewBox.width * scale) / 2 / scale - viewBox.x;
    const offsetY = (size - viewBox.height * scale) / 2 / scale - viewBox.y;

    // TODO: Apply rotation based on motion data (startLocation, endLocation)
    // This requires understanding the motion coordinate system

    ctx.fillStyle = color;

    for (const path of arrowData.paths) {
      if (path.commands && path.commands.length > 0) {
        drawPathCommands(ctx, path.commands as PathCommand[], offsetX, offsetY, scale);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Draw the TKA letter glyph
   */
  private drawTKAGlyph(
    ctx: CanvasRenderingContext2D,
    letter: string,
    size: number,
    isDarkMode: boolean
  ): void {
    // For now, draw as text - later can use actual glyph images
    const fontSize = size * 0.15;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isDarkMode ? "#FFFFFF" : "#000000";

    // Position in lower-left area
    const x = size * 0.15;
    const y = size * 0.85;
    ctx.fillText(letter, x, y);
  }

  /**
   * Draw turn numbers
   */
  private drawTurns(
    ctx: CanvasRenderingContext2D,
    pictograph: PictographData | BeatData,
    size: number,
    isDarkMode: boolean
  ): void {
    const fontSize = size * 0.08;
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Blue turns (left column)
    if (pictograph.blueMotionData?.turns !== undefined) {
      ctx.fillStyle = BLUE_COLOR;
      const turns = String(pictograph.blueMotionData.turns);
      ctx.fillText(turns, size * 0.08, size * 0.5);
    }

    // Red turns (right column)
    if (pictograph.redMotionData?.turns !== undefined) {
      ctx.fillStyle = RED_COLOR;
      const turns = String(pictograph.redMotionData.turns);
      ctx.fillText(turns, size * 0.92, size * 0.5);
    }
  }

  /**
   * Draw reversal indicators
   */
  private drawReversalIndicators(
    ctx: CanvasRenderingContext2D,
    pictograph: PictographData | BeatData,
    size: number,
    isDarkMode: boolean
  ): void {
    const indicatorSize = size * 0.05;
    const margin = size * 0.02;

    // Blue reversal (top-left)
    if ((pictograph as PictographData).blueReversal) {
      ctx.fillStyle = BLUE_COLOR;
      ctx.fillRect(margin, margin, indicatorSize, indicatorSize);
    }

    // Red reversal (top-left, offset right)
    if ((pictograph as PictographData).redReversal) {
      ctx.fillStyle = RED_COLOR;
      ctx.fillRect(margin + indicatorSize + margin, margin, indicatorSize, indicatorSize);
    }
  }

  /**
   * Get arrow ID from motion data
   */
  private getArrowId(motionData: { motionType?: string; turns?: number | string; orientation?: string }): string | null {
    if (!motionData.motionType) return null;

    const type = motionData.motionType.toLowerCase();
    const turns = motionData.turns ?? 0;
    const orientation = motionData.orientation ?? "radial";

    // Handle special cases
    if (type === "float") return "float";
    if (type === "dash") return "dash_base";
    if (type === "static") return `static_${turns}_${orientation}`;

    // Standard format: pro_0.0_radial, anti_1.5_nonradial, etc.
    return `${type}_${turns}_${orientation}`;
  }

  getMemoryUsage(): number {
    return this.memoryUsage;
  }

  dispose(): void {
    this.arrowPaths = null;
    this.memoryUsage = 0;
    this.initialized = false;
  }
}
