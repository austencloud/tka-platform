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

export type MovementTypeKey =
  | "Type1"
  | "Type2"
  | "Type3"
  | "Type4"
  | "Type5"
  | "Type6";
export type MovementFamilyKey = "Type1" | "Type2" | "Type3" | "Types 4-6";
export type MovementTypeTranslationKey =
  | "create_type_dual_shift"
  | "create_type_shift"
  | "create_type_cross_shift"
  | "create_type_dash"
  | "create_type_dual_dash"
  | "create_type_static";

export interface MovementTypeDescriptor {
  key: MovementTypeKey;
  typeName: string;
  description: string;
  explanation: string;
  translationKey: MovementTypeTranslationKey;
  coloredParts: ReadonlyArray<ColoredTextPart>;
}

export interface MovementFamilyDescriptor {
  key: MovementFamilyKey;
  typeName: string;
  shortLabel: string;
  memberKeys: ReadonlyArray<MovementTypeKey>;
}

export interface MovementFamilyPresentation {
  accessibleName: string;
  coloredParts: ReadonlyArray<ColoredTextPart>;
  paletteColors: ReadonlyArray<string>;
}

function movementType(
  key: MovementTypeKey,
  typeName: string,
  description: string,
  explanation: string,
  translationKey: MovementTypeTranslationKey
): MovementTypeDescriptor {
  return {
    key,
    typeName,
    description,
    explanation,
    translationKey,
    coloredParts: getColoredTextParts(description),
  };
}

export const MOVEMENT_TYPE_DESCRIPTORS = {
  Type1: movementType(
    "Type1",
    "Type 1",
    "Dual-Shift",
    "Both hands shift.",
    "create_type_dual_shift"
  ),
  Type2: movementType(
    "Type2",
    "Type 2",
    "Shift",
    "One hand shifts. The other stays in place.",
    "create_type_shift"
  ),
  Type3: movementType(
    "Type3",
    "Type 3",
    "Cross-Shift",
    "One hand shifts. The other dashes.",
    "create_type_cross_shift"
  ),
  Type4: movementType(
    "Type4",
    "Type 4",
    "Dash",
    "One hand dashes. The other stays in place.",
    "create_type_dash"
  ),
  Type5: movementType(
    "Type5",
    "Type 5",
    "Dual-Dash",
    "Both hands dash.",
    "create_type_dual_dash"
  ),
  Type6: movementType(
    "Type6",
    "Type 6",
    "Static",
    "Both hands stay in place. The props can still rotate.",
    "create_type_static"
  ),
} as const;

function movementFamily(
  key: MovementFamilyKey,
  typeName: string,
  shortLabel: string,
  memberKeys: MovementTypeKey[]
): MovementFamilyDescriptor {
  return {
    key,
    typeName,
    shortLabel,
    memberKeys,
  };
}

/**
 * Construct presents six movement types as four navigation families. This is
 * the one ordered descriptor source for headers, selector labels, and panels.
 */
export const MOVEMENT_FAMILY_DESCRIPTORS: ReadonlyArray<MovementFamilyDescriptor> =
  [
    movementFamily("Type1", "Type 1", "1", ["Type1"]),
    movementFamily("Type2", "Type 2", "2", ["Type2"]),
    movementFamily("Type3", "Type 3", "3", ["Type3"]),
    movementFamily("Types 4-6", "Types 4-6", "4-6", [
      "Type4",
      "Type5",
      "Type6",
    ]),
  ];

export function getMovementFamilyPresentation(
  family: MovementFamilyDescriptor,
  resolveDescription: (descriptor: MovementTypeDescriptor) => string = (
    descriptor
  ) => descriptor.description
): MovementFamilyPresentation {
  const descriptions = family.memberKeys.map((memberKey) =>
    resolveDescription(MOVEMENT_TYPE_DESCRIPTORS[memberKey])
  );
  const coloredParts = descriptions.flatMap((description, index) => [
    ...(index === 0 ? [] : [{ text: ", " }]),
    ...getColoredTextParts(description),
  ]);
  const paletteColors = [
    ...new Set(
      family.memberKeys.flatMap((memberKey) =>
        MOVEMENT_TYPE_DESCRIPTORS[memberKey].coloredParts.flatMap((part) =>
          part.color && part.color !== "currentColor" ? [part.color] : []
        )
      )
    ),
  ];

  return {
    accessibleName: `${family.typeName}: ${descriptions.join(", ")}`,
    coloredParts,
    paletteColors,
  };
}

export function formatSectionTitle(
  rawTitle: string,
  resolveDescription: (descriptor: MovementTypeDescriptor) => string = (
    descriptor
  ) => descriptor.description
): string {
  // Handle grouped section - show all three types with colors
  if (rawTitle === "Types 4-6") {
    const dash = getColoredText(
      resolveDescription(MOVEMENT_TYPE_DESCRIPTORS.Type4)
    );
    const dualDash = getColoredText(
      resolveDescription(MOVEMENT_TYPE_DESCRIPTORS.Type5)
    );
    const staticText = getColoredText(
      resolveDescription(MOVEMENT_TYPE_DESCRIPTORS.Type6)
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
): MovementTypeDescriptor | undefined {
  return MOVEMENT_TYPE_DESCRIPTORS[typeKey as MovementTypeKey];
}

export function getMovementFamilyDescriptor(
  familyKey: string
): MovementFamilyDescriptor | undefined {
  return MOVEMENT_FAMILY_DESCRIPTORS.find(
    (descriptor) => descriptor.key === familyKey
  );
}
