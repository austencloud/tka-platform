/**
 * VideoFrameRenderer
 *
 * Renders animation frames to a canvas for video encoding.
 * Uses Canvas 2D API for reliable, consistent rendering across all devices.
 *
 * The rendering pipeline:
 * 1. Pre-calculate all trail points using TrailPathGenerator
 * 2. For each frame:
 *    a. Clear canvas
 *    b. Draw grid
 *    c. Draw trails (with fade/glow effects)
 *    d. Draw props at current position
 *    e. Capture frame
 *
 * This ensures consistent output regardless of device performance.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ISequenceAnimationOrchestrator } from "../contracts/ISequenceAnimationOrchestrator";
import {
  TrailPathGenerator,
  type GeneratedTrailData,
  type TrailPoint,
} from "./TrailPathGenerator";

// Standard coordinate system
const VIEWBOX_SIZE = 950;
const GRID_HALFWAY_POINT_OFFSET = 150;

/**
 * Configuration for video rendering
 */
export interface VideoRenderConfig {
  /** Canvas width/height in pixels */
  canvasSize: number;
  /** Frames per second */
  fps: number;
  /** Background color (default: white) */
  backgroundColor?: string;
  /** Whether to draw the grid */
  showGrid?: boolean;
  /** Whether to draw trails */
  showTrails?: boolean;
  /** Maximum trail length in points */
  maxTrailLength?: number;
  /** Trail line width */
  trailWidth?: number;
  /** Prop dimensions */
  bluePropDimensions: { width: number; height: number };
  redPropDimensions: { width: number; height: number };
}

/**
 * Progress callback for video generation
 */
export interface RenderProgress {
  currentFrame: number;
  totalFrames: number;
  percent: number;
  phase: "preparing" | "rendering" | "encoding";
}

