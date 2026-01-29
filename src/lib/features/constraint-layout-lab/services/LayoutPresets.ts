/**
 * Layout Presets
 *
 * Built-in presets are intentionally empty - users create all presets
 * from scratch via the constraint layout lab.
 *
 * This file provides media type colors and the empty preset array.
 */

import type { LayoutPreset, CellMediaType } from "../domain/types";

let cellIdCounter = 0;

/** Media type colors for visual distinction */
const MEDIA_COLORS: Record<CellMediaType, string> = {
  video: "#ef4444",       // Red
  animation: "#8b5cf6",   // Purple
  image: "#10b981",       // Emerald
  "choreo-card": "#3b82f6", // Blue
  "viewer-3d": "#f59e0b", // Amber
  empty: "#6b7280",       // Gray
};

/** Export media colors for use in other components */
export { MEDIA_COLORS };

/**
 * Built-in presets - empty by design.
 * Users create all presets from scratch via the constraint layout lab.
 */
export const LAYOUT_PRESETS: LayoutPreset[] = [];

/**
 * Reset the cell ID counter (useful for testing)
 */
export function resetCellIdCounter(): void {
  cellIdCounter = 0;
}
