/**
 * IPreviewCellRenderer
 *
 * Renders individual pictograph cells with caching for sequence previews.
 * Handles cache key derivation, layer composition, and IndexedDB persistence.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { BrowseViewMode } from "$lib/features/browse/shared/domain/BrowseViewMode";

/**
 * Options for rendering a preview cell.
 * All visibility and prop settings that affect the rendered output.
 */
export interface PreviewCellRenderOptions {
  /** Render size in pixels (e.g., 480 for high-res) — this is the height; width = size * widthMultiplier */
  size: number;

  /** Width multiplier for duration-expanded cells (1 = square, 2 = double-wide). Default: 1 */
  widthMultiplier?: number;

  /** Blue hand prop type override */
  bluePropType?: PropType;

  /** Red hand prop type override (used when catDogModeEnabled) */
  redPropType?: PropType;

  /** When true, red hand uses redPropType; otherwise uses bluePropType */
  catDogModeEnabled?: boolean;

  /** Whether to render step numbers on the pictograph */
  showStepNumbers?: boolean;

  // Visibility settings (from user preferences)

  /** Show non-radial (corner) grid points */
  showNonRadialPoints?: boolean;

  /** Hand point visibility mode */
  handPointVisibility?: "all" | "active";

  /** Show TKA letter glyph */
  showTKA?: boolean;

  /** Show reversal indicators */
  showReversals?: boolean;

  /** When true, renders hand path visualization: HAND props, float arrows for shifts,
   *  no TKA overlay, no reversals. Shows pure spatial trajectory. */
  handPathMode?: boolean;

  /** Browse view mode (props/hands x combined/solo x blue/red).
   *  Affects cache keys so the same sequence renders differently per mode. */
  browseViewMode?: BrowseViewMode;
}

export interface IPreviewCellRenderer {
  /**
   * Render a single pictograph cell with IndexedDB caching.
   * Returns a blob URL (URL.createObjectURL) for non-blocking performance.
   *
   * IMPORTANT: Callers must call URL.revokeObjectURL() on returned URLs when done.
   *
   * @param pictographData - The pictograph data to render
   * @param stepNumber - Optional step number to display (1-indexed), undefined for start position
   * @param isDark - Whether to render in dark mode
   * @param options - Render options including size and visibility settings
   * @returns Blob URL string
   */
  renderCell(
    pictographData: PictographData,
    stepNumber: number | undefined,
    isDark: boolean,
    options: PreviewCellRenderOptions
  ): Promise<string>;
}
