/**
 * TKA Image Export Rendering Interfaces
 *
 * Service contracts for beat rendering, image composition, canvas management,
 * and visual effects in the TKA image export system.
 */

// ============================================================================
// RENDERING SERVICES
// ============================================================================

/**
 * Font and typography management service
 * Equivalent to desktop FontMarginHelper
 */
export interface IFontManager {
  /**
   * Adjust font size and margin based on beat count
   */
  adjustFontAndMargin(
    baseFontSize: number,
    baseMargin: number,
    stepCount: number,
    stepScale: number
  ): { fontSize: number; margin: number };

  /**
   * Load and validate fonts
   */
  loadFonts(): Promise<void>;

  /**
   * Get font family for element type
   */
  getFontFamily(elementType: "word" | "userInfo" | "difficulty"): string;

  /**
   * Calculate font scaling for responsive text
   */
  calculateFontScaling(
    text: string,
    maxWidth: number,
    maxHeight: number,
    baseFontSize: number
  ): number;
}

// ============================================================================
// SERVICE INTERFACE SYMBOLS
// ============================================================================

export const IBeatRenderingServiceInterface = Symbol.for(
  "IBeatRenderingService"
);
export const ITextRendererInterface = Symbol.for("ITextRenderer");
export const IImageComposerInterface = Symbol.for("IImageComposer");
export const ICanvasManagerInterface = Symbol.for("ICanvasManager");
export const IReversalDetectorInterface = Symbol.for("IReversalDetector");
export const IFontManagerInterface = Symbol.for("IFontManager");
