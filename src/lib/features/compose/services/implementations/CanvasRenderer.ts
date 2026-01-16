/**
 * Canvas Renderer for animation visualization
 * Based on the exact implementation from standalone_animator.html
 */

import type { PropState } from "../../shared/domain/types/PropState";
import type { ICanvasRenderer } from "../contracts/ICanvasRenderer";
import { simplifyRepeatedWord } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";

// Constants from standalone_animator.html
// Using "strict" hand point offset (actual hand position, further from center)
// From gridCoordinates.ts: n_diamond_hand_point_strict at (475, 325.0) = 152px from center
const GRID_HALFWAY_POINT_OFFSET = 150;

export class CanvasRenderer implements ICanvasRenderer {
  /**
   * Render the complete animation scene
   * @param bluePropViewBoxDimensions - ViewBox dimensions from the blue prop SVG (default: staff 252.8 x 77.8)
   * @param redPropViewBoxDimensions - ViewBox dimensions from the red prop SVG (default: staff 252.8 x 77.8)
   */
  renderScene(
    ctx: CanvasRenderingContext2D,
    canvasSize: number,
    gridVisible: boolean,
    gridImage: HTMLImageElement | null,
    blueStaffImage: HTMLImageElement | null,
    redStaffImage: HTMLImageElement | null,
    blueProp: PropState | null,
    redProp: PropState | null,
    bluePropViewBoxDimensions: { width: number; height: number } = {
      width: 252.8,
      height: 77.8,
    },
    redPropViewBoxDimensions: { width: number; height: number } = {
      width: 252.8,
      height: 77.8,
    }
  ): void {
    // Rendering logging removed - too noisy, use beat transition logging instead

    // Clear canvas exactly as in standalone
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Draw white background (required for GIF export)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Draw grid exactly as in standalone
    this.drawGrid(ctx, canvasSize, gridVisible, gridImage);

    // Draw props with their viewBox dimensions (only if both image and prop state are available)
    if (blueStaffImage && blueProp) {
      this.drawStaff(
        ctx,
        canvasSize,
        blueProp,
        blueStaffImage,
        bluePropViewBoxDimensions
      );
    }

    if (redStaffImage && redProp) {
      this.drawStaff(
        ctx,
        canvasSize,
        redProp,
        redStaffImage,
        redPropViewBoxDimensions
      );
    }
  }

  /**
   * Render a letter glyph onto the canvas at the standard position
   * This is called separately during GIF export to overlay the glyph
   */
  renderLetterToCanvas(
    ctx: CanvasRenderingContext2D,
    canvasSize: number,
    letterImage: HTMLImageElement,
    letterViewBoxDimensions: { width: number; height: number },
    opacity: number = 1
  ): void {
    this.drawLetter(
      ctx,
      canvasSize,
      letterImage,
      letterViewBoxDimensions,
      opacity
    );
  }

  /**
   * Render a beat number onto the canvas at the standard position (top-left)
   * Matches StepNumber.svelte positioning: x=50, y=50 in 950px viewBox
   */
  renderStepNumberToCanvas(
    ctx: CanvasRenderingContext2D,
    canvasSize: number,
    stepNumber: number | null,
    opacity: number = 1,
    darkMode: boolean = false
  ): void {
    this.drawStepNumber(ctx, canvasSize, stepNumber, opacity, darkMode);
  }

  /**
   * Render a word/sequence header onto the canvas at the top center
   * Matches WordHeader.svelte styling: semi-transparent background, centered Georgia Bold text
   */
  renderWordHeaderToCanvas(
    ctx: CanvasRenderingContext2D,
    canvasSize: number,
    word: string | null,
    darkMode: boolean = false
  ): void {
    this.drawWordHeader(ctx, canvasSize, word, darkMode);
  }

  /**
   * Draw grid exactly as in standalone_animator.html
   */
  private drawGrid(
    ctx: CanvasRenderingContext2D,
    canvasSize: number,
    gridVisible: boolean,
    gridImage: HTMLImageElement | null
  ): void {
    if (!gridVisible || !gridImage) return;
    ctx.drawImage(gridImage, 0, 0, canvasSize, canvasSize);
  }

  /**
   * Draw prop with proper aspect ratio preservation
   * The prop's length (height in viewBox) is constrained to fit between center and outer point,
   * and the width is scaled proportionally to preserve the aspect ratio.
   *
   * For dash motions, uses pre-calculated Cartesian x,y coordinates for straight-line movement.
   * For other motions, calculates position from angle using polar coordinates.
   */
  private drawStaff(
    ctx: CanvasRenderingContext2D,
    canvasSize: number,
    propState: PropState,
    staffImage: HTMLImageElement,
    viewBoxDimensions: { width: number; height: number }
  ): void {
    // Calculate position
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const inwardFactor = 0.95;
    const gridScaleFactor = canvasSize / 950; // 950 is the viewBox size
    const scaledHalfwayRadius = GRID_HALFWAY_POINT_OFFSET * gridScaleFactor;

    // Use pre-calculated x,y if provided (dash motions), otherwise calculate from angle
    let x: number, y: number;
    if (propState.x !== undefined && propState.y !== undefined) {
      // Dash motion: use Cartesian coordinates directly (already in unit circle space)
      x = centerX + propState.x * scaledHalfwayRadius * inwardFactor;
      y = centerY + propState.y * scaledHalfwayRadius * inwardFactor;
    } else {
      // Regular motion: calculate from angle using polar coordinates
      x =
        centerX +
        Math.cos(propState.centerPathAngle) *
          scaledHalfwayRadius *
          inwardFactor;
      y =
        centerY +
        Math.sin(propState.centerPathAngle) *
          scaledHalfwayRadius *
          inwardFactor;
    }

    // Scale the prop dimensions from viewBox coordinate space to canvas pixels
    // This preserves the aspect ratio of the prop
    const propWidth = viewBoxDimensions.width * gridScaleFactor;
    const propHeight = viewBoxDimensions.height * gridScaleFactor;

    // Calculate center point from viewBox dimensions
    const propCenterX = viewBoxDimensions.width / 2;
    const propCenterY = viewBoxDimensions.height / 2;

    // Draw the prop
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(propState.staffRotationAngle);
    ctx.drawImage(
      staffImage,
      -propCenterX * gridScaleFactor,
      -propCenterY * gridScaleFactor,
      propWidth,
      propHeight
    );
    ctx.restore();
  }

