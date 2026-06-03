/**
 * Co-exported types from retired interface contracts.
 */

import type { SequenceVisibility } from "$lib/shared/library/domain/models/library-sequence";

// === From ILibraryRepository ===

export interface LibraryStats {
  /** Total sequences in library */
  totalSequences: number;
  /** Sequences created by user */
  createdSequences: number;
  /** Sequences forked from others */
  forkedSequences: number;
  /** Public sequences */
  publicSequences: number;
  /** Private sequences */
  privateSequences: number;
  /** Total collections */
  totalCollections: number;
  /** Total acts (playlists) */
  totalActs: number;
  /** Total steps across all sequences */
  totalSteps: number;
}

export interface LibraryQueryOptions {
  /** Filter by source type */
  source?: "created" | "forked" | "all";
  /** Filter by visibility */
  visibility?: SequenceVisibility | "all";
  /** Filter by collection ID */
  collectionId?: string;
  /** Filter by tag IDs */
  tagIds?: string[];
  /** Filter by favorite status */
  isFavorite?: boolean;
  /** Search query (name, word) */
  searchQuery?: string;
  /** Sort field */
  sortBy?: "name" | "createdAt" | "updatedAt" | "sequenceLength";
  /** Sort direction */
  sortDirection?: "asc" | "desc";
  /** Maximum results */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

// === From ILibrarySaveService ===

export interface SaveToLibraryOptions {
  /** TKA name (auto-generated from sequence letters) */
  name: string;
  /** Optional custom display name */
  displayName?: string;
  /** Visibility level */
  visibility: SequenceVisibility;
  /** Tag names to apply */
  tags: string[];
  /** Optional notes */
  notes: string;
}

export interface SaveProgress {
  /** Current step (1-6, where 6 is complete) */
  step: number;
  /** Human-readable step label */
  stepLabel: string;
  /** Granular progress for thumbnail rendering */
  renderProgress?: {
    current: number;
    total: number;
  };
}

export interface SaveResult {
  /** The saved sequence ID */
  sequenceId: string;
  /** URL of the uploaded thumbnail (if successful) */
  thumbnailUrl?: string;
}
