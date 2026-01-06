/**
 * Explore Sort Service
 *
 * Handles sorting and grouping of gallery sequences.
 * Provides consistent sorting behavior across the gallery.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { injectable } from "inversify";
import { ExploreSortMethod } from "$lib/features/discover/shared/domain/enums/discover-enums";
import type { IDiscoverSorter } from "../contracts/IDiscoverSorter";
import { sortSequencesByKineticAlphabet } from "$lib/features/discover/shared/utils/kinetic-alphabet-sort";

@injectable()
export class DiscoverSorter implements IDiscoverSorter {
  sortSequences(
    sequences: SequenceData[],
    sortMethod: ExploreSortMethod
  ): SequenceData[] {
    const sorted = [...sequences];

    switch (sortMethod) {
      case ExploreSortMethod.ALPHABETICAL:
        return this.sortAlphabetically(sorted);
      case ExploreSortMethod.DATE_ADDED:
        return this.sortByDateAdded(sorted);
      case ExploreSortMethod.DIFFICULTY_LEVEL:
        return this.sortByDifficulty(sorted);
      case ExploreSortMethod.SEQUENCE_LENGTH:
        return this.sortByLength(sorted);
      case ExploreSortMethod.AUTHOR:
        return this.sortByAuthor(sorted);
      case ExploreSortMethod.POPULARITY:
        return this.sortByPopularity(sorted);
      default:
        return sorted;
    }
  }

  groupSequencesIntoSections(
    sequences: SequenceData[],
    sortMethod: ExploreSortMethod
  ): Record<string, SequenceData[]> {
    const sections: Record<string, SequenceData[]> = {};

    for (const sequence of sequences) {
      const sectionKey = this.getSectionKey(sequence, sortMethod);

      if (!sections[sectionKey]) {
        sections[sectionKey] = [];
      }

      sections[sectionKey].push(sequence);
    }

    return sections;
  }

  // ============================================================================
  // Sorting Methods
  // ============================================================================

  private sortAlphabetically(sequences: SequenceData[]): SequenceData[] {
    // Use the kinetic alphabet order (Type 1-6 letters in proper TKA sequence)
    return sortSequencesByKineticAlphabet(sequences);
  }

  private sortByDateAdded(sequences: SequenceData[]): SequenceData[] {
    return sequences.sort((a, b) => {
      const dateA = a.dateAdded ? new Date(a.dateAdded) : new Date(0);
      const dateB = b.dateAdded ? new Date(b.dateAdded) : new Date(0);
      return dateB.getTime() - dateA.getTime(); // Newest first
    });
  }

  private sortByDifficulty(sequences: SequenceData[]): SequenceData[] {
    return sequences.sort((a, b) => {
      const levelA = this.getDifficultyOrder(a.difficultyLevel);
      const levelB = this.getDifficultyOrder(b.difficultyLevel);
      return levelA - levelB; // Easiest first
    });
  }

  private sortByLength(sequences: SequenceData[]): SequenceData[] {
    return sequences.sort(
      (a, b) => (a.sequenceLength ?? 0) - (b.sequenceLength ?? 0)
    );
  }

  private sortByAuthor(sequences: SequenceData[]): SequenceData[] {
    return sequences.sort((a, b) =>
      (a.author ?? "").localeCompare(b.author ?? "")
    );
  }

  private sortByPopularity(sequences: SequenceData[]): SequenceData[] {
    return sequences.sort(
      (a, b) => Number(b.isFavorite) - Number(a.isFavorite)
    );
  }

  // ============================================================================
  // Section Key Generation
  // ============================================================================

  private getSectionKey(
    sequence: SequenceData,
    sortMethod: ExploreSortMethod
  ): string {
    switch (sortMethod) {
      case ExploreSortMethod.ALPHABETICAL:
        return this.getAlphabeticalSection(sequence);
      case ExploreSortMethod.DIFFICULTY_LEVEL:
        return sequence.difficultyLevel ?? "Unknown";
      case ExploreSortMethod.AUTHOR:
        return sequence.author ?? "Unknown";
      case ExploreSortMethod.SEQUENCE_LENGTH:
        return this.getLengthSection(sequence);
      default:
        return "All";
    }
  }

  private getAlphabeticalSection(sequence: SequenceData): string {
    const word = sequence.word;
    if (!word || word.length === 0) return "#";

    const firstChar = word[0]!;

    // Type 6 letters: α, β, γ, ζ, η, τ, ⊕
    const TYPE6_LETTERS = ["α", "β", "γ", "ζ", "η", "τ", "⊕"];

    let char: string;
    if (TYPE6_LETTERS.includes(firstChar)) {
      // Type 6 letter - keep as-is
      char = firstChar;
    } else {
      // Type 1-5, uppercase it
      char = firstChar.toUpperCase();
    }

    // Check for dash variant (e.g., "Θ-" should return "Θ-" not just "Θ")
    const secondChar = word[1];
    if (secondChar === "-") {
      return `${char}-`;
    }

    return char;
  }

  private getLengthSection(sequence: SequenceData): string {
    const length = sequence.sequenceLength ?? 0;

    if (length <= 4) return "3-4 beats";
    if (length <= 6) return "5-6 beats";
    if (length <= 8) return "7-8 beats";
    return "9+ beats";
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getDifficultyOrder(difficulty?: string): number {
    switch (difficulty) {
      case "beginner":
        return 1;
      case "intermediate":
        return 2;
      case "advanced":
        return 3;
      default:
        return 0;
    }
  }
}
