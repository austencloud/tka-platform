/**
 * Letter Type Text Painter
 *
 * Based on the desktop app's LetterTypeTextPainter utility.
 * Colors specific words in letter type descriptions to match the desktop app styling.
 */

export const LETTER_TYPE_TEXT_COLORS = {
  Shift: "#6F2DA8", // Purple
  Dual: "#00b3ff", // Blue
  Dash: "#26e600", // Green
  Cross: "#26e600", // Green
  Static: "#eb7d00", // Orange
} as const;

export interface ColoredTextPart {
  text: string;
  /** Omitted for punctuation that should inherit from its parent. */
  color?: string;
}

/**
 * Escape HTML special characters. The output of this module is consumed via
 * {@html}, so every interpolated string must be escaped — inputs are constants
 * today, but this hardens against future dynamic input (latent XSS).
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Generate colored HTML text based on the desktop app's text painter logic.
 * @param text The text to color (e.g., "Dual-Shift", "Cross-Shift", "Static")
 * @param bold Whether to make the text bold
 * @returns HTML string with colored spans
 */
export function getColoredText(text: string, bold = false): string {
  return getColoredTextParts(text)
    .map((part) => {
      if (!part.color) return escapeHtml(part.text);

      const color = part.color;
      const weight = bold ? " font-weight: bold;" : "";
      return `<span style="color: ${color};${weight}">${escapeHtml(part.text)}</span>`;
    })
    .join("");
}

/**
 * Return the same semantic color fragments used by section headings without
 * forcing consumers through {@html}. Interactive labels can render these parts
 * as normal Svelte markup and keep their accessible name separate.
 */
export function getColoredTextParts(text: string): ColoredTextPart[] {
  return text.split("-").flatMap((word, index) => {
    const color =
      LETTER_TYPE_TEXT_COLORS[word as keyof typeof LETTER_TYPE_TEXT_COLORS] ??
      "currentColor";
    const wordPart = { text: word, color };

    if (index === 0) return [wordPart];

    return [{ text: "-" }, wordPart];
  });
}

/**
 * Format a complete section header with colored text.
 * @param typeName The type name (e.g., "Type 3")
 * @param description The description (e.g., "Cross-Shift")
 * @param bold Whether to make the text bold
 * @returns HTML string with the complete colored header
 */
export function formatSectionHeader(
  typeName: string,
  description: string,
  bold = false
): string {
  return `${escapeHtml(typeName)}:&nbsp;${getColoredText(description, bold)}`;
}
