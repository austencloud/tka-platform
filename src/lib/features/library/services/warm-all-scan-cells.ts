/**
 * Admin warm pass for the canonical scan-card cell store.
 *
 * Drives warmSequenceCells over every durable shortcode, including private,
 * unlisted, embedded, and legacy physical cards. Each record is resolved and
 * hydrated through the same path as /q, then warmed with its exact per-hand
 * props in both supported card themes.
 *
 * Idempotent: renderCell probes the cloud store per cell and only renders +
 * uploads misses (including the IDB-hit upload backfill), so re-runs are
 * cheap. Cancellation takes effect between sequences.
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
import {
  warmSequenceCells,
  type WarmOptions,
  type WarmSequenceCellsResult,
} from "$lib/shared/render/services/warm-sequence-cells";
import type { ShortCodeResolution } from "$lib/shared/qr/services/short-code-manager";
import { hydrateSequence } from "$lib/shared/navigation/services/sequence-hydrator";
import { resolveScanPropConfig } from "$lib/shared/qr/services/scan-prop-resolver";

export interface CellWarmProgress {
  /** Sequences fully processed. */
  done: number;
  total: number;
  /** Sequences whose warm threw (skipped, run continues). */
  failed: number;
  /** Exact shortcode ids that can be retried without repeating the full run. */
  failedCodes: readonly string[];
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
  listCodes?: () => Promise<readonly string[]>;
  resolveCode?: (code: string) => Promise<ShortCodeResolution>;
  warmCells?: (
    sequence: SequenceData,
    options: WarmOptions
  ) => Promise<WarmSequenceCellsResult>;
  /** Concurrent sequences. Cells within a sequence already render in
   *  parallel (bounded by the worker pool), so this mainly controls how much
   *  probe/upload network latency overlaps with rendering. */
  concurrency?: number;
}

async function listAllShortCodes(): Promise<readonly string[]> {
  const [{ collection, getDocs }, { getFirestoreInstance }] = await Promise.all(
    [import("firebase/firestore"), import("$lib/shared/auth/firebase")]
  );
  const firestore = await getFirestoreInstance();
  const snapshot = await getDocs(collection(firestore, "shortcodes"));
  return snapshot.docs.map((doc) => doc.id);
}

async function resolveShortCode(code: string): Promise<ShortCodeResolution> {
  const { getShortCodeManager } =
    await import("$lib/shared/qr/get-short-code-manager");
  return getShortCodeManager().resolveShortCodeWithRecord(code);
}

export function startScanCellWarm(
  onProgress: (p: CellWarmProgress) => void,
  deps?: CellWarmDeps
): CellWarmHandle {
  let cancelled = false;

  const progress: CellWarmProgress = {
    done: 0,
    total: 0,
    failed: 0,
    failedCodes: [],
    finished: false,
    cancelled: false,
  };

  const promise = (async (): Promise<CellWarmProgress> => {
    const codes = [...(await (deps?.listCodes ?? listAllShortCodes)())];
    const resolveCode = deps?.resolveCode ?? resolveShortCode;
    const warmCells = deps?.warmCells ?? warmSequenceCells;
    progress.total = codes.length;
    onProgress({ ...progress });

    const concurrency = Math.max(1, deps?.concurrency ?? 4);
    let next = 0;

    const runWorker = async (): Promise<void> => {
      while (!cancelled) {
        const idx = next++;
        if (idx >= codes.length) return;
        const code = codes[idx];
        if (!code) continue;

        try {
          const resolution = await resolveCode(code);
          if (!resolution.sequence) {
            throw new Error(`Shortcode ${code} did not resolve`);
          }
          const sequence = await hydrateSequence(resolution.sequence, {
            loopDetector: null,
          });
          const propConfig = resolveScanPropConfig(sequence, resolution.record);
          await Promise.all(
            [true, false].map((isDark) =>
              warmCells(sequence, {
                isDark,
                ...propConfig,
                requireComplete: true,
              })
            )
          );
          progress.current = simplifyRepeatedWord(
            sequence.word || sequence.name || code
          );
        } catch {
          progress.failed++;
          progress.failedCodes = [...progress.failedCodes, code];
          progress.current = code;
        }

        progress.done++;
        onProgress({ ...progress });
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, Math.max(codes.length, 1)) },
      () => runWorker()
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
