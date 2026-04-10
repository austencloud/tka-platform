import type { PoseLabel } from "../../domain/types";

/**
 * Loads and persists pose labels. Phase 1 implementation uses
 * localStorage as the working copy and exports to a JSON file
 * for manual commit to the repo.
 */
export interface IPoseLabelRepository {
  /**
   * Load all labels. Merges the canonical committed JSON (if present)
   * with any newer localStorage changes. Unlabeled poses are not
   * present in the returned map — callers should treat missing keys
   * as "unlabeled".
   */
  loadAll(): Promise<Record<string, PoseLabel>>;

  /**
   * Save the full labels map. Debounced writes to localStorage are
   * fine; implementations should not block the caller.
   */
  save(labels: Record<string, PoseLabel>): void;

  /**
   * Serialize the current labels to the on-disk file format and
   * trigger a browser download. The reviewer manually commits the
   * downloaded file to the repo.
   */
  exportJson(labels: Record<string, PoseLabel>): void;
}
