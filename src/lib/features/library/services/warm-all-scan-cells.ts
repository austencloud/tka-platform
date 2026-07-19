/**
 * Admin warm pass for the canonical scan-card cell store.
 *
 * Drives warmSequenceCells (the exact render-at-publish path the save flow
 * uses — dark mode, intendedProp props, canonical visibility) over every
 * public sequence, so /q scanners download pre-rendered cells instead of
 * rasterizing on their phones. Mirroring the save-path call keeps warmed
 * hashes byte-identical to what a scanner derives.
 *
 * Idempotent: renderCell probes the cloud store per cell and only renders +
 * uploads misses (including the IDB-hit upload backfill), so re-runs are
 * cheap. Cancellation takes effect between sequences.
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PublicSequencesLoader } from "$lib/shared/browse/services/public-sequences-loader";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
import { warmSequenceCells } from "./warm-sequence-cells";

export interface CellWarmProgress {
  /** Sequences fully processed. */
  done: number;
  total: number;
  /** Sequences whose warm threw (skipped, run continues). */
  failed: number;
  /** Display word of the sequence just processed. */
  current?: string;
  finished: boolean;
  cancelled: boolean;
}

export interface CellWarmHandle {
  cancel(): void;
  readonly promise: Promise<CellWarmProgress>;
}

export interface CellWarmDeps {
  loader?: Pick<PublicSequencesLoader, "loadSequenceMetadata">;
  /** Concurrent sequences. Cells within a sequence already render in
   *  parallel (bounded by the worker pool), so this mainly controls how much
   *  probe/upload network latency overlaps with rendering. */
  concurrency?: number;
}

export function startScanCellWarm(
  onProgress: (p: CellWarmProgress) => void,
  deps?: CellWarmDeps,
): CellWarmHandle {
  let cancelled = false;

  const progress: CellWarmProgress = {
    done: 0,
    total: 0,
    failed: 0,
    finished: false,
    cancelled: false,
  };

  const promise = (async (): Promise<CellWarmProgress> => {
    const loader =
      deps?.loader ??
      (await import("$lib/shared/browse/get-browse-loader")).getBrowseLoader();

    const sequences: SequenceData[] = [...(await loader.loadSequenceMetadata())];
    progress.total = sequences.length;
    onProgress({ ...progress });

    const concurrency = Math.max(1, deps?.concurrency ?? 4);
    let next = 0;

    const runWorker = async (): Promise<void> => {
      while (!cancelled) {
        const idx = next++;
        if (idx >= sequences.length) return;
        const seq = sequences[idx];
        if (!seq) continue;

        try {
          const ip = seq.intendedProp;
          await warmSequenceCells(seq, {
            isDark: true,
            bluePropType: ip?.bluePropType,
            redPropType: ip?.redPropType,
            catDogMode: ip?.catDogMode ?? false,
          });
        } catch {
          progress.failed++;
        }

        progress.done++;
        progress.current = simplifyRepeatedWord(seq.word || seq.name || seq.id);
        onProgress({ ...progress });
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, Math.max(sequences.length, 1)) },
      () => runWorker(),
    );
    await Promise.all(workers);

    progress.finished = true;
    progress.cancelled = cancelled;
    onProgress({ ...progress });
    return { ...progress };
  })();

  return {
    cancel() {
      cancelled = true;
    },
    promise,
  };
}
