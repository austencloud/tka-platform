/**
 * Canvas Renderer Service Contract
 *
 * Handles rendering of animation visualization on canvas.
 */

import type { PropState } from "../../shared/domain/types/PropState";

export interface ICanvasRenderer {
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
    bluePropViewBoxDimensions?: { width: number; height: number },
    redPropViewBoxDimensions?: { width: number; height: number }
  ): void;

  /**
   * Render a letter glyph onto the canvas at the standard position
   * @param letterImage - The letter image to render
   * @param letterViewBoxDimensions - ViewBox dimensions from the letter SVG
   * @param opacity - Optional opacity for crossfade effects (0-1, default: 1)
   */
  renderLetterToCanvas(
    ctx: CanvasRenderingContext2D,
    canvasSize: number,
    letterImage: HTMLImageElement,
    letterViewBoxDimensions: { width: number; height: number },
    opacity?: number
  ): void;

  /**
   * Render a beat number onto the canvas at the standard position (top-left)
   * @param stepNumber - The beat number to render (0 = "Start", null = no render)
   * @param opacity - Optional opacity for crossfade effects (0-1, default: 1)
   * @param darkMode - When true, uses light text for dark backgrounds
   */
  renderStepNumberToCanvas(
    ctx: CanvasRenderingContext2D,
    canvasSize: number,
    stepNumber: number | null,
    opacity?: number,
    darkMode?: boolean
  ): void;

  /**
   * Render a word/sequence header onto the canvas at the top center
   * @param word - The word/sequence name to render (null/empty = no render)
   * @param darkMode - When true, uses dark background with light text
   * @param activeStepNumber - 1-indexed beat number for letter highlighting (null = no highlighting)
   * @param difficultyLevel - Difficulty level (1-5) for the top-left badge (null = no badge)
   * @param loopComponents - Set of active LOOP component ids for the top-right icon strip (null/empty = no strip)
   * @param rotationSliceSize - When rotated is active, selects fa-arrows-spin (quartered) vs fa-rotate (halved)
   */
  renderWordHeaderToCanvas(
    ctx: CanvasRenderingContext2D,
    canvasSize: number,
    word: string | null,
    darkMode?: boolean,
    activeStepNumber?: number | null,
    difficultyLevel?: number | null,
    loopComponents?: Set<string> | null,
    rotationSliceSize?: import("$lib/features/create/generate/circular/domain/models/circular-models").SliceSize
  ): void;

  /**
   * Render a segmented progress bar onto the canvas
   * @param y - Y position to draw the progress bar
   * @param totalSteps - Total number of steps in the sequence
   * @param currentBeat - Current beat position (float, 0-based)
   * @param stepDurations - Duration of each step (defaults to 1 per step)
   * @param darkMode - When true, uses dark mode colors
   */
  renderProgressBarToCanvas(
    ctx: CanvasRenderingContext2D,
    canvasSize: number,
    y: number,
    totalSteps: number,
    currentBeat: number,
    stepDurations: number[],
    darkMode: boolean
  ): void;

  /**
   * Get the progress bar height for a given canvas size
   * Used to calculate total canvas dimensions for video export
   */
  getProgressBarHeight(canvasSize: number): number;

  /**
   * Get the header height for a given canvas size
   * Used to calculate total canvas dimensions for video export
   */
  getHeaderHeight(canvasSize: number): number;
}
