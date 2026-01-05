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
   * @param beatNumber - The beat number to render (0 = "Start", null = no render)
   * @param opacity - Optional opacity for crossfade effects (0-1, default: 1)
   */
  renderBeatNumberToCanvas(
    ctx: CanvasRenderingContext2D,
    canvasSize: number,
    beatNumber: number | null,
    opacity?: number
  ): void;

  /**
   * Render a word/sequence header onto the canvas at the top center
   * @param word - The word/sequence name to render (null/empty = no render)
   * @param darkMode - When true, uses dark background with light text
   */
  renderWordHeaderToCanvas(
    ctx: CanvasRenderingContext2D,
    canvasSize: number,
    word: string | null,
    darkMode?: boolean
  ): void;
}
