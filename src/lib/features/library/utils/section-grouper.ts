/**
 * Library Section Grouper
 *
 * Groups library sequences into collapsible sections for organized display.
 */

import type { LibrarySequence } from "../domain/models/LibrarySequence";

export type GroupByMethod = "none" | "date" | "letter" | "length";

export interface LibrarySection {
  id: string;
  title: string;
  count: number;
  sequences: LibrarySequence[];
  sortOrder: number;
}

/**
 * Groups sequences into sections based on the specified method
 */
export function groupSequencesIntoSections(
  sequences: LibrarySequence[],
  groupBy: GroupByMethod
): LibrarySection[] {
  if (groupBy === "none" || sequences.length === 0) {
    return [];
  }

  const grouped = new Map<string, LibrarySequence[]>();

  for (const seq of sequences) {
    const key = getGroupKey(seq, groupBy);
    const existing = grouped.get(key) || [];
    existing.push(seq);
    grouped.set(key, existing);
  }

  const sections: LibrarySection[] = [];

  for (const [key, seqs] of grouped) {
    sections.push({
      id: `section-${key.toLowerCase().replace(/\s+/g, "-")}`,
      title: getSectionTitle(key, groupBy),
      count: seqs.length,
      sequences: seqs,
      sortOrder: getSortOrder(key, groupBy),
    });
  }

  return sections.sort((a, b) => a.sortOrder - b.sortOrder);
}

function getGroupKey(seq: LibrarySequence, groupBy: GroupByMethod): string {
  switch (groupBy) {
    case "date":
      // Use birthday (original creation date) for grouping, fallback to createdAt
      return getDateGroupKey(seq.birthday || seq.createdAt);

    case "letter": {
      const word = seq.word || seq.name || "";
      if (!word) return "Other";

      const firstChar = word.charAt(0);
      // Type 6 letters - keep as-is
      const TYPE6_LETTERS = ["α", "β", "γ", "ζ", "η", "τ", "⊕"];
      if (TYPE6_LETTERS.includes(firstChar)) {
        return firstChar;
      }

      // Check for dash second character (Type 3/5 letters like "W-")
      const secondChar = word.charAt(1);
      const letter = firstChar.toUpperCase();
      return secondChar === "-" ? `${letter}-` : letter;
    }

    case "length": {
      const length = seq.beats?.length || 0;
      if (length <= 4) return "1-4 beats";
      if (length <= 8) return "5-8 beats";
      if (length <= 16) return "9-16 beats";
      return "17+ beats";
    }

    default:
      return "All";
  }
}

function getDateGroupKey(date: Date | undefined): string {
  if (!date) return "Unknown";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";
  if (diffDays < 30) return "This Month";
  if (diffDays < 90) return "Last 3 Months";
  return "Older";
}

function getSectionTitle(key: string, groupBy: GroupByMethod): string {
  switch (groupBy) {
    case "date":
      return key;
    case "letter":
      return `Letter ${key}`;
    case "length":
      return key;
    default:
      return key;
  }
}

function getSortOrder(key: string, groupBy: GroupByMethod): number {
  switch (groupBy) {
    case "date": {
      const dateOrder: Record<string, number> = {
        Today: 0,
        Yesterday: 1,
        "This Week": 2,
        "This Month": 3,
        "Last 3 Months": 4,
        Older: 5,
        Unknown: 6,
      };
      return dateOrder[key] ?? 999;
    }

    case "letter": {
      // Kinetic alphabet order
      const KINETIC_ORDER = [
        // Type 1: Dual-Shift (A-V)
        "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
        "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V",
        // Type 2: Shift
        "W", "X", "Y", "Z", "Σ", "Δ", "Θ", "Ω",
        // Type 3: Cross-Shift
        "W-", "X-", "Y-", "Z-", "Σ-", "Δ-", "Θ-", "Ω-",
        // Type 4: Dash
        "Φ", "Ψ", "Λ",
        // Type 5: Dual-Dash
        "Φ-", "Ψ-", "Λ-",
        // Type 6: Static
        "α", "β", "γ", "ζ", "η", "τ", "⊕",
      ];
      const idx = KINETIC_ORDER.indexOf(key);
      return idx >= 0 ? idx : 999;
    }

    case "length": {
      const lengthOrder: Record<string, number> = {
        "1-4 beats": 0,
        "5-8 beats": 1,
        "9-16 beats": 2,
        "17+ beats": 3,
      };
      return lengthOrder[key] ?? 999;
    }

    default:
      return 0;
  }
}
