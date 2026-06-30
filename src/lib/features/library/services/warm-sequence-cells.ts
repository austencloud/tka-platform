/**
 * Render-at-publish: render every cell of a saved sequence at CANONICAL_CELL_SIZE
 * with the canonical scan-card visibility, and let renderCell upload each to the
 * cloud store (uploadCanonical), so the FIRST scanner of a freshly-published
 * sequence downloads images instead of rendering them on their phone.
 *
 * Fire-and-forget from the save path. Best-effort: a failed cell is skipped, the
 * save is never affected. Revokes the returned object URLs (we only want the
 * upload side effect, not display).
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { PreviewCellRenderOptions } from "$lib/shared/sequence-viewer/services/preview-cell-renderer";
import { renderCell } from "$lib/shared/sequence-viewer/services/preview-cell-renderer";
import { createStartPositionFromBeatStart } from "$lib/shared/create/services/sequence-transforms";
import { CANONICAL_CELL_SIZE, CANONICAL_CARD_VISIBILITY } from "$lib/shared/render/services/cloud-cell-key";

export interface WarmOptions {
  /** Scan cards render dark. Defaults to true. */
  isDark?: boolean;
  bluePropType?: PropType;
  redPropType?: PropType;
  catDogMode?: boolean;
}

export async function warmSequenceCells(
  sequence: SequenceData,
  opts: WarmOptions = {},
): Promise<void> {
  const steps = sequence.steps ?? [];
  if (steps.length === 0) return;

  const blueProp = opts.bluePropType;
  const renderOptions: PreviewCellRenderOptions = {
    ...CANONICAL_CARD_VISIBILITY,
    size: CANONICAL_CELL_SIZE,
    showStepNumbers: false,
    bluePropType: blueProp,
    redPropType: opts.catDogMode ? (opts.redPropType ?? blueProp) : blueProp,
    catDogModeEnabled: opts.catDogMode ?? false,
    probeCloud: true,
    uploadCanonical: true,
  };

  const warmOne = async (data: unknown, stepNumber: number | undefined) => {
    try {
      const url = await renderCell(
        data as Parameters<typeof renderCell>[0],
        stepNumber,
        opts.isDark ?? true,
        renderOptions,
      );
      if (typeof url === "string" && url.startsWith("blob:")) URL.revokeObjectURL(url);
    } catch {
      /* skip this cell */
    }
  };

  const firstStep = steps[0];
  const startData = sequence.startPosition
    ?? (firstStep ? createStartPositionFromBeatStart(firstStep) : null);
  if (startData) await warmOne(startData, undefined);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step) await warmOne(step, i + 1);
  }
}
