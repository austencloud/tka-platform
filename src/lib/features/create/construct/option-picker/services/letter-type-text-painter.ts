/**
 * Letter Type Text Painter
 *
 * Based on the desktop app's LetterTypeTextPainter utility.
 * Colors specific words in letter type descriptions to match the desktop app styling.
 */

const COLORS = {
  Shift: "#6F2DA8", // Purple
  Dual: "#00b3ff", // Blue
  Dash: "#26e600", // Green
  Cross: "#26e600", // Green
  Static: "#eb7d00", // Orange
  "-": "currentColor", // Inherit from parent (adapts to theme)
} as const;

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
  const words = text.split("-");
  const styled = words.map((word) => {
    const color = COLORS[word as keyof typeof COLORS] || "currentColor";
    const weight = bold ? " font-weight: bold;" : "";
    return `<span style="color: ${color};${weight}">${escapeHtml(word)}</span>`;
  });

  return text.includes("-") ? styled.join("-") : styled.join("");
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
