/**
 * Letter Type Text Painter
 *
 * Based on the desktop app's LetterTypeTextPainter utility.
 * Colors specific words in letter type descriptions to match the desktop app styling.
 */

export class LetterTypeTextPainter {
  static readonly COLORS = {
    Shift: "#6F2DA8", // Purple
    Dual: "#00b3ff", // Blue
    Dash: "#26e600", // Green
    Cross: "#26e600", // Green
    Static: "#eb7d00", // Orange
    "-": "#000000", // Black
  } as const;

  /**
   * Generate colored HTML text based on the desktop app's text painter logic
   * @param text The text to color (e.g., "Dual-Shift", "Cross-Shift", "Static")
   * @param bold Whether to make the text bold
   * @returns HTML string with colored spans
   */
  static getColoredText(text: string, bold: boolean = false): string {
    const typeWords = text.split("-");
    const styledWords = typeWords.map((word) => {
      const color = this.COLORS[word as keyof typeof this.COLORS] || "black";
      const fontWeight = bold ? " font-weight: bold;" : "";
      return `<span style="color: ${color};${fontWeight}">${word}</span>`;
    });

    if (text.includes("-")) {
      return styledWords.join("-");
    }
    return styledWords.join("");
  }

  /**
   * Format a complete section header with colored text
   * @param typeName The type name (e.g., "Type 3")
   * @param description The description (e.g., "Cross-Shift")
   * @param bold Whether to make the text bold
   * @returns HTML string with the complete colored header
   */
  static formatSectionHeader(
    typeName: string,
    description: string,
    bold: boolean = false
  ): string {
    const coloredDescription = this.getColoredText(description, bold);
    return `${typeName}:&nbsp;${coloredDescription}`;
  }
}
