/**
 * Co-exported types from retired interface contracts.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { SoloPropData } from "$lib/shared/foundation/domain/models/solo-prop-data";
import type { HandPathData } from "$lib/shared/foundation/domain/models/hand-path-data";
import type { BrowseEngine } from "$lib/shared/browse/engine/types";


export interface BrowseQueryResult {
  /** Full sequences (used for combined modes) */
  readonly sequences: SequenceData[];
  /** Solo props (used when subject=props, granularity=solo) */
  readonly soloProps: SoloPropData[];
  /** Hand paths (used when subject=hands, granularity=solo) */
  readonly handPaths: HandPathData[];
}


export interface BrowseEventHandlerParams {
  engine: BrowseEngine;
  openAnimationModal: (sequence: SequenceData) => void;
  setSelectedSequence: (sequence: SequenceData | null) => void;
  setError: (error: string | null) => void;
}


export interface SequenceMetadata {
  id: string;
  word: string;
  thumbnailUrl: string;
  webpThumbnailUrl?: string;
  width?: number; // Image width for layout stability
  height?: number; // Image height for layout stability
  length: number;
  hasImage: boolean;
  priority: boolean; // Above-the-fold
}

export interface PaginatedSequences {
  sequences: SequenceMetadata[];
  totalCount: number;
  hasMore: boolean;
  nextPage: number;
}

export interface BrowseLoadingState {
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  loadedCount: number;
  totalCount: number;
}
