/**
 * IStepNumberRenderer
 *
 * Draws beat numbers as canvas text overlays on pictographs.
 *
 * This replaces the SVG-based StepNumber component for export/thumbnail rendering,
 * allowing base pictographs to be cached without beat numbers and then have
 * beat numbers composited at draw time.
 *
 * Styling matches StepNumber.svelte:
 * - Position: x=50, y=50 in 950x950 viewBox (scaled proportionally)
 * - Font: Georgia, serif, bold
 * - Size: 100 for numbers, 80 for "Start"
 * - Color: #ffffff (dark mode) or #231f20 (light mode)
 */

export interface IStepNumberRenderer {
  /**
   * Draw a beat number onto a canvas context
   *
   * @param ctx The canvas 2D rendering context
   * @param stepNumber The beat number to display (0 = "Start")
   * @param x The x position of the pictograph cell (top-left corner)
   * @param y The y position of the pictograph cell (top-left corner)
   * @param cellSize The size of the pictograph cell in pixels
   * @param isDarkMode Whether to use light text (dark mode) or dark text (light mode)
   */
  drawStepNumber(
    ctx: CanvasRenderingContext2D,
    stepNumber: number,
    x: number,
    y: number,
    cellSize: number,
    isDarkMode: boolean
  ): void;
}
