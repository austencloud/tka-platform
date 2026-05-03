/**
 * Option Organizer Service Implementation
 *
 * Handles organization of pictograph options into sections and groups.
 * Extracted from OptionPickerService for better separation of concerns.
 * Eliminates code duplication by using a single organization method.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { getLetterType } from "$lib/shared/foundation/domain/models/Letter";
import { LetterType } from "$lib/shared/foundation/domain/models/LetterType";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type {
  OrganizedSection,
  SortMethod,
} from "../../domain/option-picker-types";

export class OptionOrganizer {
  /**
   * Organize pictographs by sort method into sections
   * OPTIMIZED: Single method eliminates code duplication from original service
   */
  organizePictographs(
    pictographs: PictographData[],
    _sortMethod: SortMethod
  ): OrganizedSection[] {
    // All current sort methods (type, endPosition, reversals) use the same type-based organization
    return this.organizeByTypes(pictographs);
  }

  /**
   * Organize pictographs by letter types (Types 1-6)
   * Used for type, endPosition, and reversals sorting
   */
  private organizeByTypes(pictographs: PictographData[]): OrganizedSection[] {
    const allTypes = ["Type1", "Type2", "Type3", "Type4", "Type5", "Type6"];
    const groups = new Map<string, PictographData[]>();

    // Initialize all types with empty arrays
    allTypes.forEach((type) => {
      groups.set(type, []);
    });

    // Distribute pictographs to their respective types
    for (const pictograph of pictographs) {
      const groupKey = this.getLetterTypeFromString(pictograph.letter);
      if (groups.has(groupKey)) {
        groups.get(groupKey)!.push(pictograph);
      }
    }

    // Create individual sections for all Types 1-6
    const sections: OrganizedSection[] = [];

    // Add sections for each type (only if not empty)
    allTypes.forEach((type) => {
      const typePictographs = groups.get(type) ?? [];
      if (typePictographs.length > 0) {
        sections.push({
          title: type,
          pictographs: typePictographs,
          type: "section" as const,
        });
      }
    });

    return sections;
  }

  /**
   * Generic organization for other sort methods
   */
  private organizeGeneric(
    pictographs: PictographData[],
    sortMethod: SortMethod
  ): OrganizedSection[] {
    const groups = new Map<string, PictographData[]>();

    for (const pictograph of pictographs) {
      let groupKey: string;

      switch (sortMethod) {
        default:
          groupKey = this.getLetterTypeFromString(pictograph.letter);
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(pictograph);
    }

    // Convert groups to sections
    const sections: OrganizedSection[] = [];
    for (const [title, sectionPictographs] of groups.entries()) {
      sections.push({
        title,
        pictographs: sectionPictographs,
        type: "section" as const,
      });
    }

    return sections;
  }

  /**
   * Helper function to convert string letter to Letter enum and get type
   * Uses shared infrastructure instead of duplicated logic
   */
  private getLetterTypeFromString(letter: string | null | undefined): string {
    if (!letter) return LetterType.TYPE1;

    try {
      // Use the existing shared getLetterType function
      const letterEnum = letter as Letter;
      const letterType = getLetterType(letterEnum);
      return letterType; // Returns LetterType enum value (e.g., "Type1")
    } catch (error) {
      // Fallback for invalid letters
      console.warn(
        `Failed to determine letter type for "${letter}", defaulting to TYPE1:`,
        error
      );
      return LetterType.TYPE1;
    }
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const optionOrganizer = new OptionOrganizer();
