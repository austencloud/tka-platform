/**
 * Glyph positioning constants for pictograph rendering
 *
 * These values determine where glyphs (TKA letter, VTG, position, reversal)
 * are placed within the 950x950 viewbox.
 */
export declare const TKA_GLYPH: {
    readonly X: 50;
    readonly Y: 800;
    readonly SCALE: 1;
};
export declare const STEP_NUMBER: {
    readonly X: 50;
    readonly Y: 50;
    readonly FONT_SIZE: 100;
    readonly START_FONT_SIZE: 80;
};
export declare const DIRECTION_DOT: {
    readonly PADDING: 10;
    readonly SIZE: 25;
};
export declare const TURN_NUMBER: {
    readonly HEIGHT: 45;
    readonly PADDING_X: 15;
    readonly PADDING_Y: 5;
    readonly WIDTHS: Record<string, number>;
};
export declare const DASH_SUFFIX: {
    readonly WIDTH: 70;
    readonly HEIGHT: 20;
    readonly GAP: 10;
    readonly RADIUS: 9.5;
    readonly FILL_DARK: "#ffffff";
    readonly FILL_LIGHT: "#231f20";
};
export declare const VTG_GLYPH: {
    readonly WIDTH: 201.24;
    readonly HEIGHT: 133.6;
    readonly OFFSET_PERCENTAGE: 0.04;
};
export declare const ELEMENTAL_GLYPH: {
    readonly WIDTH: 95;
    readonly HEIGHT: 125;
    readonly OFFSET_PERCENTAGE: 0.04;
};
export declare const POSITION_GLYPH: {
    readonly Y: 50;
    readonly SCALE_FACTOR: 0.75;
    readonly SPACING: 25;
    readonly ARROW_WIDTH: 88.9;
    readonly ARROW_HEIGHT: 34.8;
    readonly LETTER_DIMENSIONS: Record<string, {
        width: number;
        height: number;
        yOffset: number;
    }>;
};
/**
 * Reversal indicator positioning
 *
 * Matches ReversalIndicators.svelte EXACTLY:
 * - X_POSITION_PERCENT = 5.5, multiplied by 13 = 71.5
 * - DOT_RADIUS_PERCENT = 1.5, multiplied by 10 = 15
 * - DOT_SPACING_PERCENT = 4.5, multiplied by 13 = 58.5
 * - CENTER_Y_PERCENT = 50, multiplied by 9.5 = 475
 *
 * When both reversals present: RED on top, BLUE on bottom
 */
export declare const REVERSAL_INDICATOR: {
    /** X position from left edge (5.5% * 13 = 71.5) */
    readonly X_POSITION: number;
    /** Dot radius (1.5% * 10 = 15) */
    readonly DOT_RADIUS: number;
    /** Vertical spacing between dots when both present (4.5% * 13 = 58.5) */
    readonly DOT_SPACING: number;
    /** Vertical center (50% * 9.5 = 475) */
    readonly CENTER_Y: number;
};
