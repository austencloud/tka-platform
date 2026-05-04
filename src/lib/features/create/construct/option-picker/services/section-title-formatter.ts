/**
 * Section Title Formatter
 *
 * Handles formatting of section titles with colored text and descriptions.
 * Extracted from OptionViewer.svelte.
 */

import { getColoredText, formatSectionHeader } from "./letter-type-text-painter";

const typeDescriptions = {
  Type1: { description: "Dual-Shift", typeName: "Type 1" },
  Type2: { description: "Shift", typeName: "Type 2" },
  Type3: { description: "Cross-Shift", typeName: "Type 3" },
  Type4: { description: "Dash", typeName: "Type 4" },
  Type5: { description: "Dual-Dash", typeName: "Type 5" },
  Type6: { description: "Static", typeName: "Type 6" },
} as const;

export function formatSectionTitle(rawTitle: string): string {
  // Handle grouped section - show all three types with colors
  if (rawTitle === "Types 4-6") {
    const dash = getColoredText("Dash");
    const dualDash = getColoredText("Dual-Dash");
    const staticText = getColoredText("Static");
    return `Types 4-6:&nbsp;${dash},&nbsp;${dualDash},&nbsp;${staticText}`;
  }

  // Handle individual types
  if (rawTitle in typeDescriptions) {
    const typeInfo =
      typeDescriptions[rawTitle as keyof typeof typeDescriptions];
    return formatSectionHeader(typeInfo.typeName, typeInfo.description);
  }

  return rawTitle;
}

export function getTypeDescription(
  typeKey: string
): { description: string; typeName: string } | undefined {
  return typeDescriptions[typeKey as keyof typeof typeDescriptions];
}
