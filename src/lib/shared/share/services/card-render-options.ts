/**
 * card-render-options.ts
 *
 * Single source of truth for mapping the user's saved card settings
 * (ImageCompositionManager + VisibilityStateManager) into renderer options.
 *
 * Every card image/download/share path builds its `renderSequenceToBlob` options
 * here. The reason this exists: the card PREVIEW (ChoreoCard) and the exported
 * PNG are two separate renderers, and each caller used to hand-build a partial
 * options object — so a panel toggle could reach the preview but silently skip
 * the export (LOOP glyph, mandala, QR, grid, columns, start-layout all drifted
 * this way). Funnelling every caller through one builder makes that class of bug
 * impossible: add a toggle here once and all paths honor it.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { SequenceExportOptions } from "$lib/shared/render/domain/models/sequence-export-options";
import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";
import { resolveInfoCellDisplay } from "$lib/shared/sequence-viewer/services/info-cell-display";
import { getAuthSync } from "$lib/shared/auth/firebase";

export interface CardRenderOptionsInput {
  /**
   * Theme. The viewer passes its export-panel value (exportOptions.imageDarkMode);
   * the share/download paths pass the composition manager's darkMode. Explicit so
   * each caller keeps its own canonical source and preview/export stay in lockstep.
   */
  darkMode: boolean;
  /** Footer creator name (auth display name). */
  userName: string;
  /**
   * Hand-path visualization (HAND props + float arrows). When true the difficulty
   * badge, LOOP glyph + its header band, TKA overlays and reversal arrows are
   * suppressed to match the on-screen hand-path card — all are meaningless for a
   * single-hand path view.
   */
  isHandPath?: boolean;
}

/**
 * Build the complete `renderSequenceToBlob` options from the user's card settings.
 * Output excludes pure output-format concerns (stepSize/format/quality) — the
 * caller spreads those in.
 */
export function buildCardRenderOptions(
  sequence: SequenceData,
  input: CardRenderOptionsInput
): Partial<SequenceExportOptions> {
  const ic = getImageCompositionManager();
  const vm = getVisibilityStateManager();
  const stepCount = sequence.steps?.length ?? 0;
  const isHandPath = input.isHandPath ?? false;
  // One-count cards (single beat + start) have no spare cell for a QR — it would
  // land on the start position. One-count cards never carry a QR (matches the
  // canvas backstop in findEmptyCellForQR and the gallery thumbnail gate).
  const oneCount = stepCount <= 1;

  // The panel's column chip stores STEP columns; the assembler wants the total
  // including the start-position column, so add +1 when start is shown.
  const stepColumns = ic.getColumnCountForStepCount(stepCount);
  const columnCount =
    stepColumns != null
      ? stepColumns + (ic.includeStartPosition ? 1 : 0)
      : undefined;

  // One-spot info-cell resolution: a card with a single empty info cell + both QR
  // and mandala on routes through the user's per-length choice. No-op otherwise,
  // so multi-cell cards keep both. oneCount already forces QR off (no spare cell).
  const effectiveInfoCell = resolveInfoCellDisplay({
    stepCount,
    includeStartPosition: ic.includeStartPosition,
    startPositionLayout: ic.getStartPositionLayoutForStepCount(stepCount),
    columnCount: ic.getColumnCountForStepCount(stepCount), // STEP columns
    showQRCode: oneCount ? false : ic.showQRCode,
    showMandala: ic.showMandala,
    infoCellChoice: ic.getInfoCellChoiceForStepCount(stepCount),
    isAuthenticated: !!getAuthSync().currentUser,
  });

  return {
    includeStartPosition: ic.includeStartPosition,
    startPositionLayout: ic.getStartPositionLayoutForStepCount(stepCount),
    columnCount,
    addStepNumbers: ic.addStepNumbers,
    addWord: ic.addWord,
    addDifficultyLevel: isHandPath ? false : ic.addDifficultyLevel,
    showLoopGlyph: isHandPath ? false : ic.showLoopGlyph,
    addUserInfo: ic.showCreatorName || ic.showNotes || ic.showBirthday,
    userName: input.userName,
    showCreatorName: ic.showCreatorName,
    showNotes: ic.showNotes,
    showBirthday: ic.showBirthday,
    addReversalSymbols: !isHandPath,
    visibilityOverrides: {
      darkMode: input.darkMode,
      showQRCode: effectiveInfoCell.showQRCode,
      showGrid: vm.getGridVisibility(),
      showMandala: effectiveInfoCell.showMandala,
      handPathMode: isHandPath,
      // Match the preview's hand-path overlay suppression. Left undefined for
      // normal cards so the composer inherits TKA/reversal visibility from the
      // global VisibilityStateManager.
      ...(isHandPath ? { showTKA: false, showReversals: false } : {}),
    },
  };
}
