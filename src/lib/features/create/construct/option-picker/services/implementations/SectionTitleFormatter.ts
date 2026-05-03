/**
 * Section Title Formatter Implementation
 *
 * Handles formatting of section titles with colored text and descriptions.
 * Extracted from OptionViewer.svelte.
 */

import { LetterTypeTextPainter } from "../../utils/letter-type-text-painter";
export class SectionTitleFormatter {
  private readonly typeDescriptions = {
    Type1: { description: "Dual-Shift", typeName: "Type 1" },
    Type2: { description: "Shift", typeName: "Type 2" },
    Type3: { description: "Cross-Shift", typeName: "Type 3" },
    Type4: { description: "Dash", typeName: "Type 4" },
    Type5: { description: "Dual-Dash", typeName: "Type 5" },
    Type6: { description: "Static", typeName: "Type 6" },
  };

  formatSectionTitle(rawTitle: string): string {
    // Handle grouped section - show all three types with colors
    if (rawTitle === "Types 4-6") {
      const dash = LetterTypeTextPainter.getColoredText("Dash");
      const dualDash = LetterTypeTextPainter.getColoredText("Dual-Dash");
      const staticText = LetterTypeTextPainter.getColoredText("Static");
      return `Types 4-6:&nbsp;${dash},&nbsp;${dualDash},&nbsp;${staticText}`;
    }

    // Handle individual types
    if (rawTitle in this.typeDescriptions) {
      const typeInfo =
        this.typeDescriptions[rawTitle as keyof typeof this.typeDescriptions];
      return LetterTypeTextPainter.formatSectionHeader(
        typeInfo.typeName,
        typeInfo.description
      );
    }

    return rawTitle;
  }

  getTypeDescription(
    typeKey: string
  ): { description: string; typeName: string } | undefined {
    return this.typeDescriptions[typeKey as keyof typeof this.typeDescriptions];
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const sectionTitleFormatter = new SectionTitleFormatter();
