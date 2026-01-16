/**
 * Composite Video Renderer Implementation
 *
 * Renders composite video frames with animation + grid side-by-side
 * and synchronized gold beat highlighting.
 *
 * Performance Optimization:
 * - Grid is rendered once and cached in an offscreen canvas
 * - Each frame only composites cached grid + current animation + highlight
 */

import type {
  ICompositeVideoRenderer,
  CompositeDimensions,
  CompositeLayoutOptions,
  StepGridPosition,
} from "../contracts/ICompositeVideoRenderer";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IImageComposer } from "$lib/shared/render/services/contracts/IImageComposer";
import type { IDimensionCalculator } from "$lib/shared/render/services/contracts/IDimensionCalculator";

export class CompositeVideoRenderer implements ICompositeVideoRenderer {
  private sequence: SequenceData | null = null;
  private options: CompositeLayoutOptions | null = null;
  private cachedGridCanvas: HTMLCanvasElement | null = null;
  private dimensions: CompositeDimensions | null = null;
  private gridDimensions: { width: number; height: number } | null = null;

  constructor(
    private ImageComposer: IImageComposer,
    private dimensionService: IDimensionCalculator
  ) {}

  async initialize(
    sequence: SequenceData,
    options: CompositeLayoutOptions
  ): Promise<void> {
    this.sequence = sequence;
    this.options = options;

    // Calculate grid dimensions based on sequence length
    const stepCount = sequence.steps.length;
    const cellSize = options.gridStepSize;

    // Calculate optimal grid layout (approximately square)
    const cols = Math.ceil(Math.sqrt(stepCount));
    const rows = Math.ceil(stepCount / cols);

    this.gridDimensions = {
      width: cols * cellSize,
      height: rows * cellSize,
    };

    // Calculate composite dimensions based on orientation
    if (options.orientation === "horizontal") {
      // Side-by-side: [animation | grid]
      // Use 1:1 aspect ratio for each pane
      const paneSize = Math.max(
        this.gridDimensions.width,
        this.gridDimensions.height
      );
      this.dimensions = {
        width: paneSize * 2, // Two panes
        height: paneSize,
      };
    } else {
      // Stacked: [animation] / [grid]
      const paneSize = Math.max(
        this.gridDimensions.width,
        this.gridDimensions.height
      );
      this.dimensions = {
        width: paneSize,
        height: paneSize * 2, // Two panes
      };
    }
  }

  async cacheStaticGrid(): Promise<void> {
    if (!this.sequence || !this.options || !this.gridDimensions) {
      throw new Error("CompositeVideoRenderer not initialized");
    }

    // Create offscreen canvas for grid
    this.cachedGridCanvas = document.createElement("canvas");
    this.cachedGridCanvas.width = this.gridDimensions.width;
    this.cachedGridCanvas.height = this.gridDimensions.height;

    // Render grid using ImageComposer
    // TODO: Configure options for grid rendering (no background, beat numbers if enabled)
    const renderOptions = {
      stepSize: this.options.gridStepSize,
      showStepNumbers: this.options.showStepNumbers,
      includeStartPosition: this.options.includeStartPosition,
      includeBackground: false,
      includeWord: false,
      includeUserInfo: false,
      includeDifficultyLevel: false,
    };

    const renderedGrid = await this.ImageComposer.composeSequenceImage(
      this.sequence,
      renderOptions
    );

    // Copy to cached canvas
    const ctx = this.cachedGridCanvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context");

    ctx.drawImage(renderedGrid, 0, 0);
  }

  renderCompositeFrame(
    animationCanvas: HTMLCanvasElement,
    currentStep: number,
    targetCanvas: HTMLCanvasElement
  ): void {
    if (!this.cachedGridCanvas || !this.dimensions || !this.options) {
      throw new Error(
        "CompositeVideoRenderer not initialized or grid not cached"
      );
    }

    const ctx = targetCanvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context");

    // Clear target canvas
    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

    // Set black background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

    if (this.options.orientation === "horizontal") {
      // Horizontal layout: [animation | grid]
      const halfWidth = this.dimensions.width / 2;

      // Draw animation on left half (centered and scaled to fit)
      this.drawCenteredImage(
        ctx,
        animationCanvas,
        0,
        0,
        halfWidth,
        this.dimensions.height
      );

      // Draw grid on right half
      this.drawCenteredImage(
        ctx,
        this.cachedGridCanvas,
        halfWidth,
        0,
        halfWidth,
        this.dimensions.height
      );

      // Draw beat highlight on grid pane
      const stepPos = this.getBeatGridPosition(currentStep);
      this.drawBeatHighlight(ctx, stepPos, halfWidth, 0);
    } else {
      // Vertical layout: [animation] / [grid]
      const halfHeight = this.dimensions.height / 2;

      // Draw animation on top half
      this.drawCenteredImage(
        ctx,
        animationCanvas,
        0,
        0,
        this.dimensions.width,
        halfHeight
      );

      // Draw grid on bottom half
      this.drawCenteredImage(
        ctx,
        this.cachedGridCanvas,
        0,
        halfHeight,
        this.dimensions.width,
        halfHeight
      );

      // Draw beat highlight on grid pane
      const stepPos = this.getBeatGridPosition(currentStep);
      this.drawBeatHighlight(ctx, stepPos, 0, halfHeight);
    }
  }

