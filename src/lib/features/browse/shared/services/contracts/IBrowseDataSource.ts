import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SoloPropData } from "$lib/shared/foundation/domain/models/SoloPropData";
import type { HandPathData } from "$lib/shared/foundation/domain/models/HandPathData";
import type { BrowseViewMode } from "../../domain/BrowseViewMode";

/**
 * Unified query result for browse operations across all view modes.
 *
 * The gallery always renders a grid of cards. What each card represents
 * depends on the active view mode:
 * - props + combined: full sequences (both props together)
 * - hands + combined: same sequences, flagged for hand-path rendering
 * - props + solo: individual solo prop entries
 * - hands + solo: individual hand path entries
 */
export interface BrowseQueryResult {
  /** Full sequences (used for combined modes) */
  readonly sequences: SequenceData[];
  /** Solo props (used when subject=props, granularity=solo) */
  readonly soloProps: SoloPropData[];
  /** Hand paths (used when subject=hands, granularity=solo) */
  readonly handPaths: HandPathData[];
}

export interface IBrowseDataSource {
  /**
   * Load data appropriate for the given view mode.
   *
   * For combined granularity, returns sequences via the existing public loader.
   * For solo granularity, queries the solo prop or hand path repositories.
   */
  query(viewMode: BrowseViewMode): Promise<BrowseQueryResult>;
}
