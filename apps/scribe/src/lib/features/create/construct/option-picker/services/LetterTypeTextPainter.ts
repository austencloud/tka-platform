/**
 * LetterTypeTextPainter - Colors letter type text for headers
 *
 * Based on the desktop app's LetterTypeTextPainter.
 * Colors specific words in letter type descriptions.
 */

const COLORS = {
  Shift: "#6F2DA8", // Purple
  Dual: "#00b3ff", // Blue
  Dash: "#26e600", // Green
  Cross: "#26e600", // Green
  Static: "#eb7d00", // Orange
  "-": "#000000", // Black
} as const;

export class LetterTypeTextPainter {
  /**
   * Generate colored HTML text
   */
  static getColoredText(text: string, bold = false): string {
    const words = text.split("-");
    const styled = words.map((word) => {
      const color = COLORS[word as keyof typeof COLORS] || "black";
      const weight = bold ? " font-weight: bold;" : "";
      return `<span style="color: ${color};${weight}">${word}</span>`;
    });

    return text.includes("-") ? styled.join("-") : styled.join("");
  }

  /**
   * Format a section header with colored description
   */
  static formatSectionHeader(
    typeName: string,
    description: string,
    bold = false
  ): string {
    return `${typeName}:&nbsp;${this.getColoredText(description, bold)}`;
  }
}
