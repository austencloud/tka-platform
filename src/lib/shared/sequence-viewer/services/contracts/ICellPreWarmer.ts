/**
 * ICellPreWarmer
 *
 * Pre-warms the PictographBlobCache (IndexedDB) with rendered pictograph cells
 * for sequences the user is about to open. When the preview mounts,
 * PreviewCellRenderer.renderCell() finds everything already cached - instant display.
 *
 * Three priority tiers mapped to the Prioritized Task Scheduling API:
 * - "background" → scheduler.postTask({ priority: "background" })
 *   Used for sequences visible in the gallery. Non-blocking, yields between cells.
 * - "user-visible" → scheduler.postTask({ priority: "user-visible" })
 *   Used on hover. Renders all uncached cells with normal priority.
 * - "user-blocking" → scheduler.postTask({ priority: "user-blocking" })
 *   Used on click. Renders immediately before any other queued work.
 *
 * Falls back to requestIdleCallback / setTimeout for browsers without scheduler support.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export type PreWarmPriority = "background" | "user-visible" | "user-blocking";

export interface ICellPreWarmer {
  /**
   * Pre-warm all cells for a sequence into PictographBlobCache.
   * Renders both light and dark mode variants for each cell.
   * Skips cells already present in the cache.
   *
   * @param sequence - The sequence whose cells should be pre-warmed
   * @param priority - Scheduling priority for the render tasks
   */
  preWarmSequence(sequence: SequenceData, priority: PreWarmPriority): void;

  /**
   * Pre-warm all cells and return a Promise that resolves when complete.
   * Use this when you need to guarantee the cache is warm before continuing
   * (e.g., before setting sequence data that triggers a preview render).
   */
  preWarmSequenceAsync(sequence: SequenceData): Promise<void>;

  /**
   * Cancel any in-flight pre-warming for a specific sequence.
   * Aborts pending renders to free worker pool capacity.
   */
  cancelPreWarm(sequenceId: string): void;

  /**
   * Cancel all in-flight pre-warming across all sequences.
   */
  cancelAll(): void;
}
