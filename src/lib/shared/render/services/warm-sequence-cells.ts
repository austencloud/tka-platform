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
import { detectMixedDurations } from "$lib/shared/choreo-card/services/step-durations";

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
    super(
      `Canonical scan assets incomplete: ${result.ready}/${result.total} ready`
    );
    this.name = "IncompleteCellWarmError";
  }
}

// A full legacy backfill walks thousands of shortcode records that collapse to
// a much smaller set of canonical pictographs. Once a strict warm has rendered,
// uploaded, and read a hash back, keep that proof for the rest of the browser
// session. Concurrent sequences that share a cell also join the same promise,
// so the worker pool never rasterizes an identical canonical object twice.
const verifiedCloudHashes = new Set<string>();
const pendingVerifiedWarms = new Map<string, Promise<void>>();

async function renderCanonicalCell(
  data: PictographData,
  cell: "start" | number,
  isDark: boolean,
  renderOptions: PreviewCellRenderOptions,
  hash: string,
  verifyUpload: boolean
): Promise<void> {
  // Most legacy cards collapse onto pictographs that a previous card already
  // uploaded. A successful cloud read is the strict proof this pass needs, so
  // stop there. Sending the same blob through IndexedDB and then downloading
  // it a second time made large backfills spend most of their time moving an
  // object that was already ready for scanners.
  if (verifyUpload) {
    const stored = await pictographCloudCache.download(hash);
    if (stored) return;
  }

  let url: string | null = null;
  try {
    url = await renderCell(
      data,
      cell === "start" ? undefined : cell,
      isDark,
      renderOptions
    );

    if (verifyUpload) {
      const stored = await pictographCloudCache.download(hash);
      if (!stored) throw new Error("uploaded object could not be read back");
    }
  } finally {
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  }
}

async function ensureVerifiedCanonicalCell(
  data: PictographData,
  cell: "start" | number,
  isDark: boolean,
  renderOptions: PreviewCellRenderOptions,
  hash: string
): Promise<void> {
  if (verifiedCloudHashes.has(hash)) return;

  let pending = pendingVerifiedWarms.get(hash);
  if (!pending) {
    pending = renderCanonicalCell(
      data,
      cell,
      isDark,
      renderOptions,
      hash,
      true
    ).then(() => {
      verifiedCloudHashes.add(hash);
    });
    pendingVerifiedWarms.set(hash, pending);

    const clearPending = (): void => {
      if (pendingVerifiedWarms.get(hash) === pending) {
        pendingVerifiedWarms.delete(hash);
      }
    };
    // Register both outcomes so cleanup never creates a detached rejected
    // promise. Every caller still awaits `pending` and receives the failure.
    void pending.then(clearPending, clearPending);
  }

  await pending;
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

  const entries: {
    cell: "start" | number;
    data: PictographData;
    options: PreviewCellRenderOptions;
  }[] = [];
  const start = startPositionDeriver.getOrDeriveStartPosition(sequence);
  if (start) entries.push({ cell: "start", data: start, options: renderOptions });
  // Mixed-duration cards render held beats as WIDE cells with
  // widthMultiplier = duration, and the multiplier is part of the cache key
  // (`|wm2|`). The warm must derive the same per-cell options as ChoreoCard
  // or wide cells are uploaded under keys no scanner ever asks for — the
  // B2ZM class of permanently-unavailable cells.
  const mixed = detectMixedDurations(sequence.steps);
  sequence.steps.forEach((step, index) => {
    const duration = (step as { duration?: number }).duration ?? 1;
    const options =
      mixed && duration !== 1
        ? { ...renderOptions, widthMultiplier: duration }
        : renderOptions;
    entries.push({ cell: index + 1, data: step, options });
  });

  const outcomes = await Promise.all(
    entries.map(async ({ cell, data, options }) => {
      try {
        const hash = await deriveCloudCellHash(
          data,
          opts.isDark ?? true,
          options
        );
        if (opts.requireComplete) {
          await ensureVerifiedCanonicalCell(
            data,
            cell,
            opts.isDark ?? true,
            options,
            hash
          );
        } else {
          await renderCanonicalCell(
            data,
            cell,
            opts.isDark ?? true,
            options,
            hash,
            false
          );
        }

        return { hash } as const;
      } catch (error) {
        return {
          failure: {
            cell,
            reason: error instanceof Error ? error.message : String(error),
          },
        } as const;
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

/** Test-only reset of the strict warm proof registry. */
export function _resetWarmStateForTest(): void {
  verifiedCloudHashes.clear();
  pendingVerifiedWarms.clear();
}
