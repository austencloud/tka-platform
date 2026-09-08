/** Physical constants for sticker-lab - all dimensions at 300 DPI. */

/** Resolution target for all raster output (PNG embed in PDF, preview canvas). */
export const STICKER_DPI = 300;

/** 3" round sticker art diameter in pixels at STICKER_DPI. */
export const STICKER_ART_DIAMETER_PX = 3 * STICKER_DPI; // 900

/** Art radius (half the diameter). */
export const STICKER_ART_RADIUS_PX = STICKER_ART_DIAMETER_PX / 2; // 450

/** Bleed extension on every side of the sticker art, in pixels at STICKER_DPI. 0.1" = 30 px. */
export const STICKER_BLEED_PX = Math.round(0.1 * STICKER_DPI); // 30

/** Full sticker tile including bleed (square that inscribes the art + bleed). */
export const STICKER_TILE_SIZE_PX =
  STICKER_ART_DIAMETER_PX + STICKER_BLEED_PX * 2; // 960

/** Physical gap between stickers on a sheet, in inches. */
export const STICKER_GAP_IN = 0.15;

/** Sheet dimensions in inches (width, height) - portrait orientation. */
export const SHEET_DIMENSIONS_IN: Record<
  "8.5x11" | "13x19",
  { width: number; height: number }
> = {
  "8.5x11": { width: 8.5, height: 11 },
  "13x19": { width: 13, height: 19 },
};

/** Max copies of a single sticker on one sheet's queue. UI-level cap. */
export const MAX_COPIES_PER_STICKER = 50;

/** localStorage key for the single active sheet (MVP single-sheet model). */
export const STORAGE_KEY_ACTIVE_SHEET = "tka:sticker-lab:active-sheet";

/** Storage schema version - bumped on breaking changes to persisted StickerSheet shape. */
export const STORAGE_SCHEMA_VERSION = 4;