export class VideoFrameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private trailGenerator: TrailPathGenerator;
  private trailData: GeneratedTrailData | null = null;
  private config: VideoRenderConfig;
  private orchestrator: ISequenceAnimationOrchestrator;

  constructor(
    orchestrator: ISequenceAnimationOrchestrator,
    config: VideoRenderConfig
  ) {
    this.orchestrator = orchestrator;
    this.config = {
      backgroundColor: "#ffffff",
      showGrid: true,
      showTrails: true,
      maxTrailLength: 500,
      trailWidth: 3,
      ...config,
    };

    // Create offscreen canvas
    this.canvas = document.createElement("canvas");
    this.canvas.width = config.canvasSize;
    this.canvas.height = config.canvasSize;

    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }
    this.ctx = ctx;

    this.trailGenerator = new TrailPathGenerator();
  }

  /**
   * Prepare for rendering by pre-calculating all trail data
   */
  prepareSequence(sequence: SequenceData): void {
    this.trailData = this.trailGenerator.generateTrailsForSequence(
      this.orchestrator,
      sequence,
      {
        canvasSize: this.config.canvasSize,
        samplesPerStep: 120, // High resolution for smooth trails
        bluePropDimensions: this.config.bluePropDimensions,
        redPropDimensions: this.config.redPropDimensions,
      }
    );
  }

  /**
   * Render a single frame at the specified beat position
   *
   * @param beat - Current beat position (can be fractional, e.g., 1.5)
   * @returns The canvas with the rendered frame
   */
  renderFrame(beat: number): HTMLCanvasElement {
    const { canvasSize, backgroundColor, showGrid, showTrails } = this.config;

    // Clear canvas
    this.ctx.fillStyle = backgroundColor!;
    this.ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Draw grid
    if (showGrid) {
      this.drawGrid();
    }

    // Draw trails
    if (showTrails && this.trailData) {
      const trails = this.trailGenerator.getTrailPointsAtBeat(
        this.trailData,
        beat,
        this.config.maxTrailLength
      );

      // Blue trails (combine left and right for visual effect)
      this.drawTrail(trails.blueLeft, "#2563eb", 0.8); // Blue-600
      this.drawTrail(trails.blueRight, "#3b82f6", 0.6); // Blue-500 lighter

      // Red trails
      this.drawTrail(trails.redLeft, "#dc2626", 0.8); // Red-600
      this.drawTrail(trails.redRight, "#ef4444", 0.6); // Red-500 lighter
    }

    // Get prop states and draw props
    this.orchestrator.calculateState(beat);
    const blueState = this.orchestrator.getBluePropState();
    const redState = this.orchestrator.getRedPropState();

    this.drawProp(blueState, "#2563eb", this.config.bluePropDimensions);
    this.drawProp(redState, "#dc2626", this.config.redPropDimensions);

    return this.canvas;
  }

  /**
   * Generate all frames for a sequence
   *
   * @param sequence - The sequence to render
   * @param onProgress - Progress callback
   * @returns Array of ImageData for each frame
   */
  async generateAllFrames(
    sequence: SequenceData,
    onProgress?: (progress: RenderProgress) => void
  ): Promise<ImageData[]> {
    const totalSteps = sequence.steps.length ?? 0;
    if (totalSteps === 0) {
      return [];
    }

    // Prepare trail data
    onProgress?.({
      currentFrame: 0,
      totalFrames: 0,
      percent: 0,
      phase: "preparing",
    });

    this.prepareSequence(sequence);

    // Calculate total frames
    const { fps } = this.config;
    const durationSeconds = totalSteps; // 1 beat = 1 second at speed 1
    const totalFrames = Math.ceil(durationSeconds * fps);
    const frames: ImageData[] = [];

    onProgress?.({
      currentFrame: 0,
      totalFrames,
      percent: 0,
      phase: "rendering",
    });

    // Render each frame
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const beat = frameIndex / fps; // Convert frame to beat position

      this.renderFrame(beat);

      // Capture frame data
      const imageData = this.ctx.getImageData(
        0,
        0,
        this.config.canvasSize,
        this.config.canvasSize
      );
      frames.push(imageData);

      // Report progress
      if (frameIndex % 10 === 0) {
        onProgress?.({
          currentFrame: frameIndex,
          totalFrames,
          percent: (frameIndex / totalFrames) * 100,
          phase: "rendering",
        });

        // Yield to prevent blocking UI
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    onProgress?.({
      currentFrame: totalFrames,
      totalFrames,
      percent: 100,
      phase: "rendering",
    });

    return frames;
  }

  /**
   * Draw the diamond grid
   */
  private drawGrid(): void {
    const { canvasSize } = this.config;
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const gridScaleFactor = canvasSize / VIEWBOX_SIZE;

    // Grid line style
    this.ctx.strokeStyle = "rgba(200, 200, 200, 0.5)";
    this.ctx.lineWidth = 1;

    // Draw diamond shape
    const size = 300 * gridScaleFactor;

    this.ctx.beginPath();
    this.ctx.moveTo(centerX, centerY - size); // Top
    this.ctx.lineTo(centerX + size, centerY); // Right
    this.ctx.lineTo(centerX, centerY + size); // Bottom
    this.ctx.lineTo(centerX - size, centerY); // Left
    this.ctx.closePath();
    this.ctx.stroke();

    // Draw center cross
    this.ctx.beginPath();
    this.ctx.moveTo(centerX - size, centerY);
    this.ctx.lineTo(centerX + size, centerY);
    this.ctx.moveTo(centerX, centerY - size);
    this.ctx.lineTo(centerX, centerY + size);
    this.ctx.stroke();

    // Draw hand position circle
    const handRadius = GRID_HALFWAY_POINT_OFFSET * gridScaleFactor;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, handRadius, 0, Math.PI * 2);
    this.ctx.strokeStyle = "rgba(150, 150, 150, 0.3)";
    this.ctx.stroke();
  }

  /**
   * Draw a trail with gradient fade effect
   */
  private drawTrail(points: TrailPoint[], color: string, alpha: number): void {
    if (points.length < 2) return;

    const { trailWidth } = this.config;

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = trailWidth!;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    // Draw trail with fading opacity
    for (let i = 1; i < points.length; i++) {
      const prevPoint = points[i - 1]!;
      const point = points[i]!;

      // Fade from transparent (old) to opaque (new)
      const segmentAlpha = (i / points.length) * alpha;

      this.ctx.beginPath();
      this.ctx.strokeStyle = this.hexToRgba(color, segmentAlpha);
      this.ctx.moveTo(prevPoint.x, prevPoint.y);
      this.ctx.lineTo(point.x, point.y);
      this.ctx.stroke();
    }
  }

  /**
   * Draw a prop (as a rounded rectangle)
   */
  private drawProp(
    propState: {
      centerPathAngle: number;
      staffRotationAngle: number;
      x?: number;
      y?: number;
    },
    color: string,
    dimensions: { width: number; height: number }
  ): void {
    const { canvasSize } = this.config;
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const gridScaleFactor = canvasSize / VIEWBOX_SIZE;
    const scaledRadius = GRID_HALFWAY_POINT_OFFSET * gridScaleFactor;

    // Calculate prop center position
    let propX: number, propY: number;

    if (propState.x !== undefined && propState.y !== undefined) {
      // Dash motion: use Cartesian coordinates
      propX = centerX + propState.x * scaledRadius;
      propY = centerY + propState.y * scaledRadius;
    } else {
      // Regular motion: calculate from angle
      propX = centerX + Math.cos(propState.centerPathAngle) * scaledRadius;
      propY = centerY + Math.sin(propState.centerPathAngle) * scaledRadius;
    }

    // Scale prop dimensions
    const propWidth = dimensions.width * gridScaleFactor;
    const propHeight = dimensions.height * gridScaleFactor;

    // Draw prop as rounded rectangle
    this.ctx.save();
    this.ctx.translate(propX, propY);
    this.ctx.rotate(propState.staffRotationAngle);

    // Draw prop body
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.roundRect(
      -propWidth / 2,
      -propHeight / 2,
      propWidth,
      propHeight,
      propHeight / 2 // Round the ends
    );
    this.ctx.fill();

    // Draw prop outline
    this.ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Helper to draw rounded rectangle (for prop shape)
   */
  private roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(
      x + width,
      y + height,
      x + width - radius,
      y + height
    );
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }

  /**
   * Convert hex color to rgba
   */
  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Get the canvas for direct access (e.g., for MediaRecorder)
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.trailData = null;
  }
}
