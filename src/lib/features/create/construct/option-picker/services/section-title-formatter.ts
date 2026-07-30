/**
 * Section Title Formatter
 *
 * Handles formatting of section titles with colored text and descriptions.
 * Extracted from OptionViewer.svelte.
 */

import {
  formatSectionHeader,
  getColoredText,
  getColoredTextParts,
  type ColoredTextPart,
} from "./letter-type-text-painter";

export type LetterTypeKey =
  | "Type1"
  | "Type2"
  | "Type3"
  | "Type4"
  | "Type5"
  | "Type6";
export type LetterTypeGroupKey = "Type1" | "Type2" | "Type3" | "Types 4-6";
export type LetterTypeTranslationKey =
  | "create_type_dual_shift"
  | "create_type_shift"
  | "create_type_cross_shift"
  | "create_type_dash"
  | "create_type_dual_dash"
  | "create_type_static";

export interface LetterTypeDescriptor {
  key: LetterTypeKey;
  typeName: string;
  description: string;
  explanation: string;
  translationKey: LetterTypeTranslationKey;
  coloredParts: ReadonlyArray<ColoredTextPart>;
}

export interface LetterTypeGroupDescriptor {
  key: LetterTypeGroupKey;
  typeName: string;
  shortLabel: string;
  memberKeys: ReadonlyArray<LetterTypeKey>;
}

export interface LetterTypeGroupPresentation {
  accessibleName: string;
  coloredParts: ReadonlyArray<ColoredTextPart>;
  paletteColors: ReadonlyArray<string>;
}

function letterType(
  key: LetterTypeKey,
  typeName: string,
  description: string,
  explanation: string,
  translationKey: LetterTypeTranslationKey
): LetterTypeDescriptor {
  return {
    key,
    typeName,
    description,
    explanation,
    translationKey,
    coloredParts: getColoredTextParts(description),
  };
}

export const LETTER_TYPE_DESCRIPTORS = {
  Type1: letterType(
    "Type1",
    "Type 1",
    "Dual-Shift",
    "Both hands shift.",
    "create_type_dual_shift"
  ),
  Type2: letterType(
    "Type2",
    "Type 2",
    "Shift",
    "One hand shifts. The other stays in place.",
    "create_type_shift"
  ),
  Type3: letterType(
    "Type3",
    "Type 3",
    "Cross-Shift",
    "One hand shifts. The other dashes.",
    "create_type_cross_shift"
  ),
  Type4: letterType(
    "Type4",
    "Type 4",
    "Dash",
    "One hand dashes. The other stays in place.",
    "create_type_dash"
  ),
  Type5: letterType(
    "Type5",
    "Type 5",
    "Dual-Dash",
    "Both hands dash.",
    "create_type_dual_dash"
  ),
  Type6: letterType(
    "Type6",
    "Type 6",
    "Static",
    "Both hands stay in place. The props can still rotate.",
    "create_type_static"
  ),
} as const;

function letterTypeGroup(
  key: LetterTypeGroupKey,
  typeName: string,
  shortLabel: string,
  memberKeys: LetterTypeKey[]
): LetterTypeGroupDescriptor {
  return {
    key,
    typeName,
    shortLabel,
    memberKeys,
  };
}

/**
 * Construct presents the six letter types in four navigation groups. This is
 * the one ordered descriptor source for headers, selector labels, and panels.
 */
export const LETTER_TYPE_GROUP_DESCRIPTORS: ReadonlyArray<LetterTypeGroupDescriptor> =
  [
    letterTypeGroup("Type1", "Type 1", "1", ["Type1"]),
    letterTypeGroup("Type2", "Type 2", "2", ["Type2"]),
    letterTypeGroup("Type3", "Type 3", "3", ["Type3"]),
    letterTypeGroup("Types 4-6", "Types 4-6", "4-6", [
      "Type4",
      "Type5",
      "Type6",
    ]),
  ];

export function getLetterTypeGroupPresentation(
  group: LetterTypeGroupDescriptor,
  resolveDescription: (descriptor: LetterTypeDescriptor) => string = (
    descriptor
  ) => descriptor.description
): LetterTypeGroupPresentation {
  const descriptions = group.memberKeys.map((memberKey) =>
    resolveDescription(LETTER_TYPE_DESCRIPTORS[memberKey])
  );
  const coloredParts = descriptions.flatMap((description, index) => [
    ...(index === 0 ? [] : [{ text: ", " }]),
    ...getColoredTextParts(description),
  ]);
  const paletteColors = [
    ...new Set(
      group.memberKeys.flatMap((memberKey) =>
        LETTER_TYPE_DESCRIPTORS[memberKey].coloredParts.flatMap((part) =>
          part.color && part.color !== "currentColor" ? [part.color] : []
        )
      )
    ),
  ];

  return {
    accessibleName: `${group.typeName}: ${descriptions.join(", ")}`,
    coloredParts,
    paletteColors,
  };
}

export function formatSectionTitle(
  rawTitle: string,
  resolveDescription: (descriptor: LetterTypeDescriptor) => string = (
    descriptor
  ) => descriptor.description
): string {
  // Handle grouped section - show all three types with colors
  if (rawTitle === "Types 4-6") {
    const dash = getColoredText(
      resolveDescription(LETTER_TYPE_DESCRIPTORS.Type4)
    );
    const dualDash = getColoredText(
      resolveDescription(LETTER_TYPE_DESCRIPTORS.Type5)
    );
    const staticText = getColoredText(
      resolveDescription(LETTER_TYPE_DESCRIPTORS.Type6)
    );
    return `Types 4-6:&nbsp;${dash},&nbsp;${dualDash},&nbsp;${staticText}`;
  }

  // Handle individual types
  const typeInfo = getTypeDescription(rawTitle);
  if (typeInfo) {
    return formatSectionHeader(typeInfo.typeName, resolveDescription(typeInfo));
  }

  return rawTitle;
}

export function getTypeDescription(
  typeKey: string
): LetterTypeDescriptor | undefined {
  return LETTER_TYPE_DESCRIPTORS[typeKey as LetterTypeKey];
}

export function getLetterTypeGroupDescriptor(
  groupKey: string
): LetterTypeGroupDescriptor | undefined {
  return LETTER_TYPE_GROUP_DESCRIPTORS.find(
    (descriptor) => descriptor.key === groupKey
  );
}
