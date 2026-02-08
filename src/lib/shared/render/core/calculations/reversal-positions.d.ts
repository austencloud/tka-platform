/**
 * Reversal position calculator
 *
 * Calculates the positions of reversal indicator dots based on
 * which props have reversals (blue, red, or both).
 *
 * This is the SINGLE SOURCE OF TRUTH for reversal positioning.
 * Both Canvas2DDirectRenderer and MCP standalone-renderer use these values.
 */
export interface ReversalDotPosition {
    cx: number;
    cy: number;
    r: number;
    color: string;
}
export interface ReversalPositions {
    dots: ReversalDotPosition[];
}
/**
 * Calculate reversal indicator positions.
 *
 * Positioning rules (from ReversalIndicators.svelte):
 * - Single reversal: dot is centered vertically (at CENTER_Y)
 * - Both reversals: RED on top, BLUE on bottom, spaced by DOT_SPACING
 * - All dots are at X_POSITION (left edge)
 *
 * @param blueReversal - Whether blue motion has a reversal
 * @param redReversal - Whether red motion has a reversal
 * @param isDarkMode - Whether to use dark mode colors
 * @returns Object with array of dot positions (may be empty)
 */
export declare function calculateReversalPositions(blueReversal: boolean, redReversal: boolean, isDarkMode: boolean): ReversalPositions;
/**
 * Helper to get reversal colors for rendering.
 * Useful when you need the colors but not the positions.
 */
export declare function getReversalColors(isDarkMode: boolean): {
    blue: string;
    red: string;
};
