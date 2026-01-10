/**
 * Explore Filter Service
 *
 * Handles all filtering operations for gallery sequences.
 * Each filter type has its own dedicated method for clarity.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { ExploreFilterType } from "$lib/shared/persistence/domain/enums/FilteringEnums";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { ExploreFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";
import type { IDiscoverFilter } from "../contracts/IDiscoverFilter";
import type {
  LOOPType} from "$lib/features/create/generate/circular/domain/models/circular-models";
import {
  LOOP_TYPE_LABELS,
} from "$lib/features/create/generate/circular/domain/models/circular-models";

// Constants
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const STARTING_LETTER_RANGES = ["A-D", "E-H", "I-L", "M-P", "Q-T", "U-Z"];
const LENGTH_OPTIONS = ["3", "4", "5", "6", "7", "8+"];
const DIFFICULTY_OPTIONS = ["beginner", "intermediate", "advanced"];
const GRID_MODE_OPTIONS = [GridMode.DIAMOND, GridMode.BOX];

export class DiscoverFilter implements IDiscoverFilter {
  applyFilter(
    sequences: SequenceData[],
    filterType: ExploreFilterType,
    filterValue: ExploreFilterValue
  ): SequenceData[] {
    if (filterType === ExploreFilterType.ALL_SEQUENCES) {
      return sequences;
    }

    switch (filterType) {
      case ExploreFilterType.STARTING_LETTER:
        return this.filterByStartingLetter(sequences, filterValue);
      case ExploreFilterType.CONTAINS_LETTERS:
        return this.filterByContainsLetters(sequences, filterValue);
      case ExploreFilterType.LENGTH:
        return this.filterByLength(sequences, filterValue);
      case ExploreFilterType.DIFFICULTY:
        return this.filterByDifficulty(sequences, filterValue);
      case ExploreFilterType.STARTING_POSITION:
        return this.filterByStartingPosition(sequences, filterValue);
      case ExploreFilterType.END_POSITION:
        return this.filterByEndPosition(sequences, filterValue);
      case ExploreFilterType.AUTHOR:
        return this.filterByAuthor(sequences, filterValue);
      case ExploreFilterType.GRID_MODE:
        return this.filterByGridMode(sequences, filterValue);
      case ExploreFilterType.FAVORITES:
        return this.filterByFavorites(sequences);
      case ExploreFilterType.RECENT:
        return this.filterByRecent(sequences);
      case ExploreFilterType.LOOP_TYPE:
        return this.filterByLOOPType(sequences, filterValue);
      default:
        return sequences;
    }
  }

  getFilterOptions(
    filterType: ExploreFilterType,
    sequences: SequenceData[]
  ): string[] {
    switch (filterType) {
      case ExploreFilterType.STARTING_LETTER:
        return STARTING_LETTER_RANGES;
      case ExploreFilterType.LENGTH:
        return LENGTH_OPTIONS;
      case ExploreFilterType.DIFFICULTY:
        return DIFFICULTY_OPTIONS;
      case ExploreFilterType.AUTHOR:
        return this.getUniqueAuthors(sequences);
      case ExploreFilterType.GRID_MODE:
        return GRID_MODE_OPTIONS;
      case ExploreFilterType.LOOP_TYPE:
        return this.getLOOPTypeOptions(sequences);
      default:
        return [];
    }
  }

  // ============================================================================
  // Filter Methods
  // ============================================================================

  private filterByStartingLetter(
    sequences: SequenceData[],
    filterValue: ExploreFilterValue
  ): SequenceData[] {
    if (!filterValue || typeof filterValue !== "string") {
      return sequences;
    }

    // Handle range format (e.g., "A-D")
    if (filterValue.includes("-")) {
      return this.filterByLetterRange(sequences, filterValue);
    }

    // Handle single letter
    return sequences.filter(
      (seq) => seq.word[0]?.toUpperCase() === filterValue.toUpperCase()
    );
  }

  private filterByLetterRange(
    sequences: SequenceData[],
    range: string
  ): SequenceData[] {
    const [start, end] = range.split("-");
    if (!start || !end) {
      return sequences;
    }

    return sequences.filter((seq) => {
      const firstLetter = seq.word[0]?.toUpperCase();
      return firstLetter && firstLetter >= start && firstLetter <= end;
    });
  }

  private filterByContainsLetters(
    sequences: SequenceData[],
    filterValue: ExploreFilterValue
  ): SequenceData[] {
    if (!filterValue || typeof filterValue !== "string") {
      return sequences;
    }

    const searchTerm = filterValue.toLowerCase();
    return sequences.filter(
      (seq) =>
        seq.word.toLowerCase().includes(searchTerm) ||
        seq.displayName?.toLowerCase().includes(searchTerm)
    );
  }

  private filterByLength(
    sequences: SequenceData[],
    filterValue: ExploreFilterValue
  ): SequenceData[] {
    if (!filterValue) {
      return sequences;
    }

    // Handle "8+" case
    if (filterValue === "8+") {
      return sequences.filter((seq) => (seq.sequenceLength ?? 0) >= 8);
    }

    // Handle numeric length
    const length = parseInt(String(filterValue));
    if (isNaN(length)) {
      return sequences;
    }

    return sequences.filter((seq) => seq.sequenceLength === length);
  }

  private filterByDifficulty(
    sequences: SequenceData[],
    filterValue: ExploreFilterValue
  ): SequenceData[] {
    if (!filterValue) {
      return sequences;
    }

    // Convert filter value to number
    const targetLevel =
      typeof filterValue === "number"
        ? filterValue
        : parseInt(String(filterValue));
    if (isNaN(targetLevel)) {
      return sequences;
    }

    // Use the same logic as SequenceCard to determine difficulty level
    const difficultyToLevel: Record<string, number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
      mythic: 4,
      legendary: 5,
    };

    return sequences.filter((seq) => {
      // First try sequence.level (numeric), then map difficultyLevel (string) to number
      const sequenceLevel =
        seq.level ??
        difficultyToLevel[seq.difficultyLevel?.toLowerCase() ?? ""] ??
        0;

      return sequenceLevel === targetLevel;
    });
  }

  private filterByStartingPosition(
    sequences: SequenceData[],
    filterValue: ExploreFilterValue
  ): SequenceData[] {
    if (!filterValue) {
      return sequences;
    }

    // Extract the position to filter by
    // filterValue can be a PictographData object (from position picker) or a string
    let targetPosition: string | null = null;

    if (typeof filterValue === "object" && filterValue !== null) {
      // PictographData object - extract position from startPosition field
      const pictoData = filterValue as { startPosition?: string | null };
      targetPosition = pictoData.startPosition?.toLowerCase() ?? null;
    } else if (typeof filterValue === "string") {
      // Direct string value (e.g., "alpha1", "beta5")
      targetPosition = filterValue.toLowerCase();
    }

    if (!targetPosition) {
      return sequences;
    }

    // Extract position group (alpha, beta, gamma) for fallback matching
    const targetGroup = targetPosition.replace(/[0-9]/g, "");

    const results = sequences.filter((seq) => {
      // Try exact position match first
      const seqStartPos = seq.startPosition || seq.startingPositionBeat;
      if (seqStartPos) {
        // Check gridPosition field (StartPositionData)
        const gridPos = (seqStartPos as { gridPosition?: string | null })
          .gridPosition;
        if (gridPos?.toLowerCase() === targetPosition) {
          return true;
        }

        // Check startPosition field (PictographData/BeatData)
        const startPos = (seqStartPos as { startPosition?: string | null })
          .startPosition;
        if (startPos?.toLowerCase() === targetPosition) {
          return true;
        }
      }

      // Fallback: match by position group (alpha, beta, gamma)
      const seqGroup = this.normalizePositionGroup(seq.startingPositionGroup);
      if (seqGroup === targetGroup) {
        return true;
      }

      return false;
    });

    return results;
  }

  private filterByEndPosition(
    sequences: SequenceData[],
    filterValue: ExploreFilterValue
  ): SequenceData[] {
    if (!filterValue) {
      return sequences;
    }

    // Extract the position to filter by
    // filterValue can be a PictographData object (from position picker) or a string
    let targetPosition: string | null = null;

    if (typeof filterValue === "object" && filterValue !== null) {
      // PictographData object - extract position from startPosition field (which represents the end position for filtering)
      const pictoData = filterValue as { startPosition?: string | null };
      targetPosition = pictoData.startPosition?.toLowerCase() ?? null;
    } else if (typeof filterValue === "string") {
      // Direct string value (e.g., "alpha1", "beta5")
      targetPosition = filterValue.toLowerCase();
    }

    if (!targetPosition) {
      return sequences;
    }

    // Extract position group (alpha, beta, gamma) for fallback matching
    const targetGroup = targetPosition.replace(/[0-9]/g, "");

    return sequences.filter((seq) => {
      // Get the last beat to check end position
      const lastBeat = seq.beats[seq.beats.length - 1];
      if (!lastBeat) {
        return false;
      }

      // Check endPosition field on the last beat
      const endPos = (lastBeat as { endPosition?: string | null }).endPosition;
      if (endPos?.toLowerCase() === targetPosition) {
        return true;
      }

      // Check startPosition on last beat (some data might use this)
      const startPos = (lastBeat as { startPosition?: string | null })
        .startPosition;
      if (startPos?.toLowerCase() === targetPosition) {
        return true;
      }

      // Fallback: match by position group from any available position data
      if (endPos) {
        const endGroup = endPos.toLowerCase().replace(/[0-9]/g, "");
        if (endGroup === targetGroup) {
          return true;
        }
      }

      return false;
    });
  }

  private filterByAuthor(
    sequences: SequenceData[],
    filterValue: ExploreFilterValue
  ): SequenceData[] {
    if (!filterValue) {
      return sequences;
    }

    return sequences.filter((seq) => seq.author === filterValue);
  }

  private filterByGridMode(
    sequences: SequenceData[],
    filterValue: ExploreFilterValue
  ): SequenceData[] {
    if (!filterValue) {
      return sequences;
    }

    return sequences.filter((seq) => seq.gridMode === filterValue);
  }

  private filterByFavorites(sequences: SequenceData[]): SequenceData[] {
    return sequences.filter((seq) => seq.isFavorite);
  }

  private filterByRecent(sequences: SequenceData[]): SequenceData[] {
    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);
    return sequences.filter((seq) => {
      const dateAdded = seq.dateAdded ?? new Date(0);
      return dateAdded >= thirtyDaysAgo;
    });
  }

  /**
   * Filter sequences by LOOP type (Continuous Assembly Pattern)
   * Supports special values:
   * - "circular" - all circular sequences regardless of LOOP type
   * - "non_circular" - all non-circular sequences
   * - "circular_untyped" - circular sequences without a detected LOOP type
   * - specific LOOPType enum values
   */
  private filterByLOOPType(
    sequences: SequenceData[],
    filterValue: ExploreFilterValue
  ): SequenceData[] {
    if (!filterValue) {
      return sequences;
    }

    const filterStr = String(filterValue);

    // Special case: filter all circular sequences
    if (filterStr === "circular" || filterStr === "all_circular") {
      return sequences.filter((seq) => seq.isCircular === true);
    }

    // Special case: filter all non-circular sequences
    if (filterStr === "non_circular") {
      return sequences.filter((seq) => !seq.isCircular);
    }

    // Special case: circular but no specific LOOP type detected
    if (filterStr === "circular_untyped") {
      return sequences.filter((seq) => seq.isCircular && !seq.loopType);
    }

    // Filter by specific LOOP type
    return sequences.filter((seq) => {
      // Must be circular
      if (!seq.isCircular) return false;

      // Check loopType field
      return seq.loopType === filterStr;
    });
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getUniqueAuthors(sequences: SequenceData[]): string[] {
    const authors = new Set<string>();

    for (const sequence of sequences) {
      if (sequence.author) {
        authors.add(sequence.author);
      }
    }

    return Array.from(authors).sort();
  }

  /**
   * Get available LOOP type options with counts
   * Returns array of strings in format: "cap_type_value" or "circular" for all circular
   */
  private getLOOPTypeOptions(sequences: SequenceData[]): string[] {
    const options: string[] = [];

    // Count circular sequences
    const circularCount = sequences.filter((s) => s.isCircular).length;
    if (circularCount > 0) {
      options.push("circular"); // "All Circular" option
    }

    // Count by LOOP type
    const loopTypeCounts = new Map<string, number>();
    for (const seq of sequences) {
      if (seq.loopType) {
        const current = loopTypeCounts.get(seq.loopType) ?? 0;
        loopTypeCounts.set(seq.loopType, current + 1);
      }
    }

    // Add LOOP types that have sequences (sorted by label)
    const sortedTypes = Array.from(loopTypeCounts.keys()).sort((a, b) => {
      const labelA = LOOP_TYPE_LABELS[a as LOOPType] ?? a;
      const labelB = LOOP_TYPE_LABELS[b as LOOPType] ?? b;
      return labelA.localeCompare(labelB);
    });

    options.push(...sortedTypes);

    return options;
  }

  /**
   * Get count of sequences matching a LOOP type
   * Useful for displaying counts in filter UI
   */
  getLOOPTypeCount(sequences: SequenceData[], loopType: string): number {
    if (loopType === "circular" || loopType === "all_circular") {
      return sequences.filter((s) => s.isCircular).length;
    }
    return sequences.filter((s) => s.loopType === loopType).length;
  }

  /**
   * Normalize position group to handle different formats
   * Handles: "alpha", "Alpha", "ALPHA", "α", etc.
   */
  private normalizePositionGroup(group: string | undefined | null): string {
    if (!group) return "";

    const normalized = group.toLowerCase().trim();

    // Map Greek letters to English names
    const greekMap: Record<string, string> = {
      α: "alpha",
      β: "beta",
      γ: "gamma",
    };

    if (greekMap[normalized]) {
      return greekMap[normalized];
    }

    // Remove any numbers from the group name
    return normalized.replace(/[0-9]/g, "");
  }
}
