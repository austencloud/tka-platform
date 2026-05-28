/**
 * CellCacheKeyDeriver
 *
 * Derives deterministic cache keys for pictograph cell renders.
 * Extracted from PreviewCellRenderer so both PreviewCellRenderer and
 * CellPreWarmer generate identical keys, guaranteeing cache hits when
 * the pre-warmer has already rendered a cell.
 *
 * Key format: "lsp8-{pictographHash}:{cell-specific dimensions}"
 *
 * The pictograph hash is produced by PictographKeyHasher, which is the
 * single source of truth for all properties that affect the rendered
 * pictograph image (motion fields, visibility settings, prop types).
 * CellCacheKeyDeriver appends cell-specific dimensions (size, step number,
 * browseViewMode) that PictographKeyHasher intentionally excludes.
 *
 * This composition guarantees that any new field added to PictographKeyHasher
 * automatically flows through to cell cache keys. No second place to update.
 *
 * Version history:
 * - lsp-: Original format. Contaminated by ImageComposer write-through
 *   that stored blobs WITH step numbers under "nonum" keys.
 * - lsp2-: Attempted fix. Still contaminated because Canvas2DDirectRenderer
 *   unconditionally baked step numbers from StepData into rendered blobs.
 * - lsp3-: Fixed step number baking. Used djb2 hash, but 32-bit hash space
 *   caused collisions after ~46K entries, returning wrong prop type blobs.
 * - lsp4-: Full string key. No hash, no collisions.
 * - lsp5-: Invalidate after LayerKeyDeriver fix (was missing rotationDirection
 *   and orientations from base layer cache key, causing CW/CCW collisions).
 * - lsp6-: Added browseViewMode (subject/granularity/color) so the same
 *   sequence caches separate blobs for props vs hands vs solo views.
 * - lsp7-: Added motion-intrinsic propType to key. Without this, a start
 *   position rendered with PropType.HAND (hand path mode) and one rendered
 *   with PropType.STAFF (normal mode) shared the same key when the user's
 *   settings prop type was "staff" for both - causing wrong-prop cache hits.
 * - lsp8-: Composition refactor. Delegates pictograph identity to
 *   PictographKeyHasher instead of independently enumerating motion fields.
 *   Also adds handPathMode, handPointVisibility, printMode, and gridMode
 *   (all previously missing from the flat key). Single source of truth.
 * - lsp9-: Intermediate bump (no behavior change from lsp8).
 * - lsp10-: PictographKeyHasher reverted from djb2 digest to full JSON
 *   string - the lsp8 refactor had silently reintroduced the 32-bit hash
 *   collision that lsp3→lsp4 specifically eliminated, causing wrong-arrow
 *   blobs once the cache grew past ~46K entries.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { PictographVisibilityOptions } from "$lib/shared/render/utils/pictograph-to-svg";
import type { PreviewCellRenderOptions } from "../preview-cell-renderer";
import type { PictographKeyHasher } from "$lib/shared/render/services/implementations/PictographKeyHasher";
import { pictographKeyHasher } from "$lib/shared/render/services/implementations/PictographKeyHasher";

export class CellCacheKeyDeriver {
  constructor(private readonly keyHasher: PictographKeyHasher) {}

  deriveCacheKey(
    pictographData: PictographData,
    stepNumber: number | undefined,
    isDark: boolean,
    options: PreviewCellRenderOptions
  ): string {
    // Delegate pictograph identity to the single source of truth.
    // PictographKeyHasher captures: letter, all motion fields (motionType,
    // locations, turns, orientations, rotationDirection, propType, gridMode),
    // and all visibility settings (showTKA, darkMode, bluePropType, etc.).
    const visibility = this.mapToVisibility(options, isDark);
    const pictographHash = this.keyHasher.deriveKey(pictographData, visibility);

    // Append cell-specific dimensions that PictographKeyHasher intentionally
    // excludes (size, step number, browseViewMode affect presentation, not
    // the pictograph image itself).
    const cellParts = [
      options.showStepNumbers ? (stepNumber ?? "none") : "nonum",
      options.size,
      options.widthMultiplier && options.widthMultiplier !== 1 ? `wm${options.widthMultiplier}` : "",
      options.browseViewMode ? `vm-${options.browseViewMode.subject}-${options.browseViewMode.granularity}-${options.browseViewMode.color}` : "",
    ];

    return `lsp10-${pictographHash}:${cellParts.join("|")}`;
  }

  /**
   * Maps PreviewCellRenderOptions + isDark to PictographVisibilityOptions.
   *
   * Resolves catDogMode (the hasher receives an already-resolved redPropType).
   * VTG/elemental/positions flow from the export visibility toggles (sourced
   * from VisibilityStateManager in ChoreoCard) rather than being hardcoded.
   * printMode is always false (preview cells are never print mode).
   *
   * Note: PreviewCellRenderOptions.handPointVisibility is narrowed to "all" | "active".
   * The value "none" only exists in PictographVisibilityOptions and never appears here.
   */
  private mapToVisibility(
    options: PreviewCellRenderOptions,
    isDark: boolean
  ): PictographVisibilityOptions {
    return {
      showTKA: options.showTKA ?? true,
      showTnD: options.showTnD ?? false,
      showElemental: options.showElemental ?? false,
      showPositions: options.showPositions ?? false,
      showReversals: options.showReversals ?? true,
      showNonRadialPoints: options.showNonRadialPoints ?? true,
      darkMode: isDark,
      bluePropType: options.bluePropType,
      redPropType: options.catDogModeEnabled
        ? options.redPropType
        : options.bluePropType,
      handPointVisibility: options.handPointVisibility,
      handPathMode: options.handPathMode,
      printMode: false,
      showBlueMotion: options.showBlueMotion,
      showRedMotion: options.showRedMotion,
    };
  }
}

// Singleton - composes the shared PictographKeyHasher instance
export const cellCacheKeyDeriver = new CellCacheKeyDeriver(pictographKeyHasher);
