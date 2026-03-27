/**
 * Formation Presets
 *
 * Built-in formation definitions for 1-4 performers.
 * Each preset adapts to the number of performers present.
 */

import {
  type Formation,
  type FormationSlot,
  type FormationPreset,
  createFormation,
  DEFAULT_FORMATION_SPACING,
  FORMATION_WALL_OFFSET,
} from "../domain/formation";

/**
 * Generate slots for grid-2x2 formation (current default)
 *
 * 1 performer: centered
 * 2 performers: side by side
 * 3 performers: 2 front, 1 back center
 * 4 performers: full 2x2 grid
 */
function generateGrid2x2Slots(count: number): FormationSlot[] {
  const spacing = DEFAULT_FORMATION_SPACING;
  const offset = FORMATION_WALL_OFFSET;

  if (count === 1) {
    return [{ index: 0, position: { x: 0, z: offset } }];
  }

  if (count === 2) {
    return [
      { index: 0, position: { x: -spacing / 2, z: offset } },
      { index: 1, position: { x: spacing / 2, z: offset } },
    ];
  }

  if (count === 3) {
    return [
      { index: 0, position: { x: -spacing / 2, z: offset } },
      { index: 1, position: { x: spacing / 2, z: offset } },
      { index: 2, position: { x: 0, z: -spacing + offset } },
    ];
  }

  // 4 performers
  return [
    { index: 0, position: { x: -spacing / 2, z: offset } },
    { index: 1, position: { x: spacing / 2, z: offset } },
    { index: 2, position: { x: -spacing / 2, z: -spacing + offset } },
    { index: 3, position: { x: spacing / 2, z: -spacing + offset } },
  ];
}

/**
 * Generate slots for line formation
 *
 * All performers in a single row, evenly spaced
 */
function generateLineSlots(count: number): FormationSlot[] {
  const spacing = DEFAULT_FORMATION_SPACING;
  const offset = FORMATION_WALL_OFFSET;
  const slots: FormationSlot[] = [];

  // Center the line
  const totalWidth = (count - 1) * spacing;
  const startX = -totalWidth / 2;

  for (let i = 0; i < count; i++) {
    slots.push({
      index: i,
      position: { x: startX + i * spacing, z: offset },
    });
  }

  return slots;
}

/**
 * Generate slots for circle formation
 *
 * Performers arranged in a circle facing the center
 */
function generateCircleSlots(count: number): FormationSlot[] {
  const radius = DEFAULT_FORMATION_SPACING * 0.75;
  const offset = FORMATION_WALL_OFFSET;
  const slots: FormationSlot[] = [];

  if (count === 1) {
    return [{ index: 0, position: { x: 0, z: offset } }];
  }

  if (count === 2) {
    // Two performers facing each other
    return [
      {
        index: 0,
        position: { x: -radius, z: offset },
        facingAngle: Math.PI / 2,
      }, // Face right
      {
        index: 1,
        position: { x: radius, z: offset },
        facingAngle: -Math.PI / 2,
      }, // Face left
    ];
  }

  // 3-4 performers in a circle
  for (let i = 0; i < count; i++) {
    // Start from front and go clockwise
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius + offset;

    // Face toward center
    const facingAngle = angle + Math.PI / 2;

    slots.push({
      index: i,
      position: { x, z },
      facingAngle,
    });
  }

  return slots;
}

/**
 * Generate slots for V-shape/chevron formation
 *
 * Leader in front, others trailing in V pattern
 */
function generateVShapeSlots(count: number): FormationSlot[] {
  const spacing = DEFAULT_FORMATION_SPACING;
  const offset = FORMATION_WALL_OFFSET;
  const slots: FormationSlot[] = [];

  if (count === 1) {
    return [{ index: 0, position: { x: 0, z: offset } }];
  }

  if (count === 2) {
    return [
      { index: 0, position: { x: -spacing / 2, z: offset } },
      { index: 1, position: { x: spacing / 2, z: offset } },
    ];
  }

  // Leader at front
  slots.push({ index: 0, position: { x: 0, z: offset } });

  // Others form V behind
  const vSpacing = spacing * 0.7;
  const vDepth = spacing * 0.6;

  if (count >= 2) {
    slots.push({
      index: 1,
      position: { x: -vSpacing, z: -vDepth + offset },
    });
  }
  if (count >= 3) {
    slots.push({
      index: 2,
      position: { x: vSpacing, z: -vDepth + offset },
    });
  }
  if (count >= 4) {
    slots.push({
      index: 3,
      position: { x: 0, z: -vDepth * 2 + offset },
    });
  }

  return slots;
}