  /**
   * Draw letter glyph in the bottom-left area of the canvas
   * Position matches the SVG overlay positioning: x=50, y=800 in 952px viewBox
   */
  private drawLetter(
    ctx: CanvasRenderingContext2D,
    canvasSize: number,
    letterImage: HTMLImageElement,
    letterViewBoxDimensions: { width: number; height: number },
    opacity: number = 1
  ): void {
    const gridScaleFactor = canvasSize / 950; // 950 is the viewBox size

    // Position matches TKAGlyph.svelte defaults: x=50, y=800 in 952px viewBox
    const x = 50 * gridScaleFactor;
    const y = 800 * gridScaleFactor;

    // Scale letter to match canvas size relative to 952px viewBox (same as props and grid)
    // All SVGs are designed relative to the 950×950 viewBox, so we use gridScaleFactor consistently
    const scaledWidth = letterViewBoxDimensions.width * gridScaleFactor;
    const scaledHeight = letterViewBoxDimensions.height * gridScaleFactor;

    // Apply opacity for crossfade effects
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(letterImage, x, y, scaledWidth, scaledHeight);
    ctx.restore();
  }

  /**
   * Draw beat number in the top-left area of the canvas
   * Position matches StepNumber.svelte: x=50, y=50 in 950px viewBox
   * Style matches: Georgia serif, bold, fill only (no stroke) with dark mode support
   */
  private drawStepNumber(
    ctx: CanvasRenderingContext2D,
    canvasSize: number,
    stepNumber: number | null,
    opacity: number = 1,
    darkMode: boolean = false
  ): void {
    if (stepNumber === null) return;

    const gridScaleFactor = canvasSize / 950;

    // Position matches StepNumber.svelte: x=50, y=50 in 950px viewBox
    const x = 50 * gridScaleFactor;
    const y = 50 * gridScaleFactor;

    // Font size matches StepNumber.svelte: 100 for numbers, 80 for "Start"
    const isStart = stepNumber === 0;
    const fontSize = (isStart ? 80 : 100) * gridScaleFactor;
    const displayText = isStart ? "Start" : stepNumber.toString();

    ctx.save();

    // Apply opacity for crossfade effects
    ctx.globalAlpha = opacity;

    // Set font style to match StepNumber.svelte
    ctx.font = `bold ${fontSize}px Georgia, serif`;
    ctx.textBaseline = "hanging";
    ctx.textAlign = "start";

    // Fill color based on dark mode (matches StepNumber.svelte)
    // Dark mode: white (#ffffff), Light mode: dark gray (#231f20)
    ctx.fillStyle = darkMode ? "#ffffff" : "#231f20";
    ctx.fillText(displayText, x, y);

    ctx.restore();
  }

  /**
   * Draw word header as a full-width bar at the top of the canvas
   * Style matches WordHeader.svelte: full-width gradient background, centered Georgia Bold text
   * Light mode: dark text on light gradient background
   * Dark mode: white text on dark gradient background
   *
   * Uses simplifyRepeatedWord to handle repeated words (e.g., "ABAB" → "AB")
   * Does NOT truncate - allows full word length when needed for uniqueness.
   *
   * @param headerHeight - Height of the header bar (typically ~5% of canvas width)
   */
  private drawWordHeader(
    ctx: CanvasRenderingContext2D,
    canvasSize: number,
    word: string | null,
    darkMode: boolean
  ): void {
    if (!word || word.trim() === "") return;

    // Simplify repeated patterns (no truncation), then uppercase
    const displayText = simplifyRepeatedWord(word).toUpperCase();

    // Header height matches WordHeader.svelte padding + font size (~5% of width)
    const headerHeight = canvasSize * 0.05;
    const fontSize = headerHeight * 0.55; // Font takes ~55% of header height

    ctx.save();

    // Draw full-width gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, headerHeight);
    if (darkMode) {
      gradient.addColorStop(0, "rgba(15, 15, 20, 0.98)");
      gradient.addColorStop(1, "rgba(10, 10, 15, 0.98)");
    } else {
      gradient.addColorStop(0, "rgba(248, 248, 248, 0.98)");
      gradient.addColorStop(1, "rgba(240, 240, 240, 0.98)");
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasSize, headerHeight);

    // Draw bottom border
    ctx.strokeStyle = darkMode
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(0, 0, 0, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(canvasSize, headerHeight);
    ctx.stroke();

    // Draw centered text
    ctx.font = `bold ${fontSize}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = `${fontSize * 0.08}px`; // 0.08em letter-spacing
    ctx.fillStyle = darkMode ? "#ffffff" : "#1f2937";
    ctx.fillText(displayText, canvasSize / 2, headerHeight / 2);

    ctx.restore();
  }

  /**
   * Get the header height for a given canvas size
   * Used by VideoExportOrchestrator to calculate total canvas dimensions
   */
  getHeaderHeight(canvasSize: number): number {
    return canvasSize * 0.05;
  }
}
