/**
 * Section Title Formatter Contract
 *
 * Handles formatting of section titles with colored text and descriptions.
 * Extracted from OptionViewer.svelte for reusability.
 */

export interface ISectionTitleFormatter {
  /**
   * Format a section title with colored text
   * @param rawTitle The raw section title (e.g., "Type 1", "Types 4-6")
   * @returns Formatted title with HTML color markup
   */
  formatSectionTitle(rawTitle: string): string;

  /**
   * Get type description for a type key
   * @param typeKey The type key (e.g., "Type1", "Type4")
   * @returns Type description object or undefined
   */
  getTypeDescription(
    typeKey: string
  ): { description: string; typeName: string } | undefined;
}