/**
 * Generate slots for diagonal formation
 *
 * Staggered diagonal line from front-left to back-right
 */
function generateDiagonalSlots(count: number): FormationSlot[] {
  const spacing = DEFAULT_FORMATION_SPACING * 0.6;
  const offset = FORMATION_WALL_OFFSET;
  const slots: FormationSlot[] = [];

  // Center the diagonal
  const totalOffset = ((count - 1) * spacing) / 2;

  for (let i = 0; i < count; i++) {
    slots.push({
      index: i,
      position: {
        x: -totalOffset + i * spacing,
        z: -i * spacing * 0.8 + offset,
      },
    });
  }

  return slots;
}

/**
 * Get slots for a formation preset
 */
export function getSlotsForPreset(
  preset: FormationPreset,
  performerCount: number
): FormationSlot[] {
  const count = Math.max(1, Math.min(4, performerCount));

  switch (preset) {
    case "grid-2x2":
      return generateGrid2x2Slots(count);
    case "line":
      return generateLineSlots(count);
    case "circle":
      return generateCircleSlots(count);
    case "v-shape":
      return generateVShapeSlots(count);
    case "diagonal":
      return generateDiagonalSlots(count);
    case "custom":
      // Custom formations return empty - should be filled by user
      return generateGrid2x2Slots(count);
    default:
      return generateGrid2x2Slots(count);
  }
}

/**
 * Get default facing mode for a preset
 */
function getDefaultFacingMode(preset: FormationPreset): "same-direction" | "face-center" | "custom" {
  switch (preset) {
    case "circle":
      return "custom"; // Circle uses per-slot facing angles
    default:
      return "same-direction";
  }
}

/**
 * Create a formation from a preset for a given number of performers
 */
export function createFormationFromPreset(
  preset: FormationPreset,
  performerCount: number
): Formation {
  const slots = getSlotsForPreset(preset, performerCount);
  const facingMode = getDefaultFacingMode(preset);

  const presetNames: Record<FormationPreset, string> = {
    "grid-2x2": "Grid",
    line: "Line",
    circle: "Circle",
    "v-shape": "V-Shape",
    diagonal: "Diagonal",
    custom: "Custom",
  };

  return createFormation(
    `${preset}-${performerCount}`,
    presetNames[preset],
    preset,
    slots,
    { facingMode }
  );
}

/**
 * All available formation presets (excluding custom)
 */
export const FORMATION_PRESETS: FormationPreset[] = [
  "grid-2x2",
  "line",
  "circle",
  "v-shape",
  "diagonal",
];

/**
 * Formation preset metadata for UI display
 */
export interface FormationPresetInfo {
  id: FormationPreset;
  name: string;
  description: string;
  icon: string; // Font Awesome icon name
}

export const FORMATION_PRESET_INFO: FormationPresetInfo[] = [
  {
    id: "grid-2x2",
    name: "Grid",
    description: "2x2 grid arrangement",
    icon: "th",
  },
  {
    id: "line",
    name: "Line",
    description: "Single row, side by side",
    icon: "grip-lines",
  },
  {
    id: "circle",
    name: "Circle",
    description: "Circle facing center",
    icon: "circle",
  },
  {
    id: "v-shape",
    name: "V-Shape",
    description: "Chevron/V formation",
    icon: "chevron-down",
  },
  {
    id: "diagonal",
    name: "Diagonal",
    description: "Staggered diagonal line",
    icon: "slash",
  },
];

/**
 * Get the default formation for a given performer count
 */
export function getDefaultFormation(performerCount: number): Formation {
  return createFormationFromPreset("grid-2x2", performerCount);
}