  getBeatGridPosition(stepIndex: number): StepGridPosition {
    if (!this.sequence || !this.options || !this.gridDimensions) {
      throw new Error("CompositeVideoRenderer not initialized");
    }

    const stepCount = this.sequence.steps.length;
    const cellSize = this.options.gridStepSize;

    // Calculate grid dimensions
    const cols = Math.ceil(Math.sqrt(stepCount));

    // Account for start position offset if included
    const offset = this.options.includeStartPosition ? 1 : 0;
    const adjustedStepIndex = stepIndex + offset;

    // Calculate column and row
    const col = adjustedStepIndex % cols;
    const row = Math.floor(adjustedStepIndex / cols);

    // Calculate pixel coordinates
    const x = col * cellSize;
    const y = row * cellSize;

    return {
      col,
      row,
      x,
      y,
      width: cellSize,
      height: cellSize,
    };
  }

  getCompositeDimensions(): CompositeDimensions {
    if (!this.dimensions) {
      throw new Error("CompositeVideoRenderer not initialized");
    }
    return { ...this.dimensions };
  }

  dispose(): void {
    this.cachedGridCanvas = null;
    this.sequence = null;
    this.options = null;
    this.dimensions = null;
    this.gridDimensions = null;
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Draw an image centered within a bounding box (maintains aspect ratio)
   */
  private drawCenteredImage(
    ctx: CanvasRenderingContext2D,
    image: HTMLCanvasElement,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number
  ): void {
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;

    const offsetX = x + (maxWidth - scaledWidth) / 2;
    const offsetY = y + (maxHeight - scaledHeight) / 2;

    ctx.drawImage(image, offsetX, offsetY, scaledWidth, scaledHeight);
  }

  /**
   * Draw gold highlight around current beat cell
   * Matches workspace preview styling (gold stroke + subtle fill)
   */
  private drawBeatHighlight(
    ctx: CanvasRenderingContext2D,
    stepPos: StepGridPosition,
    offsetX: number,
    offsetY: number
  ): void {
    if (!this.gridDimensions || !this.dimensions) return;

    // Calculate scale factor for grid within composite pane
    const paneWidth =
      this.options!.orientation === "horizontal"
        ? this.dimensions.width / 2
        : this.dimensions.width;
    const paneHeight =
      this.options!.orientation === "horizontal"
        ? this.dimensions.height
        : this.dimensions.height / 2;

    const scale = Math.min(
      paneWidth / this.gridDimensions.width,
      paneHeight / this.gridDimensions.height
    );

    // Center offset for scaled grid
    const gridOffsetX =
      offsetX + (paneWidth - this.gridDimensions.width * scale) / 2;
    const gridOffsetY =
      offsetY + (paneHeight - this.gridDimensions.height * scale) / 2;

    // Calculate highlight position and size
    const highlightX = gridOffsetX + stepPos.x * scale;
    const highlightY = gridOffsetY + stepPos.y * scale;
    const highlightWidth = stepPos.width * scale;
    const highlightHeight = stepPos.height * scale;

    // Gold highlight (matching workspace style)
    const goldColor = "#FFD700"; // Gold
    const padding = 4;

    // Draw subtle fill
    ctx.fillStyle = `${goldColor}20`; // 20 = ~12% opacity
    ctx.fillRect(
      highlightX + padding,
      highlightY + padding,
      highlightWidth - padding * 2,
      highlightHeight - padding * 2
    );

    // Draw gold stroke
    ctx.strokeStyle = goldColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(
      highlightX + padding,
      highlightY + padding,
      highlightWidth - padding * 2,
      highlightHeight - padding * 2
    );
  }
}
