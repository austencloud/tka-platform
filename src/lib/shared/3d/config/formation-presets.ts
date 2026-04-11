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
 * Solo formation — single performer centered behind the wall plane.
 */
function generateSoloSlots(_count: number): FormationSlot[] {
  return [{ index: 0, position: { x: 0, z: FORMATION_WALL_OFFSET } }];
}

/**
 * Tunnel stack formation — conga line along -Z, all facing the audience.
 * 1.2m between stacked performers.
 */
function generateTunnelStackSlots(count: number): FormationSlot[] {
  const depth = DEFAULT_FORMATION_SPACING * 0.6; // 1.2m
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    position: { x: 0, z: FORMATION_WALL_OFFSET + i * -depth },
  }));
}

/**
 * Back-to-back formation — both performers at origin, facing opposite directions.
 */
function generateBackToBackSlots(count: number): FormationSlot[] {
  if (count < 2) return generateSoloSlots(count);
  return [
    {
      index: 0,
      position: { x: 0, z: FORMATION_WALL_OFFSET },
      facingAngle: 0,
    },
    {
      index: 1,
      position: { x: 0, z: FORMATION_WALL_OFFSET },
      facingAngle: Math.PI,
    },
  ];
}

/**
 * Facing-each-other formation — performers at ±0.5m, facing inward.
 */
function generateFacingEachOtherSlots(count: number): FormationSlot[] {
  if (count < 2) return generateSoloSlots(count);
  return [
    {
      index: 0,
      position: { x: -0.5, z: FORMATION_WALL_OFFSET },
      facingAngle: Math.PI / 2,
    },
    {
      index: 1,
      position: { x: 0.5, z: FORMATION_WALL_OFFSET },
      facingAngle: -Math.PI / 2,
    },
  ];
}

/**
 * Stage left/right formation — performers at ±2.5m, facing the audience.
 */
function generateStageLRSlots(count: number): FormationSlot[] {
  if (count < 2) return generateSoloSlots(count);
  return [
    { index: 0, position: { x: -2.5, z: FORMATION_WALL_OFFSET } },
    { index: 1, position: { x: 2.5, z: FORMATION_WALL_OFFSET } },
  ];
}

/**
 * Side-by-side formation — evenly spaced along X with 1.8m between consecutive slots.
 */
function generateSideBySideSlots(count: number): FormationSlot[] {
  const spacing = 1.8;
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    position: { x: (i - (count - 1) / 2) * spacing, z: FORMATION_WALL_OFFSET },
  }));
}

/**
 * Get slots for a formation preset
 */
export function getSlotsForPreset(
  preset: FormationPreset,
  performerCount: number
): FormationSlot[] {
  // grid-2x2 stays clamped to 4 because it's specifically a 2x2 shape.
  // All other presets support up to 8 for the standalone 3D viewer.
  const isGrid = preset === "grid-2x2";
  const upperBound = isGrid ? 4 : 8;
  const count = Math.max(1, Math.min(upperBound, performerCount));

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
      return generateGrid2x2Slots(count);
    case "solo":
      return generateSoloSlots(count);
    case "tunnel-stack":
      return generateTunnelStackSlots(count);
    case "back-to-back":
      return generateBackToBackSlots(count);
    case "facing-each-other":
      return generateFacingEachOtherSlots(count);
    case "stage-lr":
      return generateStageLRSlots(count);
    case "side-by-side":
      return generateSideBySideSlots(count);
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
    solo: "Solo",
    "tunnel-stack": "Tunnel Stack",
    "back-to-back": "Back-to-Back",
    "facing-each-other": "Facing Each Other",
    "stage-lr": "Stage L/R",
    "side-by-side": "Side-by-Side",
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
  "solo",
  "grid-2x2",
  "line",
  "circle",
  "v-shape",
  "diagonal",
  "tunnel-stack",
  "back-to-back",
  "facing-each-other",
  "stage-lr",
  "side-by-side",
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
  {
    id: "solo",
    name: "Solo",
    description: "Single performer, centered",
    icon: "user",
  },
  {
    id: "tunnel-stack",
    name: "Tunnel Stack",
    description: "Conga line behind each other",
    icon: "layer-group",
  },
  {
    id: "back-to-back",
    name: "Back-to-Back",
    description: "Two performers, opposite facings",
    icon: "user-friends",
  },
  {
    id: "facing-each-other",
    name: "Facing Each Other",
    description: "Two performers, facing inward",
    icon: "people-arrows",
  },
  {
    id: "stage-lr",
    name: "Stage L/R",
    description: "Left and right of stage",
    icon: "arrows-alt-h",
  },
  {
    id: "side-by-side",
    name: "Side-by-Side",
    description: "Evenly spaced in one row",
    icon: "grip-lines",
  },
];

/**
 * Valid performer counts per preset. Used by the viewer's formation picker
 * to gray out presets that don't match the current performer count.
 * "custom" accepts any count in the viewer-specific range [1, 8].
 */
export const PRESET_VALID_COUNTS: Record<FormationPreset, number[]> = {
  solo: [1],
  "grid-2x2": [1, 2, 3, 4],
  line: [1, 2, 3, 4, 5, 6, 7, 8],
  circle: [1, 2, 3, 4, 5, 6, 7, 8],
  "v-shape": [1, 2, 3, 4, 5, 7],
  diagonal: [1, 2, 3, 4, 5, 6, 7, 8],
  "tunnel-stack": [2, 3, 4, 5, 6, 7, 8],
  "back-to-back": [2],
  "facing-each-other": [2],
  "stage-lr": [2],
  "side-by-side": [2, 3, 4, 5, 6, 7, 8],
  custom: [1, 2, 3, 4, 5, 6, 7, 8],
};

/**
 * Get the default formation for a given performer count
 */
export function getDefaultFormation(performerCount: number): Formation {
  return createFormationFromPreset("grid-2x2", performerCount);
}
