/**
 * Shared Domain Models for Sequence Review
 *
 * Generic types used by any sequence review workflow (LOOP labeling, tag review, etc.)
 */

/**
 * Base sequence entry - minimum data needed for browsing sequences
 */
export interface BaseSequenceEntry {
  id: string;
  word: string;
  thumbnails: string[];
  sequenceLength: number;
  gridMode: string;
  isCircular?: boolean;
  fullMetadata?: {
    sequence?: unknown[];
  };
}

/**
 * Review status for a sequence
 */
export interface ReviewStatus {
  type: string;
  icon: string;
  color: string;
  label?: string;
}

/**
 * Filter option for review workflows
 */
export interface FilterOption<T extends string = string> {
  id: T;
  label: string;
  icon?: string;
  count?: number;
}

/**
 * Base review state that any review workflow can extend
 */
export interface BaseReviewState<TSequence extends BaseSequenceEntry, TLabel> {
  sequences: TSequence[];
  labels: Map<string, TLabel>;
  currentIndex: number;
  currentSequence: TSequence | null;
  currentLabel: TLabel | null;
  filterMode: string;
  loading: boolean;
}

/**
 * Navigation actions for review workflows
 */
export interface ReviewNavigationActions {
  next: () => void;
  previous: () => void;
  skip: () => void;
  jumpTo: (id: string) => void;
}

/**
 * Stats for review progress
 */
export interface ReviewStats {
  total: number;
  reviewed: number;
  pending: number;
  percentComplete: number;
}
