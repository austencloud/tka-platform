/**
 * Section Service - Manages sequence section organization
 *
 * Handles grouping sequences into sections with headers and counts.
 *
 * Stateless — plain module functions, no instance state and no singleton
 * wrapper. (Formerly a class behind getBrowseSectionManager().)
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { BrowseSortMethod } from "$lib/shared/browse/domain/enums/browse-enums";
import type {
  SectionConfig,
  SequenceSection,
} from "$lib/shared/browse/domain/models/browse-models";
import { sortSequencesByKineticAlphabet } from "$lib/shared/browse/utils/kinetic-alphabet-sort";
import { deriveWord } from '$lib/shared/foundation/services/word-deriver';

export function organizeSections(
  sequences: SequenceData[],
  config: SectionConfig
): SequenceSection[] {
  if (config.groupBy === "none") {
    return [
      {
        id: "all",
        title: "All Sequences",
        count: sequences.length,
        sequences,
        isExpanded: true,
        sortOrder: 0,
      },
    ];
  }

  const grouped = groupSequences(sequences, config.groupBy);
  const sections = createSections(grouped, config);

  return sortSections(sections, config.groupBy);
}

export function toggleSectionExpansion(
  sectionId: string,
  sections: SequenceSection[]
): SequenceSection[] {
  return sections.map((section) => ({
    ...section,
    isExpanded:
      section.id === sectionId ? !section.isExpanded : section.isExpanded,
  }));
}

export function getDefaultSectionConfig(): SectionConfig {
  return {
    groupBy: "letter",
    sortMethod: "alphabetical" as BrowseSortMethod,
    showEmptySections: false,
  };
}

export function updateSectionConfig(
  config: SectionConfig,
  updates: Partial<SectionConfig>
): SectionConfig {
  return {
    ...config,
    ...updates,
  };
}

export function getSectionStatistics(sections: SequenceSection[]) {
  const totalSections = sections.length;
  const totalSequences = sections.reduce(
    (sum, section) => sum + section.count,
    0
  );
  const expandedSections = sections.filter(
    (section) => section.isExpanded
  ).length;
  const averageSequencesPerSection =
    totalSections > 0 ? totalSequences / totalSections : 0;

  return {
    totalSections,
    totalSequences,
    expandedSections,
    averageSequencesPerSection:
      Math.round(averageSequencesPerSection * 10) / 10,
  };
}

// Private helper functions
function groupSequences(
  sequences: SequenceData[],
  groupBy: SectionConfig["groupBy"]
): Map<string, SequenceData[]> {
  const groups = new Map<string, SequenceData[]>();

  sequences.forEach((sequence) => {
    const key = getGroupKey(sequence, groupBy);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    const group = groups.get(key);
    if (group) {
      group.push(sequence);
    }
  });

  return groups;
}

function getGroupKey(
  sequence: SequenceData,
  groupBy: SectionConfig["groupBy"]
): string {
  switch (groupBy) {
    case "letter": {
      // Sub-group by letter AND beat count for consistent row heights
      // Handle letter types: "W" vs "W-" (type 3 letters)
      // Type 6 letters: α, β, γ, ζ, η, τ, ⊕
      const word = deriveWord(sequence);
      const firstChar = word.charAt(0);
      const TYPE6_LETTERS = ["α", "β", "γ", "ζ", "η", "τ", "⊕"];

      let char: string;
      if (TYPE6_LETTERS.includes(firstChar)) {
        // Type 6 letter - keep as-is
        char = firstChar;
      } else {
        // Type 1-5, uppercase it
        char = firstChar.toUpperCase();
      }

      const secondChar = word.charAt(1);
      const letter = secondChar === "-" ? `${char}-` : char;
      // Use sequenceLength if available, otherwise fall back to steps array length
      const stepCount = sequence.sequenceLength ?? sequence.steps?.length ?? 0;
      // Use pipe separator to avoid conflict with dash in letter names
      return `${letter}|${stepCount}`;
    }

    case "length": {
      const word = deriveWord(sequence);
      const length = sequence.sequenceLength ?? word.length;
      return `${length} steps`;
    }

    case "difficulty":
      return sequence.difficultyLevel ?? "Unknown";

    case "author":
      return sequence.author ?? "Unknown Author";

    case "date": {
      // Canonical fallback: birthday (original creation) → createdAt → dateAdded
      const rawDate = sequence.birthday ?? sequence.createdAt ?? sequence.dateAdded;
      if (!rawDate) return "Unknown Date";
      const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
      // Handle invalid dates
      if (isNaN(date.getTime())) return "Unknown Date";
      return date.toDateString();
    }

    default:
      return "All";
  }
}

function createSections(
  grouped: Map<string, SequenceData[]>,
  config: SectionConfig
): SequenceSection[] {
  const sections: SequenceSection[] = [];

  grouped.forEach((sequences, key) => {
    if (!config.showEmptySections && sequences.length === 0) {
      return;
    }

    const section: SequenceSection = {
      id: createSectionId(key, config.groupBy),
      title: createSectionTitle(key, config.groupBy, sequences.length),
      count: sequences.length,
      sequences: sortSequencesInSection(sequences, config.sortMethod),
      isExpanded: config.expandedSections?.has(key) ?? false,
      sortOrder: getSectionSortOrder(key, config.groupBy),
    };

    sections.push(section);
  });

  return sections;
}

function createSectionId(
  key: string,
  groupBy: SectionConfig["groupBy"]
): string {
  return `${groupBy}-${key.toLowerCase().replace(/\s+/g, "-")}`;
}

function createSectionTitle(
  key: string,
  groupBy: SectionConfig["groupBy"],
  count: number
): string {
  const countText = count === 1 ? "1 sequence" : `${count} sequences`;

  switch (groupBy) {
    case "letter": {
      // Key format: "A|4" or "W-|4" (letter|beatcount, where letter might be "W-")
      const [letter = "", stepCountStr = "0"] = key.split("|");
      const steps = parseInt(stepCountStr) || 0;
      // Use parentheses to avoid double dash with letters like "W-"
      return `${letter} (${steps} steps) (${countText})`;
    }

    case "length":
      return `${key} (${countText})`;

    case "difficulty": {
      const difficultyEmoji =
        {
          beginner: "🟢",
          intermediate: "🟡",
          advanced: "🔴",
          Unknown: "⚪",
        }[key] ?? "⚪";
      return `${difficultyEmoji} ${key} (${countText})`;
    }

    case "author":
      return `👤 ${key} (${countText})`;

    case "date":
      return `📅 ${formatDateForSection(key)} (${countText})`;

    default:
      return `${key} (${countText})`;
  }
}

function sortSequencesInSection(
  sequences: SequenceData[],
  sortMethod: BrowseSortMethod
): SequenceData[] {
  const sorted = [...sequences];

  // Helper to get sequence length (beat count)
  const getLength = (s: SequenceData) =>
    s.sequenceLength ?? s.word?.length ?? 0;

  switch (sortMethod) {
    case "alphabetical": {
      // Primary: Kinetic alphabet order, Secondary: length for visual consistency
      const alphabetSorted = sortSequencesByKineticAlphabet(sorted);
      return alphabetSorted.sort((a, b) => {
        // Keep alphabetical order but group by length within same starting letter
        const letterA = a.word?.charAt(0) ?? "";
        const letterB = b.word?.charAt(0) ?? "";
        if (letterA === letterB) {
          return getLength(a) - getLength(b);
        }
        return 0; // Keep original alphabetical order for different letters
      });
    }

    case BrowseSortMethod.DIFFICULTY_LEVEL:
      return sorted.sort((a, b) => {
        const getDifficultyOrder = (level?: string) => {
          switch (level) {
            case "beginner":
              return 1;
            case "intermediate":
              return 2;
            case "advanced":
              return 3;
            default:
              return 0;
          }
        };
        const diffCompare =
          getDifficultyOrder(a.difficultyLevel) -
          getDifficultyOrder(b.difficultyLevel);
        // Secondary sort by length for visual consistency
        if (diffCompare === 0) {
          return getLength(a) - getLength(b);
        }
        return diffCompare;
      });

    case BrowseSortMethod.SEQUENCE_LENGTH:
      return sorted.sort((a, b) => {
        const lengthA = getLength(a);
        const lengthB = getLength(b);
        return lengthA - lengthB;
      });

    case BrowseSortMethod.DATE_ADDED:
      // Primary: most recent first, Secondary: length for visual consistency
      return sorted.sort((a, b) => {
        const dateA = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
        const dateB = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
        // Group by length first within sections for visual consistency
        // (sequences in the same row should have similar heights)
        const lengthCompare = getLength(a) - getLength(b);
        if (lengthCompare !== 0) {
          return lengthCompare;
        }
        return dateB - dateA; // Most recent first as secondary
      });

    case "author":
      return sorted.sort((a, b) => {
        const authorCompare = (a.author ?? "").localeCompare(b.author ?? "");
        // Secondary sort by length for visual consistency
        if (authorCompare === 0) {
          return getLength(a) - getLength(b);
        }
        return authorCompare;
      });

    default:
      // Default: sort by length for visual consistency
      return sorted.sort((a, b) => getLength(a) - getLength(b));
  }
}

function sortSections(
  sections: SequenceSection[],
  _groupBy: SectionConfig["groupBy"]
): SequenceSection[] {
  return sections.sort((a, b) => {
    // Primary sort by sortOrder
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }

    // Secondary sort by title for consistent ordering
    return a.title.localeCompare(b.title);
  });
}

function getSectionSortOrder(
  key: string,
  groupBy: SectionConfig["groupBy"]
): number {
  // Kinetic alphabet order
  const KINETIC_ALPHABET_ORDER = [
    // Type 1: Dual-Shift (A-V, includes M and N)
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    // Type 2: Shift
    "W",
    "X",
    "Y",
    "Z",
    "Σ",
    "Δ",
    "Θ",
    "Ω",
    // Advanced Type 2s
    "μ",
    "ν",
    // Type 3: Cross-Shift
    "W-",
    "X-",
    "Y-",
    "Z-",
    "Σ-",
    "Δ-",
    "Θ-",
    "Ω-",
    // Type 4: Dash
    "Φ",
    "Ψ",
    "Λ",
    // Type 5: Dual-Dash
    "Φ-",
    "Ψ-",
    "Λ-",
    // Type 6: Static
    "α",
    "β",
    "γ",
    // Advanced Type 6s
    "ζ",
    "η",
    "τ",
    "⊕",
  ];

  switch (groupBy) {
    case "letter": {
      // Key format: "A|4" or "W-|4" (letter|beatcount, where letter might be "W-")
      // Sort by letter position in kinetic alphabet, then by beat count
      const [letter = "", stepCountStr = "0"] = key.split("|");
      const letterIndex = KINETIC_ALPHABET_ORDER.indexOf(letter);
      const beatOrder = parseInt(stepCountStr) || 0;

      // Return: (letter position * 10000) + beat count
      // This ensures A comes before B, W comes before W-, etc.
      return (letterIndex + 1) * 10000 + beatOrder;
    }

    case "length": {
      // Extract number from "X steps"
      const match = key.match(/^(\d+)/);
      return match?.[1] ? parseInt(match[1]) : 999;
    }

    case "difficulty": {
      // Difficulty order
      const difficultyOrder = {
        beginner: 1,
        intermediate: 2,
        advanced: 3,
        Unknown: 4,
      };
      return difficultyOrder[key as keyof typeof difficultyOrder] || 999;
    }

    case "author":
      // Alphabetical by author
      return 0; // Will be sorted by title comparison

    case "date": {
      // Most recent first
      const date = new Date(key);
      return -date.getTime(); // Negative for reverse chronological
    }

    default:
      return 0;
  }
}

function formatDateForSection(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

  return date.toLocaleDateString();
}

// Additional functions required by browse-interfaces.ts
export function organizeIntoSections(
  sequences: SequenceData[],
  config: SectionConfig
): SequenceSection[] {
  // Use the existing organizeSections function
  return organizeSections(sequences, config);
}

export function getSectionConfig(sortMethod: BrowseSortMethod): SectionConfig {
  // Return a basic configuration based on sort method
  return {
    groupBy: "letter" as const,
    sortMethod: sortMethod,
    showEmptySections: false,
    expandedSections: new Set<string>(),
  };
}
