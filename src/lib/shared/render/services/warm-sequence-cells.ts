/**
 * Ensure every pictograph used by a scannable card exists in the canonical
 * cloud cell store. QR generation uses strict verification; library saves and
 * admin backfills can inspect the same structured result without duplicating
 * the render/hash contract.
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { PreviewCellRenderOptions } from "$lib/shared/sequence-viewer/services/preview-cell-renderer";
import { renderCell } from "$lib/shared/sequence-viewer/services/preview-cell-renderer";
import {
  CANONICAL_CELL_SIZE,
  CANONICAL_CARD_VISIBILITY,
  deriveCloudCellHash,
} from "$lib/shared/render/services/cloud-cell-key";
import * as pictographCloudCache from "$lib/shared/render/services/pictograph-cloud-cache";
import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/start-position-deriver";

export interface WarmOptions {
  /** Scan cards render dark by default. */
  isDark?: boolean;
  bluePropType?: PropType;
  redPropType?: PropType;
  catDogMode?: boolean;
  /** Throw unless every canonical object can be downloaded after warming. */
  requireComplete?: boolean;
}

export interface WarmCellFailure {
  cell: "start" | number;
  reason: string;
}

export interface WarmSequenceCellsResult {
  total: number;
  ready: number;
  hashes: readonly string[];
  failures: readonly WarmCellFailure[];
}

export class IncompleteCellWarmError extends Error {
  constructor(readonly result: WarmSequenceCellsResult) {
    super(`Canonical scan assets incomplete: ${result.ready}/${result.total} ready`);
    this.name = "IncompleteCellWarmError";
  }
}

export async function warmSequenceCells(
  sequence: SequenceData,
  opts: WarmOptions = {}
): Promise<WarmSequenceCellsResult> {
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

  const entries: { cell: "start" | number; data: PictographData }[] = [];
  const start = startPositionDeriver.getOrDeriveStartPosition(sequence);
  if (start) entries.push({ cell: "start", data: start });
  sequence.steps.forEach((step, index) => {
    entries.push({ cell: index + 1, data: step });
  });

  const outcomes = await Promise.all(
    entries.map(async ({ cell, data }) => {
      let url: string | null = null;
      try {
        const hash = await deriveCloudCellHash(data, opts.isDark ?? true, renderOptions);
        url = await renderCell(
          data,
          cell === "start" ? undefined : cell,
          opts.isDark ?? true,
          renderOptions
        );

        if (opts.requireComplete) {
          const stored = await pictographCloudCache.download(hash);
          if (!stored) throw new Error("uploaded object could not be read back");
        }

        return { hash } as const;
      } catch (error) {
        return {
          failure: {
            cell,
            reason: error instanceof Error ? error.message : String(error),
          },
        } as const;
      } finally {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      }
    })
  );

  const hashes: string[] = [];
  const failures: WarmCellFailure[] = [];
  for (const outcome of outcomes) {
    if ("hash" in outcome && outcome.hash) hashes.push(outcome.hash);
    if ("failure" in outcome && outcome.failure) failures.push(outcome.failure);
  }
  const result: WarmSequenceCellsResult = {
    total: entries.length,
    ready: hashes.length,
    hashes,
    failures,
  };

  if (opts.requireComplete && failures.length > 0) {
    throw new IncompleteCellWarmError(result);
  }
  return result;
}
