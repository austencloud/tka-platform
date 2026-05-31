/**
 * Browse Sort Service
 *
 * Handles sorting and grouping of gallery sequences.
 * Provides consistent sorting behavior across the gallery.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { BrowseSortMethod } from "$lib/shared/browse/domain/enums/browse-enums";
import { sortSequencesByKineticAlphabet } from "$lib/shared/browse/utils/kinetic-alphabet-sort";

export function sortSequences(
  sequences: SequenceData[],
  sortMethod: BrowseSortMethod
): SequenceData[] {
  const sorted = [...sequences];

  switch (sortMethod) {
    case BrowseSortMethod.ALPHABETICAL:
      return sortAlphabetically(sorted);
    case BrowseSortMethod.DATE_ADDED:
      return sortByDateAdded(sorted);
    case BrowseSortMethod.DIFFICULTY_LEVEL:
      return sortByDifficulty(sorted);
    case BrowseSortMethod.SEQUENCE_LENGTH:
      return sortByLength(sorted);
    case BrowseSortMethod.AUTHOR:
      return sortByAuthor(sorted);
    case BrowseSortMethod.POPULARITY:
      return sortByPopularity(sorted);
    default:
      return sorted;
  }
}

export function groupSequencesIntoSections(
  sequences: SequenceData[],
  sortMethod: BrowseSortMethod
): Record<string, SequenceData[]> {
  const sections: Record<string, SequenceData[]> = {};

  for (const sequence of sequences) {
    const sectionKey = getSectionKey(sequence, sortMethod);

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

function sortAlphabetically(sequences: SequenceData[]): SequenceData[] {
  // Use the kinetic alphabet order (Type 1-6 letters in proper TKA sequence)
  return sortSequencesByKineticAlphabet(sequences);
}

function sortByDateAdded(sequences: SequenceData[]): SequenceData[] {
  return sequences.sort((a, b) => {
    const dateA = a.dateAdded ? new Date(a.dateAdded) : new Date(0);
    const dateB = b.dateAdded ? new Date(b.dateAdded) : new Date(0);
    return dateB.getTime() - dateA.getTime(); // Newest first
  });
}

function sortByDifficulty(sequences: SequenceData[]): SequenceData[] {
  return sequences.sort((a, b) => {
    const levelA = getDifficultyOrder(a.difficultyLevel);
    const levelB = getDifficultyOrder(b.difficultyLevel);
    return levelA - levelB; // Easiest first
  });
}

function sortByLength(sequences: SequenceData[]): SequenceData[] {
  return sequences.sort(
    (a, b) => (a.sequenceLength ?? 0) - (b.sequenceLength ?? 0)
  );
}

function sortByAuthor(sequences: SequenceData[]): SequenceData[] {
  return sequences.sort((a, b) =>
    (a.author ?? "").localeCompare(b.author ?? "")
  );
}

function sortByPopularity(sequences: SequenceData[]): SequenceData[] {
  return sequences.sort(
    (a, b) => Number(b.isFavorite) - Number(a.isFavorite)
  );
}

// ============================================================================
// Section Key Generation
// ============================================================================

function getSectionKey(
  sequence: SequenceData,
  sortMethod: BrowseSortMethod
): string {
  switch (sortMethod) {
    case BrowseSortMethod.ALPHABETICAL:
      return getAlphabeticalSection(sequence);
    case BrowseSortMethod.DIFFICULTY_LEVEL:
      return sequence.difficultyLevel ?? "Unknown";
    case BrowseSortMethod.AUTHOR:
      return sequence.author ?? "Unknown";
    case BrowseSortMethod.SEQUENCE_LENGTH:
      return getLengthSection(sequence);
    default:
      return "All";
  }
}

function getAlphabeticalSection(sequence: SequenceData): string {
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

function getLengthSection(sequence: SequenceData): string {
  const length = sequence.sequenceLength ?? 0;

  if (length <= 4) return "3-4 steps";
  if (length <= 6) return "5-6 steps";
  if (length <= 8) return "7-8 steps";
  return "9+ steps";
}

// ============================================================================
// Helper Methods
// ============================================================================

function getDifficultyOrder(difficulty?: string): number {
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
